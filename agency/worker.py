"""Worker loop: leases jobs, runs agent handlers, handles retries / external waits / run finalisation."""
from __future__ import annotations

import os
import socket
import threading
import time
import traceback

from . import control, db, queue
from .agents.handlers import HANDLERS
from .events import activity
from .integrations.media import MediaError

WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"


def process(job: dict) -> str:
    handler = HANDLERS.get(job["type"])
    if handler is None:
        queue.fail(job, f"no handler for {job['type']}", retryable=False)
        return "failed"
    try:
        result = handler(job)
        queue.complete(job["id"], result)
        status = "done"
    except queue.ExternalPending as e:
        queue.set_waiting(job, e.task_id)
        status = "waiting"
    except (queue.PermanentError, KeyError, ValueError, MediaError) as e:
        status = queue.fail(job, f"{type(e).__name__}: {e}", retryable=False)
    except Exception as e:  # unknown errors are retried with backoff, then dead-lettered
        status = queue.fail(job, f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1200:]}", retryable=True)
    control.maybe_finalize_run(job.get("run_id"))
    return status


def run_now(job_type: str, agent: str, payload: dict | None = None, content_id: str | None = None) -> dict:
    """Enqueue and execute one job immediately (human-triggered actions), whatever the agency state."""
    jid = queue.enqueue(job_type, agent, payload, content_id=content_id, priority=20)
    job = queue.lease_id(jid, WORKER_ID)
    status = process(job) if job else "not_leased"
    row = db.one("SELECT status, result, last_error FROM jobs WHERE id=?", (jid,))
    return {"job_id": jid, "status": status, "result": db.loads(row["result"], None), "error": row["last_error"]}


def drain_content(content_id: str, max_steps: int = 8) -> list[dict]:
    """Run the queued pipeline steps of one content right now (human-triggered: regenerate / continue)."""
    steps = []
    for _ in range(max_steps):
        j = db.one("SELECT id FROM jobs WHERE content_id=? AND status='queued' AND run_after<=? "
                   "ORDER BY priority DESC, created_at LIMIT 1", (content_id, db.now()))
        job = queue.lease_id(j["id"], WORKER_ID) if j else None
        if not job:
            break
        steps.append({"type": job["type"], "status": process(job)})
    return steps


def run_once(max_jobs: int = 1000, ignore_state: bool = False) -> int:
    """Drain ready jobs synchronously (tests, CLI `agency work --once`, Claude Code sessions)."""
    n = 0
    queue.recover_expired()
    while n < max_jobs:
        if not ignore_state and control.state()["status"] != "running":
            break
        job = queue.lease(WORKER_ID, blocked_agents=control.blocked_agents())
        if not job:
            break
        process(job)
        n += 1
    return n


def loop(stop: threading.Event, poll_s: float = 1.0) -> None:
    activity("worker", "started", WORKER_ID)
    last_recover = 0.0
    while not stop.is_set():
        try:
            if time.monotonic() - last_recover > 30:
                queue.recover_expired()
                last_recover = time.monotonic()
            if control.state()["status"] != "running":
                stop.wait(poll_s * 3)
                continue
            job = queue.lease(WORKER_ID, blocked_agents=control.blocked_agents())
            if job:
                process(job)
            else:
                stop.wait(poll_s)
        except Exception as e:  # keep the worker alive (e.g. DB locked)
            activity("worker", "loop_error", WORKER_ID, str(e)[:300], "error")
            stop.wait(5)


def scheduler_loop(stop: threading.Event, every_s: float = 20.0) -> None:
    from .scheduler import tick
    while not stop.is_set():
        try:
            tick()
        except Exception as e:
            activity("scheduler", "tick_error", details=str(e)[:300], level="error")
        stop.wait(every_s)


def boot() -> None:
    """Idempotent startup: DB, agents, schedules, character."""
    db.configure()
    control.ensure_agents()
    from .agents.character import active_character
    from .scheduler import seed_defaults
    seed_defaults()
    active_character()

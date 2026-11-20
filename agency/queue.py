"""DB-backed job queue: atomic leasing, exponential backoff, dead-letter, crash recovery."""
from __future__ import annotations

from . import db
from .events import activity, notify

BACKOFF_BASE_S = 30
BACKOFF_MAX_S = 1800
TERMINAL = ("done", "dead", "cancelled", "failed")


class PermanentError(Exception):
    """Do not retry (bad input, policy violation, refusal)."""


class ExternalPending(Exception):
    """Job waits for an external result (e.g. a Claude Code session); resumed on ingestion."""

    def __init__(self, task_id: str):
        super().__init__(task_id)
        self.task_id = task_id


def enqueue(job_type: str, agent: str, payload: dict | None = None, *, run_id: str | None = None,
            content_id: str | None = None, priority: int = 0, delay_s: float = 0, max_attempts: int = 3) -> str:
    jid = db.new_id("JOB")
    ts = db.now()
    db.insert("jobs", {
        "id": jid, "type": job_type, "agent": agent, "run_id": run_id, "content_id": content_id,
        "payload": db.dumps(payload or {}), "status": "queued", "priority": priority, "max_attempts": max_attempts,
        "run_after": db.now(delay_s), "created_at": ts, "updated_at": ts,
    })
    return jid


def lease(worker_id: str, lease_s: int = 300, blocked_agents: set[str] | None = None) -> dict | None:
    blocked = sorted(blocked_agents or ())
    excl = f"AND agent NOT IN ({','.join('?' * len(blocked))})" if blocked else ""
    with db.tx() as c:
        r = c.execute(
            f"SELECT id FROM jobs WHERE status='queued' AND run_after<=? {excl} "
            "ORDER BY priority DESC, created_at LIMIT 1", [db.now(), *blocked]).fetchone()
        if not r:
            return None
        c.execute("UPDATE jobs SET status='running', attempts=attempts+1, lease_until=?, worker_id=?, updated_at=? WHERE id=?",
                  (db.now(lease_s), worker_id, db.now(), r[0]))
        job = dict(c.execute("SELECT * FROM jobs WHERE id=?", (r[0],)).fetchone())
    job["payload"] = db.loads(job["payload"], {})
    return job


def lease_id(job_id: str, worker_id: str, lease_s: int = 300) -> dict | None:
    """Lease one specific queued job (used to run a job immediately from the API)."""
    with db.tx() as c:
        n = c.execute("UPDATE jobs SET status='running', attempts=attempts+1, lease_until=?, worker_id=?, updated_at=? "
                      "WHERE id=? AND status='queued'", (db.now(lease_s), worker_id, db.now(), job_id)).rowcount
        if not n:
            return None
        job = dict(c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    job["payload"] = db.loads(job["payload"], {})
    return job


def complete(job_id: str, result: dict | None = None) -> None:
    db.update("jobs", "id", job_id, {"status": "done", "result": db.dumps(result or {}), "lease_until": None,
                                     "updated_at": db.now(), "finished_at": db.now(), "last_error": None})


def fail(job: dict, error: str, retryable: bool = True) -> str:
    error = error[:2000]
    if retryable and job["attempts"] < job["max_attempts"]:
        delay = min(BACKOFF_BASE_S * 2 ** (job["attempts"] - 1), BACKOFF_MAX_S)
        db.update("jobs", "id", job["id"], {"status": "queued", "run_after": db.now(delay), "lease_until": None,
                                            "last_error": error, "updated_at": db.now()})
        activity(job["agent"], "job_retry_scheduled", job["id"], {"type": job["type"], "in_s": delay, "error": error[:200]}, "warn")
        return "queued"
    status = "dead" if retryable else "failed"
    db.update("jobs", "id", job["id"], {"status": status, "lease_until": None, "last_error": error,
                                        "updated_at": db.now(), "finished_at": db.now()})
    activity(job["agent"], f"job_{status}", job["id"], {"type": job["type"], "error": error[:300]}, "error")
    notify(f"Tâche en échec : {job['type']}", error[:300], "error", f"#/agents?job={job['id']}")
    return status


def set_waiting(job: dict, task_id: str) -> None:
    db.update("jobs", "id", job["id"], {"status": "waiting", "lease_until": None, "updated_at": db.now(),
                                        "attempts": max(job["attempts"] - 1, 0), "last_error": f"waiting:{task_id}"})


def resume(job_id: str, payload_patch: dict) -> bool:
    job = db.one("SELECT * FROM jobs WHERE id=?", (job_id,))
    if not job or job["status"] != "waiting":
        return False
    payload = {**db.loads(job["payload"], {}), **payload_patch}
    db.update("jobs", "id", job_id, {"status": "queued", "payload": db.dumps(payload), "run_after": db.now(), "updated_at": db.now()})
    return True


def recover_expired() -> int:
    """Re-queue jobs whose worker died (lease expired)."""
    expired = db.rows("SELECT * FROM jobs WHERE status='running' AND lease_until < ?", (db.now(),))
    for j in expired:
        fail(j, "lease expired (worker crash or timeout)", retryable=True)
    return len(expired)


def retry(job_id: str) -> bool:
    return db.execute("UPDATE jobs SET status='queued', attempts=0, run_after=?, updated_at=?, last_error=NULL "
                      "WHERE id=? AND status IN ('failed','dead','cancelled')", (db.now(), db.now(), job_id)) > 0


def cancel(job_id: str) -> bool:
    return db.execute("UPDATE jobs SET status='cancelled', updated_at=?, finished_at=? WHERE id=? AND status IN ('queued','waiting')",
                      (db.now(), db.now(), job_id)) > 0


def cancel_run(run_id: str) -> int:
    return db.execute("UPDATE jobs SET status='cancelled', updated_at=?, finished_at=? WHERE run_id=? AND status IN ('queued','waiting')",
                      (db.now(), db.now(), run_id))


def open_jobs(run_id: str) -> int:
    return db.scalar("SELECT COUNT(*) FROM jobs WHERE run_id=? AND status IN ('queued','running','waiting')", (run_id,))


def counts() -> dict:
    return {r["status"]: r["n"] for r in db.rows("SELECT status, COUNT(*) n FROM jobs GROUP BY status")}

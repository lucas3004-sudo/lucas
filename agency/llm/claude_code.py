"""Claude Code exchange: tasks are written to data/claude_code/inbox/<task_id>.json; a Claude Code session
(skill `agency-run-tasks`) answers them with `python -m agency cc submit`, which resumes the waiting job.
Token figures here are ESTIMATES (chars/3.5): Claude Code does not report per-task usage to the backend."""
from __future__ import annotations

import json
from pathlib import Path

from .. import db, queue
from ..config import load_env
from ..events import activity
from . import pricing
from .gateway import Task, record
from .schema import validate


def _inbox() -> Path:
    return load_env().cc_dir / "inbox"


def _outbox() -> Path:
    return load_env().cc_dir / "outbox"


def request(task: Task, job: dict | None) -> dict:
    if job is None:
        raise queue.PermanentError("claude_code mode requires a queued job")
    done = (job.get("payload") or {}).get("_external", {}).get(task.key)
    if done is not None:
        done["_generated_by"] = "claude-code"
        return done
    task_id = f"{job['id']}__{task.key}"
    (_inbox() / f"{task_id}.json").write_text(db.dumps({
        "task_id": task_id, "job_id": job["id"], "agent": task.agent, "task": task.name, "tier": task.tier,
        "instructions": task.instructions, "input": task.input, "schema": task.schema, "created_at": db.now(),
    }), encoding="utf-8")
    activity(task.agent, "cc_task_created", task_id)
    raise queue.ExternalPending(task_id)


def list_tasks() -> list[dict]:
    out = []
    for f in sorted(_inbox().glob("*.json")):
        t = json.loads(f.read_text(encoding="utf-8"))
        out.append({k: t[k] for k in ("task_id", "agent", "task", "tier", "created_at")})
    return out


def get_task(task_id: str) -> dict:
    f = _inbox() / f"{Path(task_id).name}.json"
    if not f.is_file():
        raise KeyError(task_id)
    return json.loads(f.read_text(encoding="utf-8"))


def submit(task_id: str, data: dict) -> dict:
    task_id = Path(task_id).name  # never let an id escape the inbox
    t = get_task(task_id)
    errors = validate(data, t["schema"])
    if errors:
        return {"ok": False, "errors": errors[:20]}
    job = db.one("SELECT payload FROM jobs WHERE id=?", (t["job_id"],))
    if not job:
        return {"ok": False, "errors": ["job not found"]}
    external = db.loads(job["payload"], {}).get("_external", {})
    external[f"{t['agent']}.{t['task']}"] = data
    if not queue.resume(t["job_id"], {"_external": external}):
        return {"ok": False, "errors": ["job is not waiting"]}
    in_t = pricing.estimate_tokens(t["instructions"] + json.dumps(t["input"], ensure_ascii=False))
    out_t = pricing.estimate_tokens(json.dumps(data, ensure_ascii=False))
    record(Task(t["agent"], t["task"], t["tier"], "", {}, {}), {"id": t["job_id"]}, "claude_code", "claude-code-session",
           {"input": in_t, "output": out_t}, 0.0, "estimated", "n/a", 0)
    (_inbox() / f"{task_id}.json").unlink(missing_ok=True)
    activity(t["agent"], "cc_task_submitted", task_id)
    return {"ok": True}


def ingest_outbox() -> int:
    """Alternative channel: a session may drop <task_id>.json results in data/claude_code/outbox/."""
    n = 0
    for f in sorted(_outbox().glob("*.json")):
        try:
            res = submit(f.stem, json.loads(f.read_text(encoding="utf-8")))
        except (KeyError, ValueError) as e:
            res = {"ok": False, "errors": [str(e)]}
        f.rename(f.with_suffix(".done" if res["ok"] else ".rejected"))
        n += res["ok"]
    return n

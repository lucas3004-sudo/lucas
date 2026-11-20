"""Agency & agent lifecycle: launch / pause / resume / stop, per-agent pause/stop/restart, run finalisation."""
from __future__ import annotations

from . import db, queue
from .agents.specs import AGENTS
from .events import activity, notify


def state() -> dict:
    return db.one("SELECT * FROM agency_state WHERE id=1")


def _set(status: str, run_id: str | None = ...) -> None:
    data = {"status": status, "updated_at": db.now()}
    if run_id is not ...:
        data["current_run_id"] = run_id
    db.update("agency_state", "id", 1, data)


def ensure_agents() -> None:
    for aid in AGENTS:
        db.execute("INSERT OR IGNORE INTO agents(id, status, updated_at) VALUES (?, 'active', ?)", (aid, db.now()))


def agent_statuses() -> dict[str, str]:
    return {r["id"]: r["status"] for r in db.rows("SELECT id, status FROM agents")}


def blocked_agents() -> set[str]:
    return {a for a, s in agent_statuses().items() if s != "active"}


def launch(trigger: str = "manual", params: dict | None = None) -> dict:
    st = state()
    if st["status"] == "running" and st["current_run_id"] and queue.open_jobs(st["current_run_id"]):
        return {"ok": False, "reason": "un run est déjà en cours", "run_id": st["current_run_id"]}
    run_id = db.new_id("RUN")
    db.insert("runs", {"id": run_id, "status": "running", "trigger": trigger, "params": db.dumps(params or {}), "started_at": db.now()})
    _set("running", run_id)
    queue.enqueue("orchestrator.plan", "orchestrator", params or {}, run_id=run_id, priority=10)
    activity("user" if trigger == "manual" else "scheduler", "agency_launched", run_id)
    return {"ok": True, "run_id": run_id}


def pause() -> dict:
    _set("paused")
    activity("user", "agency_paused")
    return state()


def resume() -> dict:
    _set("running")
    activity("user", "agency_resumed")
    return state()


def stop() -> dict:
    st = state()
    cancelled = queue.cancel_run(st["current_run_id"]) if st["current_run_id"] else 0
    if st["current_run_id"]:
        db.update("runs", "id", st["current_run_id"], {"status": "stopped", "finished_at": db.now()})
    _set("stopped")
    activity("user", "agency_stopped", st["current_run_id"], {"cancelled_jobs": cancelled})
    return {**state(), "cancelled_jobs": cancelled}


def set_agent(agent_id: str, action: str) -> dict:
    if agent_id not in AGENTS:
        raise KeyError(agent_id)
    status = {"pause": "paused", "stop": "stopped", "resume": "active", "restart": "active"}[action]
    db.update("agents", "id", agent_id, {"status": status, "updated_at": db.now()})
    requeued = 0
    if action == "restart":
        requeued = db.execute("UPDATE jobs SET status='queued', attempts=0, run_after=?, last_error=NULL, updated_at=? "
                              "WHERE agent=? AND status IN ('failed','dead')", (db.now(), db.now(), agent_id))
    if action == "stop":
        db.execute("UPDATE jobs SET status='cancelled', updated_at=? WHERE agent=? AND status='queued'", (db.now(), agent_id))
    activity("user", f"agent_{action}", agent_id, {"requeued": requeued})
    return {"agent": agent_id, "status": status, "requeued": requeued}


def maybe_finalize_run(run_id: str | None) -> None:
    if not run_id or queue.open_jobs(run_id):
        return
    run = db.one("SELECT * FROM runs WHERE id=?", (run_id,))
    if not run or run["status"] != "running":
        return
    by_status = {r["status"]: r["n"] for r in db.rows("SELECT status, COUNT(*) n FROM contents WHERE run_id=? GROUP BY status", (run_id,))}
    failed_jobs = db.scalar("SELECT COUNT(*) FROM jobs WHERE run_id=? AND status IN ('failed','dead')", (run_id,))
    summary = {"contents": by_status, "failed_jobs": failed_jobs}
    db.update("runs", "id", run_id, {"status": "completed", "finished_at": db.now(), "summary": db.dumps(summary)})
    if state()["current_run_id"] == run_id and state()["status"] == "running":
        _set("running")  # agency keeps running (community, scheduler); run is closed
    activity("orchestrator", "run_completed", run_id, summary)
    waiting = by_status.get("awaiting_approval", 0)
    assets = by_status.get("waiting_assets", 0)
    notify("Run terminé", f"{waiting} contenu(s) à valider, {assets} en attente de visuels, {failed_jobs} tâche(s) en échec.",
           "info", "#/daily")

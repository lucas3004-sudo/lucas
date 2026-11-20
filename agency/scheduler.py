"""Scheduler: fires recurring jobs (spec `every:<s>` or `daily:HH:MM` in local tz) and due publications."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import db, queue
from .config import load_env
from .events import activity

DEFAULT_SCHEDULES = [
    # name, job_type, agent, spec, enabled
    ("Rapport quotidien", "analyst.daily_brief", "analyst", "daily:21:00", 1),
    ("Tri des messages", "community.triage", "community", "every:3600", 1),
    ("Apprentissage performances", "analyst.learn", "analyst", "daily:06:30", 1),
    ("Autopilote : lancer l'agence", "orchestrator.autolaunch", "orchestrator", "daily:08:00", 0),
    ("Veille santé des comptes", "analyst.watch", "analyst", "every:3600", 1),
    ("Revue stratégique hebdo", "analyst.weekly_review", "analyst", "weekly:0:08:30", 1),
    ("To-do du matin", "analyst.morning_todo", "analyst", "daily:07:45", 1),
]


def next_run(spec: str, after: datetime | None = None) -> str:
    after = after or datetime.now(timezone.utc)
    kind, _, arg = spec.partition(":")
    if kind == "every":
        return (after + timedelta(seconds=max(int(arg), 60))).isoformat(timespec="seconds")
    if kind == "daily":
        tz = ZoneInfo(load_env().timezone)
        hh, mm = (int(x) for x in arg.split(":"))
        local = after.astimezone(tz)
        cand = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand <= local:
            cand += timedelta(days=1)
        return cand.astimezone(timezone.utc).isoformat(timespec="seconds")
    if kind == "weekly":  # weekly:<0=Monday..6>:HH:MM (local tz)
        dow, hhmm = arg.split(":", 1)
        tz = ZoneInfo(load_env().timezone)
        hh, mm = (int(x) for x in hhmm.split(":"))
        local = after.astimezone(tz)
        cand = (local + timedelta(days=(int(dow) - local.weekday()) % 7)).replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand <= local:
            cand += timedelta(days=7)
        return cand.astimezone(timezone.utc).isoformat(timespec="seconds")
    raise ValueError(f"unknown schedule spec: {spec}")


def seed_defaults() -> None:
    for name, job_type, agent, spec, enabled in DEFAULT_SCHEDULES:
        if not db.one("SELECT 1 FROM schedules WHERE job_type=?", (job_type,)):
            db.insert("schedules", {"id": db.new_id("SCH"), "name": name, "job_type": job_type, "agent": agent,
                                    "payload": "{}", "spec": spec, "next_run_at": next_run(spec), "enabled": enabled})


def tick() -> dict:
    """One scheduler pass. Safe to call from several processes (claims each schedule atomically)."""
    fired, published = 0, 0
    ts = db.now()
    for s in db.rows("SELECT * FROM schedules WHERE enabled=1 AND next_run_at<=?", (ts,)):
        claimed = db.execute("UPDATE schedules SET next_run_at=?, last_run_at=? WHERE id=? AND next_run_at=?",
                             (next_run(s["spec"]), ts, s["id"], s["next_run_at"]))
        if claimed:
            queue.enqueue(s["job_type"], s["agent"], db.loads(s["payload"], {}))
            fired += 1
    for c in db.rows("SELECT id, run_id FROM contents WHERE status='scheduled' AND scheduled_at<=? AND "
                     "(account_id IS NULL OR account_id IN (SELECT id FROM accounts WHERE status='active'))", (ts,)):
        if db.execute("UPDATE contents SET status='ready_to_publish', stage='publication', updated_at=? WHERE id=? AND status='scheduled'",
                      (ts, c["id"])):
            queue.enqueue("publisher.prepare", "planner", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
            published += 1
    from .llm.claude_code import ingest_outbox  # local import: avoid cycle
    ingested = ingest_outbox()
    if fired or published or ingested:
        activity("scheduler", "tick", details={"fired": fired, "publications_due": published, "cc_ingested": ingested})
    return {"fired": fired, "publications_due": published, "cc_ingested": ingested}

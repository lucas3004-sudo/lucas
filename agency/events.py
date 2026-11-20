"""Activity log + notifications (in-app, optional webhook)."""
from __future__ import annotations

import logging

import httpx

from . import db
from .config import load_env

log = logging.getLogger("agency")


def activity(actor: str, action: str, entity: str | None = None, details: dict | str | None = None, level: str = "info") -> None:
    if isinstance(details, dict):
        details = db.dumps(details)
    db.insert("activity_log", {"at": db.now(), "level": level, "actor": actor, "action": action, "entity": entity, "details": details})
    getattr(log, "warning" if level == "warn" else level if level in ("info", "error") else "info")("%s %s %s", actor, action, entity or "")


def history(content_id: str, actor: str, action: str, details: dict | str | None = None) -> None:
    if isinstance(details, dict):
        details = db.dumps(details)
    db.insert("content_history", {"content_id": content_id, "at": db.now(), "actor": actor, "action": action, "details": details})


def notify(title: str, body: str = "", level: str = "info", link: str | None = None) -> None:
    db.insert("notifications", {"at": db.now(), "level": level, "title": title, "body": body, "link": link})
    env = load_env()
    if not env.notify_webhook_url:
        return
    text = f"[{level.upper()}] {title}" + (f"\n{body}" if body else "")
    payload = {"discord": {"content": text[:1900]}, "slack": {"text": text}}.get(
        env.notify_webhook_format, {"title": title, "body": body, "level": level, "link": link}
    )
    try:
        httpx.post(env.notify_webhook_url, json=payload, timeout=10).raise_for_status()
        db.execute("UPDATE notifications SET delivered=? WHERE id=(SELECT MAX(id) FROM notifications)", (db.now(),))
    except httpx.HTTPError as e:  # best effort: never break the pipeline for a notification
        activity("system", "notify_webhook_failed", details=str(e)[:200], level="warn")

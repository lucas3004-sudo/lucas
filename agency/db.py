"""SQLite access layer (WAL, one connection per thread). SQL kept portable for a later Postgres move."""
from __future__ import annotations

import json
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import DEFAULT_SETTINGS, load_env

MIGRATIONS = Path(__file__).parent / "migrations"
_local = threading.local()
_db_path: Path | None = None
_init_lock = threading.Lock()


def now(delta_s: float = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=delta_s)).isoformat(timespec="seconds")


def parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def new_id(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3)}"


def dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True)


def loads(v: str | None, default: Any = None) -> Any:
    if v is None or v == "":
        return default
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return default


def configure(path: Path | None = None) -> Path:
    """Select DB file (tests pass a tmp path) and apply migrations."""
    global _db_path
    with _init_lock:
        _db_path = Path(path) if path else load_env().db_path
        _db_path.parent.mkdir(parents=True, exist_ok=True)
        _local.__dict__.clear()
        migrate(conn())
    return _db_path


def conn() -> sqlite3.Connection:
    if _db_path is None:
        configure()
    c = getattr(_local, "conn", None)
    if c is None or getattr(_local, "path", None) != _db_path:
        c = sqlite3.connect(_db_path, timeout=30, isolation_level=None, check_same_thread=False)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA busy_timeout=30000")
        _local.conn, _local.path = c, _db_path
    return c


def migrate(c: sqlite3.Connection) -> None:
    c.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    done = {r[0] for r in c.execute("SELECT name FROM schema_migrations")}
    for f in sorted(MIGRATIONS.glob("*.sql")):
        if f.name in done:
            continue
        c.executescript("BEGIN;" + f.read_text(encoding="utf-8") + ";COMMIT;")
        c.execute("INSERT INTO schema_migrations VALUES (?, ?)", (f.name, now()))


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    c = conn()
    c.execute("BEGIN IMMEDIATE")
    try:
        yield c
        c.execute("COMMIT")
    except BaseException:
        c.execute("ROLLBACK")
        raise


def rows(sql: str, params: tuple | list = ()) -> list[dict]:
    return [dict(r) for r in conn().execute(sql, params).fetchall()]


def one(sql: str, params: tuple | list = ()) -> dict | None:
    r = conn().execute(sql, params).fetchone()
    return dict(r) if r else None


def scalar(sql: str, params: tuple | list = ()) -> Any:
    r = conn().execute(sql, params).fetchone()
    return r[0] if r else None


def execute(sql: str, params: tuple | list = ()) -> int:
    return conn().execute(sql, params).rowcount


def insert(table: str, data: dict) -> None:
    cols = ",".join(data)
    conn().execute(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(data))})", list(data.values()))


def update(table: str, key: str, key_value: Any, data: dict) -> int:
    sets = ",".join(f"{k}=?" for k in data)
    return conn().execute(f"UPDATE {table} SET {sets} WHERE {key}=?", [*data.values(), key_value]).rowcount


# --- runtime settings -------------------------------------------------------
def get_settings() -> dict:
    stored = {r["key"]: loads(r["value"]) for r in rows("SELECT key, value FROM settings")}
    merged = {**DEFAULT_SETTINGS, **stored}
    if not merged.get("llm_mode"):
        merged["llm_mode"] = load_env().llm_mode
    return merged


def setting(key: str) -> Any:
    return get_settings().get(key)


def set_settings(values: dict) -> dict:
    with tx() as c:
        for k, v in values.items():
            c.execute(
                "INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                (k, dumps(v), now()),
            )
    return get_settings()

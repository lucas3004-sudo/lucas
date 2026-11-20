"""File storage (local disk under data/storage; swap for S3/R2 by reimplementing these 3 functions)."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from . import db
from .config import load_env

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".mp3", ".wav", ".m4a"}


def abs_path(rel: str) -> Path:
    root = load_env().storage_dir.resolve()
    p = (root / rel).resolve()
    if root not in p.parents:
        raise ValueError("path escapes storage")
    return p


def new_path(folder: str, ext: str) -> tuple[str, Path]:
    rel = f"{folder}/{db.new_id('F')}{ext.lower()}"
    p = abs_path(rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    return rel, p


def register(rel: str, kind: str, source: str, content_id: str | None = None, character_id: str | None = None,
             meta: dict | None = None, approved: bool = False) -> dict:
    p = abs_path(rel)
    asset = {"id": db.new_id("AST"), "content_id": content_id, "character_id": character_id, "kind": kind, "path": rel,
             "mime": mimetypes.guess_type(p.name)[0] or "application/octet-stream", "size": p.stat().st_size,
             "source": source, "approved": int(approved), "meta": db.dumps(meta or {}), "created_at": db.now()}
    db.insert("assets", asset)
    return asset


def save_bytes(data: bytes, folder: str, ext: str, kind: str, source: str, **kw) -> dict:
    rel, p = new_path(folder, ext)
    p.write_bytes(data)
    return register(rel, kind, source, **kw)


def content_assets(content_id: str) -> list[dict]:
    return db.rows("SELECT * FROM assets WHERE content_id=? ORDER BY created_at", (content_id,))

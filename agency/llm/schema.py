"""Tiny JSON-schema helpers (strict-compatible: additionalProperties false, all keys required)."""
from __future__ import annotations

from typing import Any


def obj(**props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


def arr(items: dict, max_items: int | None = None) -> dict:
    a = {"type": "array", "items": items}
    if max_items:
        a["maxItems"] = max_items
    return a


S = {"type": "string"}
N = {"type": "number"}
I = {"type": "integer"}
B = {"type": "boolean"}


def enum(*values: str) -> dict:
    return {"type": "string", "enum": list(values)}


_TYPES = {"object": dict, "array": list, "string": str, "integer": int, "number": (int, float), "boolean": bool}


def validate(data: Any, schema: dict, path: str = "$") -> list[str]:
    """Minimal validator for results coming back from Claude Code sessions."""
    errs: list[str] = []
    t = schema.get("type")
    if t and not isinstance(data, _TYPES[t]) or (t in ("integer", "number") and isinstance(data, bool)):
        return [f"{path}: expected {t}"]
    if "enum" in schema and data not in schema["enum"]:
        errs.append(f"{path}: must be one of {schema['enum']}")
    if t == "object":
        for k in schema.get("required", []):
            if k not in data:
                errs.append(f"{path}.{k}: missing")
        for k, sub in schema.get("properties", {}).items():
            if k in data:
                errs += validate(data[k], sub, f"{path}.{k}")
    if t == "array":
        for i, item in enumerate(data):
            errs += validate(item, schema.get("items", {}), f"{path}[{i}]")
    return errs

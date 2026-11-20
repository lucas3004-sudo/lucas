"""LLM Gateway: single entry point for every agent call.

Modes (setting `llm_mode`, per-agent override in `agent_modes`):
  offline      deterministic templates, zero cost (default)
  claude_code  task written to data/claude_code/inbox, processed by a Claude Code session (Pro quota)
  api          Anthropic API, model routing + caching + hard budget caps; needs allow_paid_calls=True
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

from .. import db
from ..config import load_env
from ..events import activity
from ..queue import PermanentError
from . import pricing

CORE_RULES = """You are an agent of "AI Agency OS", a content agency for a transparently AI-generated virtual creator.
Hard rules (never break them):
- Non-explicit content only: no nudity, sexual content, sexual innuendo aimed at selling, or adult-platform promotion.
- The creator is an AI character: never claim or imply she is a real human. Keep AI disclosure.
- The character is an adult; never depict or suggest a minor. Never imitate a real person's face, name or brand.
- Never invent numbers, statistics, testimonials or sources. Unknown data = "unknown". Label hypotheses as hypotheses.
- Respect TikTok/Instagram community guidelines. Do not copy competitors; extract patterns only.
- Output ONLY the JSON requested by the schema. Be concise: short strings, no filler."""


@dataclass
class Task:
    agent: str
    name: str
    tier: str  # simple | standard | complex
    instructions: str
    input: dict
    schema: dict
    max_tokens: int = 2000
    meta: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.agent}.{self.name}"


def character_block() -> str:
    from ..agents.character import active_character, compact_bible
    return compact_bible(active_character())


def mode_for(agent: str) -> str:
    s = db.get_settings()
    return (s.get("agent_modes") or {}).get(agent) or s.get("llm_mode") or load_env().llm_mode


def record(task: Task, job: dict | None, provider: str, model: str | None, usage: dict, cost_usd: float,
           token_prov: str, cost_prov: str, latency_ms: int, status: str = "ok", error: str | None = None) -> None:
    db.insert("llm_calls", {
        "at": db.now(), "agent": task.agent, "job_id": job["id"] if job else None, "task": task.name,
        "provider": provider, "model": model, "input_tokens": usage.get("input", 0), "output_tokens": usage.get("output", 0),
        "cache_read_tokens": usage.get("cache_read", 0), "cache_write_tokens": usage.get("cache_write", 0),
        "cost_usd": cost_usd, "token_provenance": token_prov, "cost_provenance": cost_prov,
        "latency_ms": latency_ms, "status": status, "error": error,
    })


def run(task: Task, job: dict | None, offline: Callable[[], dict]) -> dict:
    mode = mode_for(task.agent)
    if mode == "claude_code":
        from . import claude_code
        return claude_code.request(task, job)  # returns result or raises ExternalPending
    if mode == "api":
        from . import anthropic_api
        ok, reason = anthropic_api.can_call(task)
        if ok:
            return anthropic_api.call(task, job)
        if not db.setting("fallback_to_offline"):
            raise PermanentError(f"API call blocked: {reason}")
        activity(task.agent, "llm_fallback_offline", job["id"] if job else None, {"task": task.name, "reason": reason}, "warn")
    t0 = time.monotonic()
    data = offline()
    data["_generated_by"] = "offline-template"
    record(task, job, "offline", None, {}, 0.0, "n/a", "n/a", int((time.monotonic() - t0) * 1000))
    return data

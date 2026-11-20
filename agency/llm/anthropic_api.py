"""Anthropic API provider. Implemented from the official SDK docs; NOT yet exercised against the live API
(no key in this environment) - see docs/KNOWN_ISSUES in docs/RESUME.md."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from .. import db
from ..config import has_secret, load_env, secret
from ..queue import PermanentError
from . import pricing
from .gateway import CORE_RULES, Task, character_block, record

FALLBACK_MODELS = ("claude-opus-5-5", "claude-sonnet-5-5")  # server-side refusal fallback supported


def _period_start(kind: str) -> str:
    local = datetime.now(timezone.utc).astimezone(ZoneInfo(load_env().timezone))
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    if kind == "month":
        start = start.replace(day=1)
    return start.astimezone(timezone.utc).isoformat(timespec="seconds")


def spent(kind: str) -> float:
    return db.scalar("SELECT COALESCE(SUM(cost_usd),0) FROM llm_calls WHERE provider='anthropic' AND at>=?", (_period_start(kind),)) or 0.0


def model_for(tier: str) -> str:
    return (db.setting("model_routing") or {}).get(tier, "claude-haiku-5-5")


def worst_case_cost(task: Task) -> float:
    model = model_for(task.tier)
    text = CORE_RULES + character_block() + task.instructions + json.dumps(task.input, ensure_ascii=False)
    return pricing.cost(model, pricing.estimate_tokens(text), task.max_tokens)


def can_call(task: Task) -> tuple[bool, str]:
    s = db.get_settings()
    if not s.get("allow_paid_calls"):
        return False, "paid calls disabled (Settings > allow_paid_calls)"
    if not has_secret("ANTHROPIC_API_KEY"):
        return False, "ANTHROPIC_API_KEY missing"
    est = worst_case_cost(task)
    if spent("day") + est > float(s["daily_budget_usd"]):
        return False, f"daily budget reached ({s['daily_budget_usd']} USD)"
    if spent("month") + est > float(s["monthly_budget_usd"]):
        return False, f"monthly budget reached ({s['monthly_budget_usd']} USD)"
    return True, "ok"


def call(task: Task, job: dict | None) -> dict:
    import anthropic  # optional dependency: pip install .[api]

    client = anthropic.Anthropic(api_key=secret("ANTHROPIC_API_KEY"), max_retries=2)
    model = model_for(task.tier)
    kwargs = dict(
        model=model,
        max_tokens=task.max_tokens,
        # Stable shared prefix first (cacheable across all agents), then agent-specific instructions.
        system=[
            {"type": "text", "text": CORE_RULES + "\n\n" + character_block(), "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": task.instructions},
        ],
        messages=[{"role": "user", "content": db.dumps(task.input)}],
        output_config={"format": {"type": "json_schema", "schema": task.schema}, "effort": pricing.EFFORT.get(task.tier, "low")},
    )
    t0 = time.monotonic()
    try:
        if model in FALLBACK_MODELS:
            resp = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
        else:
            resp = client.messages.create(**kwargs)
    except (anthropic.BadRequestError, anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.NotFoundError) as e:
        record(task, job, "anthropic", model, {}, 0.0, "n/a", "n/a", int((time.monotonic() - t0) * 1000), "error", str(e)[:300])
        raise PermanentError(f"Anthropic API error: {e}") from e
    # RateLimitError / APIConnectionError / 5xx propagate -> queue retries with backoff.
    latency = int((time.monotonic() - t0) * 1000)
    u = resp.usage
    usage = {"input": u.input_tokens or 0, "output": u.output_tokens or 0,
             "cache_read": getattr(u, "cache_read_input_tokens", 0) or 0, "cache_write": getattr(u, "cache_creation_input_tokens", 0) or 0}
    served = getattr(resp, "model", model) or model
    c = pricing.cost(served, usage["input"], usage["output"], usage["cache_read"], usage["cache_write"])
    if resp.stop_reason in ("refusal", "max_tokens"):
        record(task, job, "anthropic", served, usage, c, "measured", "estimated", latency, "error", resp.stop_reason)
        raise PermanentError(f"model stop_reason={resp.stop_reason}")
    record(task, job, "anthropic", served, usage, c, "measured", "estimated", latency)
    text = next(b.text for b in resp.content if b.type == "text")
    data = json.loads(text)
    data["_generated_by"] = f"anthropic:{served}"
    return data

"""Token & usage monitoring + optimisation hints (Token Optimization role of the Analyst).
Provenance: API usage fields = measured; Claude Code transcripts = measured (local logs); chars/3.5 = estimated;
costs = estimated from public prices (a Pro subscription is not billed per token: shown as 'API-equivalent')."""
from __future__ import annotations

import json
from pathlib import Path

from . import db
from .llm import pricing


def summary(days: int = 30) -> dict:
    since = db.now(-days * 86400)
    tot = db.one("SELECT COUNT(*) calls, COALESCE(SUM(input_tokens),0) input, COALESCE(SUM(output_tokens),0) output, "
                 "COALESCE(SUM(cache_read_tokens),0) cache_read, COALESCE(SUM(cache_write_tokens),0) cache_write, "
                 "COALESCE(SUM(cost_usd),0) cost FROM llm_calls WHERE at>=?", (since,))
    group = lambda col: db.rows(  # noqa: E731
        f"SELECT {col} k, provider, token_provenance prov, COUNT(*) calls, SUM(input_tokens) input, SUM(output_tokens) output, "
        f"SUM(cost_usd) cost FROM llm_calls WHERE at>=? GROUP BY {col}, provider, prov ORDER BY SUM(input_tokens+output_tokens) DESC", (since,))
    daily = db.rows("SELECT substr(at,1,10) day, SUM(input_tokens+output_tokens) tokens, SUM(cost_usd) cost, COUNT(*) calls "
                    "FROM llm_calls WHERE at>=? GROUP BY day ORDER BY day", (since,))
    cc = db.rows("SELECT session_id, model, MIN(at) first, MAX(at) last, COUNT(*) messages, SUM(input_tokens) input, "
                 "SUM(output_tokens) output, SUM(cache_read_tokens) cache_read, SUM(cache_write_tokens) cache_write "
                 "FROM cc_usage WHERE at>=? GROUP BY session_id, model ORDER BY last DESC LIMIT 20", (since,))
    for s in cc:
        s["api_equivalent_usd"] = pricing.cost(s["model"] or "", s["input"] or 0, s["output"] or 0, s["cache_read"] or 0, s["cache_write"] or 0)
    ext = db.rows("SELECT service, operation, unit, SUM(units) units, provenance FROM api_usage WHERE at>=? GROUP BY service, operation, unit, provenance", (since,))
    s = db.get_settings()
    return {"period_days": days, "totals": tot, "by_agent": group("agent"), "by_task": group("task"), "by_model": group("model"),
            "daily": daily, "claude_code_sessions": cc, "external_apis": ext, "mode": s["llm_mode"],
            "budget": {"daily_usd": s["daily_budget_usd"], "monthly_usd": s["monthly_budget_usd"], "paid_calls_allowed": s["allow_paid_calls"]},
            "prices_as_of": pricing.PRICES_AS_OF, "suggestions": suggestions(tot, cc)}


def suggestions(tot: dict, cc: list[dict]) -> list[str]:
    out = []
    s = db.get_settings()
    api_calls = db.one("SELECT COUNT(*) n, COALESCE(SUM(cache_read_tokens),0) cr, COALESCE(SUM(input_tokens),0) i "
                       "FROM llm_calls WHERE provider='anthropic'")
    if api_calls["n"] >= 10 and api_calls["cr"] < 0.2 * (api_calls["i"] + api_calls["cr"]):
        out.append("Peu de cache lu sur l'API : vérifier que le bloc système partagé (règles + personnage) ne change pas entre appels.")
    heavy = db.one("SELECT model, COUNT(*) n FROM llm_calls WHERE provider='anthropic' AND task IN ('optimize','triage','build','challenge') "
                   "AND model NOT LIKE '%haiku%' GROUP BY model ORDER BY n DESC LIMIT 1")
    if heavy:
        out.append(f"Tâches simples routées vers {heavy['model']} : passer le palier 'simple' sur claude-haiku-5-5.")
    if s["llm_mode"] == "api" and not s["allow_paid_calls"]:
        out.append("Mode api sélectionné mais appels payants désactivés : tout tourne en hors ligne (repli).")
    for sess in cc[:5]:
        total_in = (sess["input"] or 0) + (sess["cache_read"] or 0)
        if total_in > 2_000_000:
            out.append(f"Session Claude Code {str(sess['session_id'])[:8]} : contexte très lu ({total_in:,} tokens). "
                       "Faire /compact entre les phases et /clear entre tâches sans rapport.")
            break
    if not out:
        out.append("Aucune anomalie détectée. Garder : mode offline/claude_code par défaut, Haiku pour les tâches simples.")
    return out


def import_claude_code(root: Path | None = None, project_filter: str = "") -> dict:
    """Parse local Claude Code transcripts (read-only). Works on the machine where Claude Code runs."""
    root = root or Path.home() / ".claude" / "projects"
    if not root.is_dir():
        return {"imported": 0, "files": 0, "note": f"{root} introuvable sur cette machine"}
    files, best = 0, {}
    for f in root.glob("*/*.jsonl"):
        if project_filter and project_filter not in f.parent.name:
            continue
        files += 1
        with f.open(encoding="utf-8", errors="replace") as fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                m = d.get("message")
                if d.get("type") != "assistant" or not isinstance(m, dict) or not m.get("usage") or not m.get("id"):
                    continue
                u = m["usage"]
                row = {"message_id": m["id"], "session_id": d.get("sessionId"), "project": f.parent.name, "model": m.get("model"),
                       "at": d.get("timestamp") or db.now(), "input_tokens": u.get("input_tokens") or 0,
                       "output_tokens": u.get("output_tokens") or 0, "cache_read_tokens": u.get("cache_read_input_tokens") or 0,
                       "cache_write_tokens": u.get("cache_creation_input_tokens") or 0, "imported_at": db.now()}
                prev = best.get(m["id"])  # streamed messages appear several times: keep the most complete
                if not prev or row["output_tokens"] >= prev["output_tokens"]:
                    best[m["id"]] = row
    with db.tx() as c:
        for r in best.values():
            c.execute("INSERT OR REPLACE INTO cc_usage VALUES (:message_id,:session_id,:project,:model,:at,:input_tokens,"
                      ":output_tokens,:cache_read_tokens,:cache_write_tokens,:imported_at)", r)
    return {"imported": len(best), "files": files}

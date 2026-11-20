"""Growth intelligence - "the data decides the allocation, the LLM decides the creativity". Deterministic, zero tokens.

- performance index = views / median views of the same platform (>= 3 measured contents), "win" = index >= 1
- Thompson-sampling bandit over pillars and (platform, format) -> content mix of each run (explore + exploit)
- double-down: contents with index >= threshold get a follow-up brief (part 2 / remake), once
- A/B experiments: Beta-Binomial on interactions/views, Monte Carlo P(B > A), conclusion only with enough data
- best posting slots, reach-drop / posting-gap / backlog anomalies, target forecasts (linear trend)
Every output keeps the provenance of the underlying numbers (metrics are manual unless an API feeds them)."""
from __future__ import annotations

import math
import random
import statistics
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import db
from .config import PLATFORMS, load_env

PIPELINE_STATUSES = ("in_progress", "waiting_assets", "awaiting_approval", "approved", "scheduled", "ready_to_publish")
EXPERIMENT_MENU = [  # (variable, A, B) - only variables the pipeline can actually control
    ("hook_type", "question", "liste"),
    ("duration", "court", "long"),
    ("hook_type", "transparence", "pov"),
    ("hook_type", "défi", "rapide"),
]
DURATIONS = {"court": (10, 15), "long": (25, 35)}


def _tz() -> ZoneInfo:
    return ZoneInfo(load_env().timezone)


# --- performance ------------------------------------------------------------------
def performance() -> list[dict]:
    rows = db.rows(
        "SELECT c.id, c.title, c.hook, c.platform, c.format, c.pillar, c.meta, c.series_id, c.account_id, c.published_at, "
        "m.views, m.likes, m.comments, m.shares, m.saves, m.avg_watch_s, m.completion_rate, m.followers_delta, m.provenance, m.date, c.deal_id "
        "FROM contents c JOIN metrics m ON m.content_id = c.id "
        "WHERE m.id IN (SELECT MAX(id) FROM metrics WHERE content_id IS NOT NULL GROUP BY content_id)")
    views_by_platform: dict[str, list[int]] = {}
    for r in rows:
        views_by_platform.setdefault(r["platform"], []).append(r["views"] or 0)
    med = {p: statistics.median(v) for p, v in views_by_platform.items() if len(v) >= 3}
    out = []
    for r in rows:
        meta = db.loads(r.pop("meta"), {})
        v = r["views"] or 0
        inter = sum(r[k] or 0 for k in ("likes", "comments", "shares", "saves"))
        brief = meta.get("brief", {})
        out.append({**r, "interactions": inter, "er": round(inter / v, 4) if v else None,
                    "perf_index": round(v / med[r["platform"]], 2) if med.get(r["platform"]) else None,
                    "sample": len(views_by_platform[r["platform"]]),
                    "hook_type": brief.get("hook_type"), "experiment": meta.get("experiment"), "variant_of": meta.get("variant_of"), "follow_up": bool(meta.get("follow_up_of")),
                    "doubled_down": bool(meta.get("doubled_down"))})
    return out


def winners(threshold: float | None = None) -> list[dict]:
    t = threshold or float(db.setting("double_down_index") or 2.0)
    return sorted((p for p in performance() if p["perf_index"] and p["perf_index"] >= t and not p["doubled_down"] and not p["variant_of"]),
                  key=lambda p: -p["perf_index"])


# --- bandit allocation -----------------------------------------------------------
def arm_stats() -> dict:
    pillars: dict[str, list[int]] = {}
    formats: dict[str, list[int]] = {}
    for p in performance():
        if p["perf_index"] is None or p["variant_of"]:  # cross-posts are not independent samples
            continue
        win = int(p["perf_index"] >= 1)
        for key, store in ((p["pillar"] or "?", pillars), (f"{p['platform']}:{p['format']}", formats)):
            s = store.setdefault(key, [0, 0])
            s[0] += win
            s[1] += 1 - win
    fmt = lambda d: {k: {"wins": w, "losses": l, "posterior_mean": round((1 + w) / (2 + w + l), 3)} for k, (w, l) in d.items()}  # noqa: E731
    return {"pillars": fmt(pillars), "formats": fmt(formats)}


def allocate(n: int, platforms: list[str], pillar_names: list[str], seed: str) -> list[dict]:
    """Thompson sampling: unseen arms get Beta(1,1) (exploration); winners are sampled more often (exploitation)."""
    rng = random.Random(seed)
    stats = arm_stats()
    cap = max(1, math.ceil(n / 2))
    used: dict[str, int] = {}
    slots = []
    for i in range(n):
        platform = platforms[i % len(platforms)]

        def draw(key: str, table: dict) -> float:
            s = table.get(key)
            return rng.betavariate(1 + (s["wins"] if s else 0), 1 + (s["losses"] if s else 0))

        choices = [p for p in pillar_names if used.get(p, 0) < cap] or pillar_names
        pillar = max(choices, key=lambda p: draw(p, stats["pillars"]))
        used[pillar] = used.get(pillar, 0) + 1
        fmt = max(PLATFORMS[platform]["formats"], key=lambda f: draw(f"{platform}:{f}", stats["formats"]))
        slots.append({"platform": platform, "pillar": pillar, "format": fmt})
    return slots


# --- experiments ---------------------------------------------------------------------
def current_experiment(run_id: str | None) -> dict:
    """Keep one experiment running until it is concluded; then rotate through the menu."""
    running = db.one("SELECT * FROM experiments WHERE status='running' ORDER BY created_at LIMIT 1")
    if running:
        return running
    done = {(r["variable"], r["variant_a"], r["variant_b"]) for r in db.rows("SELECT variable, variant_a, variant_b FROM experiments WHERE status IN ('concluded','dropped')")}
    var, a, b = next((m for m in EXPERIMENT_MENU if m not in done), EXPERIMENT_MENU[0])
    labels = {"hook_type": f"Un hook « {b} » performe mieux qu'un hook « {a} »",
              "duration": "Une vidéo longue (25-35 s) performe mieux qu'une vidéo courte (10-15 s)"}
    exp = {"id": db.new_id("EXP"), "hypothesis": labels[var], "variable": var, "variant_a": a, "variant_b": b,
           "metric": "interactions / vues", "status": "running", "run_id": run_id, "created_at": db.now(), "updated_at": db.now()}
    db.insert("experiments", exp)
    return exp


def evaluate_experiment(exp: dict, samples: int = 20000) -> dict:
    arms = {"A": [0, 0, 0], "B": [0, 0, 0]}  # interactions, views, contents
    for p in performance():
        e = p["experiment"] or {}
        if e.get("id") == exp["id"] and e.get("variant") in arms and not p["variant_of"]:
            a = arms[e["variant"]]
            a[0] += p["interactions"]
            a[1] += p["views"] or 0
            a[2] += 1
    (sa, va, na), (sb, vb, nb) = arms["A"], arms["B"]
    res = {"A": {"interactions": sa, "views": va, "contents": na, "er": round(sa / va, 4) if va else None},
           "B": {"interactions": sb, "views": vb, "contents": nb, "er": round(sb / vb, 4) if vb else None},
           "p_b_better": None, "lift": None, "decision": "collecte en cours"}
    min_views = int(db.setting("experiment_min_views") or 2000)
    if na < 2 or nb < 2 or va < min_views or vb < min_views:
        res["decision"] = f"données insuffisantes (≥ 2 contenus et ≥ {min_views} vues par variante)"
        return res
    rng = random.Random(exp["id"])
    wins = sum(rng.betavariate(1 + sb, 1 + vb - sb) > rng.betavariate(1 + sa, 1 + va - sa) for _ in range(samples))
    p = wins / samples
    res["p_b_better"] = round(p, 4)
    res["lift"] = round((sb / vb - sa / va) / (sa / va), 4) if sa else None
    if p >= 0.95:
        res["decision"] = f"B gagne ({exp['variant_b']})"
    elif p <= 0.05:
        res["decision"] = f"A gagne ({exp['variant_a']})"
    elif va >= 4 * min_views and vb >= 4 * min_views:
        res["decision"] = "pas de différence significative"
    return res


# --- slots, anomalies, targets, quotas -----------------------------------------------
def best_slots(platform: str) -> list[dict]:
    buckets: dict[tuple, list[float]] = {}
    for p in performance():
        if p["platform"] != platform or not p["published_at"] or p["perf_index"] is None:
            continue
        local = datetime.fromisoformat(p["published_at"]).astimezone(_tz())
        buckets.setdefault((local.hour // 2) * 2, []).append(p["perf_index"])
    ranked = [{"slot": f"{h:02d}:00-{h + 2:02d}:00", "avg_index": round(sum(v) / len(v), 2), "n": len(v)}
              for h, v in buckets.items() if len(v) >= 3]
    return sorted(ranked, key=lambda x: -x["avg_index"]) if len(ranked) >= 2 else []


def anomalies() -> list[dict]:
    out = []
    now = datetime.now(timezone.utc)
    perf = performance()
    for acc in db.rows("SELECT * FROM accounts"):
        if acc["status"] == "restricted":
            out.append({"key": f"restricted:{acc['id']}", "level": "error", "title": f"Compte restreint : {acc['handle']}",
                        "body": "Planification, déclinaisons et paquets de publication suspendus pour ce compte. Vérifiez les avertissements avant de repasser en « active ».",
                        "link": "#/accounts"})
            continue
        if acc["status"] != "active":
            continue
        mine = sorted((p for p in perf if p["account_id"] == acc["id"] and p["published_at"]), key=lambda p: p["published_at"])
        if len(mine) >= 6:
            recent = statistics.median(p["views"] or 0 for p in mine[-3:])
            before = statistics.median(p["views"] or 0 for p in mine[-13:-3])
            if before and recent < 0.5 * before:
                out.append({"key": f"drop:{acc['id']}:{mine[-1]['id']}", "level": "warn", "title": f"Chute de portée : {acc['handle']}",
                            "body": f"Médiane des 3 dernières vidéos {recent:.0f} vues vs {before:.0f} avant (−{(1 - recent / before):.0%}, données saisies). "
                                    "Vérifier : avertissement plateforme, contenu non conforme, fréquence, qualité du hook.", "link": "#/accounts"})
        last = db.scalar("SELECT MAX(published_at) FROM contents WHERE account_id=? AND status='published'", (acc["id"],))
        ref = datetime.fromisoformat(last or acc["created_at"])
        if acc["daily_quota"] > 0 and now - ref > timedelta(hours=48):
            out.append({"key": f"gap:{acc['id']}:{now:%Y%m%d}", "level": "warn", "title": f"Aucune publication depuis 48 h : {acc['handle']}",
                        "body": "La régularité compte : planifiez au moins un contenu.", "link": "#/calendar"})
    backlog = db.scalar("SELECT COUNT(*) FROM contents WHERE status='awaiting_approval'")
    if backlog > 5:
        out.append({"key": f"backlog:{now:%Y%m%d}", "level": "warn", "title": f"{backlog} contenus attendent votre validation",
                    "body": "Les créneaux se vident : validez ou rejetez.", "link": "#/daily"})
    return out


def quota_deficit(horizon_days: int = 3) -> dict[str, int] | None:
    platforms = db.setting("platforms") or []
    accs = db.rows("SELECT platform, SUM(daily_quota) q FROM accounts WHERE status='active' GROUP BY platform")
    quotas = {a["platform"]: a["q"] for a in accs if a["platform"] in platforms}
    if not quotas:
        return None
    marks = ",".join("?" * len(PIPELINE_STATUSES))
    out = {}
    for platform, q in quotas.items():
        in_pipe = db.scalar(f"SELECT COUNT(*) FROM contents WHERE platform=? AND parent_id IS NULL AND status IN ({marks})",
                            (platform, *PIPELINE_STATUSES))
        out[platform] = max(0, q * horizon_days - in_pipe)
    return out


def current_value(metric: str, account_id: str | None) -> tuple[float | None, str]:
    since = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    acc = "AND c.account_id=?" if account_id else ""
    args = (since, account_id) if account_id else (since,)
    if metric == "followers":
        r = db.one("SELECT value, provenance FROM account_events WHERE account_id=? AND kind='followers' ORDER BY at DESC LIMIT 1", (account_id,))
        return (r["value"], r["provenance"]) if r else (None, "n/a")
    if metric == "views_week":
        v = db.scalar(f"SELECT SUM(m.views) FROM metrics m JOIN contents c ON c.id=m.content_id WHERE m.date>=? {acc}", args)
        return v, "manual"
    if metric == "posts_week":
        return db.scalar(f"SELECT COUNT(*) FROM contents c WHERE c.status='published' AND c.published_at>=? {acc}", args), "manual"
    if metric == "er":
        ers = [p["er"] for p in performance() if p["er"] is not None and (not account_id or p["account_id"] == account_id)][-10:]
        return (round(sum(ers) / len(ers), 4) if ers else None), "manual"
    return None, "n/a"


def forecast_followers(account_id: str, deadline: str) -> dict | None:
    try:
        return _forecast(account_id, deadline)
    except (ValueError, TypeError):  # malformed legacy dates: no forecast rather than a crash
        return None


def _forecast(account_id: str, deadline: str) -> dict | None:
    pts = db.rows("SELECT at, value FROM account_events WHERE account_id=? AND kind='followers' AND value IS NOT NULL ORDER BY at", (account_id,))
    if len(pts) < 3:
        return None
    t0 = datetime.fromisoformat(pts[0]["at"])
    xs = [(datetime.fromisoformat(p["at"]) - t0).total_seconds() / 86400 for p in pts]
    ys = [p["value"] for p in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    den = sum((x - mx) ** 2 for x in xs)
    if not den:
        return None
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    d = datetime.fromisoformat(deadline)
    d = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    days = (d - t0).total_seconds() / 86400
    return {"per_day": round(slope, 2), "projected": round(my + slope * (days - mx)), "points": len(pts), "provenance": "forecast"}


def targets_progress() -> list[dict]:
    out = []
    for t in db.rows("SELECT t.*, a.handle FROM targets t LEFT JOIN accounts a ON a.id=t.account_id ORDER BY deadline"):
        cur, prov = current_value(t["metric"], t["account_id"])
        fc = forecast_followers(t["account_id"], t["deadline"]) if t["metric"] == "followers" and t["account_id"] else None
        out.append({**t, "current": cur, "current_provenance": prov,
                    "progress": round(cur / t["target"], 3) if cur is not None and t["target"] else None,
                    "forecast": fc, "on_track": (fc["projected"] >= t["target"]) if fc else None})
    return out


def acquisition(min_contents: int = 2) -> list[dict]:
    """Which technique brings followers: followers gained per 1,000 views, by lever (needs followers_delta entered)."""
    groups: dict[tuple[str, str], list[int]] = {}
    for p in performance():
        if p["followers_delta"] is None or not p["views"]:
            continue
        levers = {"plateforme": p["platform"], "format": p["format"], "type de hook": p["hook_type"] or "?",
                  "série": "oui" if p["series_id"] else "non", "suite d'un gagnant": "oui" if p["follow_up"] else "non",
                  "déclinaison multi-plateforme": "oui" if p["variant_of"] else "non", "sponsorisé": "oui" if p["deal_id"] else "non"}
        for dim, val in levers.items():
            g = groups.setdefault((dim, str(val)), [0, 0, 0])
            g[0] += p["followers_delta"]
            g[1] += p["views"]
            g[2] += 1
    out = [{"lever": d, "value": v, "contents": n, "followers": f, "views": vw, "followers_per_1k_views": round(f / vw * 1000, 2)}
           for (d, v), (f, vw, n) in groups.items() if n >= min_contents and vw]
    return sorted(out, key=lambda x: -x["followers_per_1k_views"])


def benchmark() -> list[dict]:
    """Own average views (last 10 originals per platform) vs competitors' public averages you entered."""
    own: dict[str, list[int]] = {}
    for p in sorted(performance(), key=lambda p: p["published_at"] or ""):
        if not p["variant_of"]:
            own.setdefault(p["platform"], []).append(p["views"] or 0)
    out = []
    for c in db.rows("SELECT handle, platform, avg_views, followers FROM competitors WHERE avg_views IS NOT NULL"):
        mine = own.get(c["platform"], [])[-10:]
        avg = round(sum(mine) / len(mine)) if mine else None
        out.append({**c, "own_avg_views": avg, "ratio": round(avg / c["avg_views"], 2) if avg and c["avg_views"] else None,
                    "provenance": "manual"})
    return sorted(out, key=lambda x: -(x["avg_views"] or 0))


NICHE_SCALE = {"low": 1, "medium": 2, "high": 3}


def niche_score(n: dict) -> int | None:
    """Deterministic score 0-100 from the agent's ratings (the LLM rates, the code weighs)."""
    keys = ("audience_demand", "competition", "brand_monetization", "persona_fit", "content_sustainability")
    if any(n.get(k) not in NICHE_SCALE for k in keys):
        return None
    v = {k: NICHE_SCALE[n[k]] for k in keys}
    raw = 0.3 * v["audience_demand"] + 0.2 * (4 - v["competition"]) + 0.2 * v["brand_monetization"] + 0.2 * v["persona_fit"] + 0.1 * v["content_sustainability"]
    return round((raw - 1) / 2 * 100)


def summary() -> dict:
    perf = performance()
    platforms = sorted({p["platform"] for p in perf} | set(db.setting("platforms") or []))
    return {
        "performance": sorted(perf, key=lambda p: -(p["perf_index"] or 0))[:30],
        "winners": winners(), "arms": arm_stats(),
        "slots": {p: best_slots(p) for p in platforms},
        "anomalies": anomalies(), "deficit": quota_deficit(), "targets": targets_progress(),
        "acquisition": acquisition(), "benchmark": benchmark(),
        "note": "Indice de performance = vues / médiane de la plateforme (≥ 3 contenus mesurés). Données saisies = provenance manuelle.",
    }

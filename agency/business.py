"""Business layer (mainstream monetisation only): brand deals -> sponsored deliverables -> revenue, unit economics,
media kit and rate card. Every figure keeps its provenance; prices come from YOUR CPM, never from an invented market rate."""
from __future__ import annotations

import statistics
from datetime import datetime, timezone

from . import db, growth, queue
from .agents.character import active_character
from .agents.compliance import restricted_sponsor
from .config import PLATFORMS
from .events import activity, history


def create_deliverables(collab_id: str) -> list[str]:
    col = db.one("SELECT * FROM collabs WHERE id=?", (collab_id,))
    if not col or col["kind"] != "brand":
        raise ValueError("seul un partenariat de marque génère des contenus sponsorisés")
    if col["stage"] not in ("agreed", "done"):
        raise ValueError("le deal doit être au stade « agreed »")
    if restricted_sponsor(f"{col['name']} {col['notes'] or ''}"):
        raise ValueError("catégorie interdite ou encadrée pour la promotion par influenceur")
    existing = db.scalar("SELECT COUNT(*) FROM contents WHERE deal_id=? AND parent_id IS NULL", (collab_id,))
    n = max(0, int(col["deliverables"] or 1) - existing)
    platform = col["platform"] if col["platform"] in PLATFORMS else "tiktok"
    pillar = active_character()["pillars"][0]["name"]
    ids = []
    for k in range(n):
        cid = db.new_id("CNT")
        brief = {"platform": platform, "format": PLATFORMS[platform]["formats"][0], "pillar": pillar, "angle": f"partenariat {col['name']}",
                 "hook_idea": f"Je teste {col['name']} pour de vrai", "hook_type": "défi", "objective": "engagement",
                 "sponsor": {"brand": col["name"], "key_message": (col["notes"] or "")[:200]}}
        db.insert("contents", {"id": cid, "title": f"Partenariat {col['name']} #{existing + k + 1}", "stage": "concept", "status": "in_progress",
                               "platform": platform, "format": brief["format"], "pillar": pillar, "meta": db.dumps({"brief": brief}),
                               "hashtags": "[]", "deal_id": collab_id, "account_id": db.scalar(
                                   "SELECT id FROM accounts WHERE platform=? AND status='active' ORDER BY created_at LIMIT 1", (platform,)),
                               "created_at": db.now(), "updated_at": db.now()})
        history(cid, "user", "sponsored_deliverable_created", {"deal": collab_id})
        queue.enqueue("creative.develop", "creative", {}, content_id=cid, priority=8)
        ids.append(cid)
    return ids


def mark_paid(collab_id: str) -> dict:
    col = db.one("SELECT * FROM collabs WHERE id=?", (collab_id,))
    if not col or not col["deal_value"]:
        raise ValueError("montant du deal manquant")
    if col["paid"]:
        return {"already_paid": True}
    fid = db.new_id("FIN")
    db.insert("finance_entries", {"id": fid, "date": db.now()[:10], "kind": "revenue", "category": "partenariat de marque",
                                  "amount": float(col["deal_value"]), "currency": "EUR", "source": col["name"], "provenance": "manual",
                                  "note": f"deal {collab_id}", "deal_id": collab_id, "created_at": db.now()})
    db.update("collabs", "id", collab_id, {"paid": 1, "stage": "done", "updated_at": db.now()})
    activity("user", "deal_paid", collab_id, {"amount": col["deal_value"]})
    return {"finance_entry": fid}


def economics(days: int = 90) -> dict:
    """Per-content cost (LLM, measured tokens x public price = estimated), revenue (deals split across their
    deliverables + entries linked to the content, manual) and views (latest metrics, manual)."""
    since = db.now(-days * 86400)
    rows = db.rows("SELECT id, title, platform, pillar, format, deal_id FROM contents WHERE created_at>=?", (since,))
    llm = {r["content_id"]: r["c"] for r in db.rows(
        "SELECT j.content_id, SUM(l.cost_usd) c FROM llm_calls l JOIN jobs j ON j.id=l.job_id WHERE j.content_id IS NOT NULL GROUP BY j.content_id")}
    views = {p["id"]: p["views"] for p in growth.performance()}
    deal_rev = {r["deal_id"]: r["amount"] for r in db.rows(
        "SELECT deal_id, SUM(amount) amount FROM finance_entries WHERE kind='revenue' AND deal_id IS NOT NULL GROUP BY deal_id")}
    deal_n = {r["deal_id"]: r["n"] for r in db.rows("SELECT deal_id, COUNT(*) n FROM contents WHERE deal_id IS NOT NULL AND parent_id IS NULL GROUP BY deal_id")}
    direct = {r["content_id"]: r["amount"] for r in db.rows(
        "SELECT content_id, SUM(CASE WHEN kind='revenue' THEN amount ELSE -amount END) amount FROM finance_entries WHERE content_id IS NOT NULL GROUP BY content_id")}
    items, agg = [], {}
    for c in rows:
        rev = direct.get(c["id"], 0.0) + (deal_rev.get(c["deal_id"], 0.0) / deal_n[c["deal_id"]] if c["deal_id"] in deal_rev and deal_n.get(c["deal_id"]) else 0.0)
        cost = llm.get(c["id"], 0.0)
        v = views.get(c["id"])
        items.append({**c, "llm_cost_usd": round(cost, 6), "revenue_eur": round(rev, 2), "views": v,
                      "rev_per_1k_views": round(rev / v * 1000, 2) if v else None})
        for dim in ("platform", "pillar"):
            a = agg.setdefault(dim, {}).setdefault(c[dim] or "?", {"contents": 0, "views": 0, "revenue_eur": 0.0, "llm_cost_usd": 0.0})
            a["contents"] += 1
            a["views"] += v or 0
            a["revenue_eur"] = round(a["revenue_eur"] + rev, 2)
            a["llm_cost_usd"] = round(a["llm_cost_usd"] + cost, 6)
    fin = db.one("SELECT COALESCE(SUM(CASE WHEN kind='revenue' THEN amount END),0) r, COALESCE(SUM(CASE WHEN kind='expense' THEN amount END),0) e "
                 "FROM finance_entries WHERE date>=?", (since[:10],))
    tot_views = sum(v or 0 for v in views.values())
    return {"period_days": days, "contents": sorted(items, key=lambda x: -x["revenue_eur"])[:100], "by": agg,
            "totals": {"revenue_eur": fin["r"], "expenses_eur": fin["e"], "net_eur": round(fin["r"] - fin["e"], 2),
                       "llm_cost_usd": round(sum(llm.values()), 4), "views": tot_views,
                       "expenses_per_1k_views_eur": round(fin["e"] / tot_views * 1000, 2) if tot_views else None},
            "provenance": {"revenue": "manual", "expenses": "manual", "llm_cost": "estimated", "views": "manual"}}


def media_kit() -> dict:
    ch = active_character()
    perf = growth.performance()
    platforms = []
    for a in db.rows("SELECT * FROM accounts WHERE status='active' ORDER BY platform"):
        mine = [p for p in perf if p["account_id"] == a["id"]][-10:]
        avg_views = round(statistics.mean(p["views"] or 0 for p in mine)) if mine else None
        ers = [p["er"] for p in mine if p["er"] is not None]
        platforms.append({"platform": a["platform"], "handle": a["handle"], "followers": a["followers"], "avg_views_last10": avg_views,
                          "avg_er_last10": round(statistics.mean(ers), 4) if ers else None, "sample": len(mine)})
    cpm = db.setting("cpm_eur") or {}
    rate = []
    for p in platforms:
        if p["avg_views_last10"] and cpm.get("low") and cpm.get("high"):
            rate.append({"platform": p["platform"], "deliverable": "1 vidéo sponsorisée",
                         "low_eur": round(p["avg_views_last10"] * float(cpm["low"]) / 1000),
                         "high_eur": round(p["avg_views_last10"] * float(cpm["high"]) / 1000), "provenance": "estimated"})
    top = sorted((p for p in perf if p["views"]), key=lambda p: -(p["views"] or 0))[:3]
    return {"generated_at": db.now(), "name": ch["name"], "tagline": ch["tagline"], "bio": ch["bio"], "disclosure": ch["disclosure"]["long"],
            "niche": ch["niche"], "audience": ch["editorial_line"]["audience"], "pillars": [p["name"] for p in ch["pillars"]],
            "platforms": platforms, "top_contents": [{"title": t["title"], "platform": t["platform"], "views": t["views"]} for t in top],
            "rate_card": rate, "rate_card_note": None if rate else "Renseignez votre CPM (Settings › cpm_eur) et des statistiques pour calculer la grille.",
            "provenance": {"followers": "manual", "views": "manual", "rates": "estimated (vos vues × votre CPM)"},
            "legal": "Mentions « Image virtuelle » et « Collaboration commerciale » incluses dans chaque contenu sponsorisé (loi n° 2023-451)."}


def media_kit_markdown(k: dict) -> str:
    L = [f"# Kit média — {k['name']}", f"_{k['tagline']}_", "", k["bio"], "", f"> {k['disclosure']}", "",
         f"**Niche** : {k['niche']}  ", f"**Audience visée** : {k['audience']}  ", f"**Thèmes** : {', '.join(k['pillars'])}", "", "## Plateformes"]
    L += [f"- {p['platform']} {p['handle']} — {p['followers'] or '?'} abonnés · vues moyennes (10 dernières) {p['avg_views_last10'] or '?'} · "
          f"engagement {f'{p['avg_er_last10']:.1%}' if p['avg_er_last10'] else '?'}" for p in k["platforms"]] or ["- (comptes à renseigner)"]
    L += ["", "## Meilleurs contenus"] + ([f"- {t['title']} ({t['platform']}) — {t['views']} vues" for t in k["top_contents"]] or ["- —"])
    L += ["", "## Tarifs indicatifs"] + ([f"- {r['platform']} · {r['deliverable']} : {r['low_eur']}–{r['high_eur']} €" for r in k["rate_card"]] or [f"- {k['rate_card_note']}"])
    L += ["", f"_Données : abonnés et vues saisis manuellement ; tarifs estimés. {k['legal']} Généré le {k['generated_at'][:10]}._"]
    return "\n".join(L) + "\n"

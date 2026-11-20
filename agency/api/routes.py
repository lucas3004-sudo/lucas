"""REST API consumed by the dashboard. Secrets are never returned. Every metric carries a provenance."""
from __future__ import annotations

import csv
import io
from pathlib import Path

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse

from .. import control, db, queue, reports, storage, usage, worker
from ..agents import compliance
from ..agents.character import active_character, save_character
from ..agents.handlers import get_content, save_content
from ..agents.specs import AGENTS
from ..config import DEFAULT_SETTINGS, LOCKED_SETTINGS
from ..events import activity, history
from ..integrations import elevenlabs, registry
from ..llm import claude_code

r = APIRouter(prefix="/api")
LLM_MODES = {"offline", "claude_code", "api"}
IMAGE_PROVIDERS = {"manual", "placeholder", "alexya"}


def _404(what: str):
    raise HTTPException(404, f"{what} introuvable")


def _get(cid: str) -> dict:
    try:
        return get_content(cid)
    except queue.PermanentError:
        _404("contenu")


def _content_out(c: dict) -> dict:
    c["assets"] = [{**a, "meta": db.loads(a["meta"], {}), "url": f"/api/assets/{a['id']}/file"} for a in storage.content_assets(c["id"])]
    return c


# --- overview / daily ------------------------------------------------------------
@r.get("/health")
def health():
    return {"ok": True, "time": db.now()}


@r.get("/overview")
def overview():
    st = control.state()
    statuses = control.agent_statuses()
    job_stats = {(x["agent"], x["status"]): x["n"] for x in db.rows("SELECT agent, status, COUNT(*) n FROM jobs GROUP BY agent, status")}
    agents = [{"id": a, "name": s["name"], "roles": s["roles"], "status": statuses.get(a, "active"),
               "running": job_stats.get((a, "running"), 0), "queued": job_stats.get((a, "queued"), 0) + job_stats.get((a, "waiting"), 0),
               "done": job_stats.get((a, "done"), 0), "failed": job_stats.get((a, "failed"), 0) + job_stats.get((a, "dead"), 0)}
              for a, s in AGENTS.items()]
    since7 = db.now(-7 * 86400)[:10]
    perf = db.one("SELECT COUNT(DISTINCT content_id) contents, COALESCE(SUM(views),0) views, COALESCE(SUM(likes+comments+shares+saves),0) eng "
                  "FROM metrics WHERE date>=?", (since7,))
    u = usage.summary(30)
    return {
        "agency": st, "run": db.one("SELECT * FROM runs WHERE id=?", (st["current_run_id"],)) if st["current_run_id"] else None,
        "agents": agents, "jobs": queue.counts(),
        "tasks": db.rows("SELECT id, type, agent, status, content_id, attempts, updated_at, last_error FROM jobs "
                         "WHERE status IN ('running','queued','waiting') ORDER BY priority DESC, created_at LIMIT 15"),
        "contents": {x["status"]: x["n"] for x in db.rows("SELECT status, COUNT(*) n FROM contents GROUP BY status")},
        "contents_total": db.scalar("SELECT COUNT(*) FROM contents"),
        "upcoming": db.rows("SELECT id, title, platform, scheduled_at FROM contents WHERE status='scheduled' ORDER BY scheduled_at LIMIT 5"),
        "performance_7d": {**perf, "provenance": "manual/measured (saisies)"},
        "alerts": db.rows("SELECT * FROM notifications WHERE read=0 ORDER BY id DESC LIMIT 10"),
        "usage_30d": {**u["totals"], "mode": u["mode"], "budget": u["budget"], "cost_provenance": "estimated"},
        "cc_pending": len(claude_code.list_tasks()),
        "locked": LOCKED_SETTINGS,
    }


@r.get("/daily")
def daily():
    q = lambda st: db.rows("SELECT id, title, platform, format, status, updated_at FROM contents WHERE status=? ORDER BY updated_at", (st,))  # noqa: E731
    return {
        "approvals": q("awaiting_approval"), "assets_needed": q("waiting_assets"), "revisions": q("needs_revision"),
        "to_publish": q("ready_to_publish"),
        "messages": db.rows("SELECT * FROM messages WHERE status='needs_human' ORDER BY received_at LIMIT 30"),
        "failed_jobs": db.rows("SELECT id, type, agent, last_error, updated_at FROM jobs WHERE status IN ('failed','dead') ORDER BY updated_at DESC LIMIT 20"),
        "cc_tasks": claude_code.list_tasks(),
        "today": db.rows("SELECT id, title, platform, scheduled_at FROM contents WHERE scheduled_at>=? AND scheduled_at<? ORDER BY scheduled_at",
                         (db.now()[:10], db.now(86400)[:10])),
    }


# --- agency / agents / jobs ------------------------------------------------------
@r.post("/agency/{action}")
def agency_action(action: str, body: dict = Body(default={})):
    if action == "launch":
        res = control.launch("manual", {"contents": body.get("contents")} if body.get("contents") else None)
        if not res["ok"]:
            raise HTTPException(409, res["reason"])
        return res
    fn = {"pause": control.pause, "resume": control.resume, "stop": control.stop}.get(action)
    if not fn:
        _404("action")
    return fn()


@r.get("/agents")
def agents():
    statuses = control.agent_statuses()
    return [{"id": a, **s, "status": statuses.get(a, "active"),
             "last_jobs": db.rows("SELECT id, type, status, updated_at, last_error FROM jobs WHERE agent=? ORDER BY updated_at DESC LIMIT 5", (a,)),
             "llm_30d": db.one("SELECT COUNT(*) calls, COALESCE(SUM(input_tokens+output_tokens),0) tokens, COALESCE(SUM(cost_usd),0) cost "
                               "FROM llm_calls WHERE agent=? AND at>=?", (a, db.now(-30 * 86400)))}
            for a, s in AGENTS.items()]


@r.post("/agents/{agent_id}/{action}")
def agent_action(agent_id: str, action: str):
    if action not in ("pause", "resume", "stop", "restart"):
        _404("action")
    try:
        return control.set_agent(agent_id, action)
    except KeyError:
        _404("agent")


@r.get("/jobs")
def jobs(status: str = "", agent: str = "", run_id: str = "", limit: int = Query(100, le=500)):
    sql, p = "SELECT * FROM jobs WHERE 1=1", []
    for col, v in (("status", status), ("agent", agent), ("run_id", run_id)):
        if v:
            sql += f" AND {col}=?"
            p.append(v)
    return db.rows(sql + " ORDER BY updated_at DESC LIMIT ?", (*p, limit))


@r.post("/jobs/{job_id}/{action}")
def job_action(job_id: str, action: str):
    ok = {"retry": queue.retry, "cancel": queue.cancel}.get(action, lambda _: None)(job_id)
    if ok is None:
        _404("action")
    return {"ok": bool(ok)}


@r.get("/runs")
def runs():
    return [{**x, "params": db.loads(x["params"], {}), "summary": db.loads(x["summary"], {})}
            for x in db.rows("SELECT * FROM runs ORDER BY started_at DESC LIMIT 50")]


# --- contents ----------------------------------------------------------------------
@r.get("/contents")
def contents(status: str = "", platform: str = "", limit: int = Query(200, le=1000)):
    sql, p = "SELECT id, run_id, title, stage, status, platform, format, pillar, hook, scheduled_at, published_at, created_at, updated_at FROM contents WHERE 1=1", []
    if status:
        sql += " AND status=?"
        p.append(status)
    if platform:
        sql += " AND platform=?"
        p.append(platform)
    return db.rows(sql + " ORDER BY created_at DESC LIMIT ?", (*p, limit))


@r.get("/contents/{cid}")
def content(cid: str):
    c = _get(cid)
    c["history"] = db.rows("SELECT * FROM content_history WHERE content_id=? ORDER BY id", (cid,))
    c["metrics"] = db.rows("SELECT * FROM metrics WHERE content_id=? ORDER BY date", (cid,))
    return _content_out(c)


EDITABLE = {"title", "concept", "hook", "script", "caption", "hashtags", "prompts", "platform", "format", "pillar"}


@r.post("/contents")
def create_content(body: dict = Body(...)):
    cid = db.new_id("CNT")
    platform = body.get("platform", "instagram")
    if platform not in ("tiktok", "instagram"):
        raise HTTPException(400, "platform invalide")
    db.insert("contents", {"id": cid, "title": (body.get("title") or "Contenu manuel")[:200], "stage": "concept", "status": "in_progress",
                           "platform": platform, "format": body.get("format", "reel"), "pillar": body.get("pillar"),
                           "meta": db.dumps({"brief": {"angle": body.get("title", ""), "pillar": body.get("pillar", ""), "platform": platform,
                                                       "format": body.get("format", "reel"), "hook_idea": body.get("hook", ""), "hook_type": "manuel",
                                                       "objective": "engagement"}}),
                           "hashtags": "[]", "created_at": db.now(), "updated_at": db.now()})
    history(cid, "user", "created_manually")
    if body.get("develop", True):
        queue.enqueue("creative.develop", "creative", {}, content_id=cid, priority=6)
    return {"id": cid}


@r.patch("/contents/{cid}")
def edit_content(cid: str, body: dict = Body(...)):
    _get(cid)
    fields = {k: v for k, v in body.items() if k in EDITABLE}
    if not fields:
        raise HTTPException(400, f"champs modifiables : {sorted(EDITABLE)}")
    blocks = compliance.check_text(db.dumps(fields))
    if blocks:
        raise HTTPException(422, f"contenu non conforme : {blocks}")
    save_content(cid, "user", "edited", {"fields": sorted(fields)}, **fields)
    return content(cid)


@r.post("/contents/{cid}/{action}")
def content_action(cid: str, action: str, body: dict = Body(default={})):
    c = _get(cid)
    if action == "approve":
        if c["status"] != "awaiting_approval":
            raise HTTPException(409, "seul un contenu ayant passé le QC peut être approuvé")
        save_content(cid, "user", "approved", {"note": body.get("note")}, status="approved", stage="approval")
        return worker.run_now("planner.schedule", "planner", {"scheduled_at": body.get("scheduled_at")}, content_id=cid)
    if action == "reject":
        save_content(cid, "user", "rejected", {"reason": body.get("reason")}, status="rejected")
        return {"ok": True}
    if action == "regenerate":
        save_content(cid, "user", "regenerate_requested", {"feedback": body.get("feedback")}, status="in_progress", stage="concept")
        queue.enqueue("creative.develop", "creative", {"feedback": body.get("feedback", "")}, run_id=c["run_id"], content_id=cid, priority=6)
        return {"ok": True, "steps": worker.drain_content(cid)}
    if action == "continue":  # after dropping visuals
        step = "producer.edit" if c["stage"] in ("editing", "qc") else "producer.generate"
        save_content(cid, "user", "continue_requested", {"step": step}, status="in_progress")
        queue.enqueue(step, "producer", {}, run_id=c["run_id"], content_id=cid, priority=6)
        return {"ok": True, "steps": worker.drain_content(cid)}
    if action == "requalify":  # re-run QC after manual edits
        return worker.run_now("reviewer.qc", "reviewer", {}, content_id=cid)
    if action == "mark-published":
        if c["status"] not in ("ready_to_publish", "scheduled"):
            raise HTTPException(409, "contenu non prêt à publier")
        save_content(cid, "user", "published", {"url": body.get("url")}, status="published", stage="analysis",
                     published_at=body.get("published_at") or db.now(), published_url=body.get("url"))
        return {"ok": True}
    if action == "reschedule":
        if c["status"] != "scheduled" or not body.get("scheduled_at"):
            raise HTTPException(409, "seul un contenu planifié peut être déplacé (scheduled_at requis)")
        save_content(cid, "user", "rescheduled", {"from": c["scheduled_at"], "to": body["scheduled_at"]}, scheduled_at=body["scheduled_at"])
        return {"ok": True}
    _404("action")


@r.post("/uploads")
def upload(file: UploadFile = File(...), kind: str = Form("drop"), content_id: str = Form(""),
           non_explicit: str = Form("false"), note: str = Form("")):
    if non_explicit.lower() != "true":
        raise HTTPException(400, "Confirmez que le fichier est non explicite (seuls les contenus non explicites sont acceptés).")
    if kind not in ("drop", "reference"):
        raise HTTPException(400, "kind invalide")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in storage.ALLOWED_EXT:
        raise HTTPException(400, f"extension non autorisée ({sorted(storage.ALLOWED_EXT)})")
    if content_id:
        _get(content_id)
    max_b = int(db.setting("max_upload_mb")) * 1024 * 1024
    folder = f"contents/{content_id}" if content_id else ("references" if kind == "reference" else "drop")
    rel, path = storage.new_path(folder, ext)
    size = 0
    with path.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > max_b:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(413, f"fichier > {max_b // 1048576} Mo")
            out.write(chunk)
    ch = active_character()
    asset = storage.register(rel, kind, "upload", content_id=content_id or None,
                             character_id=ch["id"] if kind == "reference" else None,
                             meta={"original_name": (file.filename or "")[:120], "note": note[:300], "attested_non_explicit": True})
    activity("user", "file_uploaded", asset["id"], {"kind": kind, "content_id": content_id, "size": size})
    if content_id:
        history(content_id, "user", "asset_dropped", {"asset": asset["id"]})
    return {**asset, "url": f"/api/assets/{asset['id']}/file"}


@r.get("/assets")
def assets(kind: str = "", content_id: str = ""):
    sql, p = "SELECT * FROM assets WHERE 1=1", []
    if kind:
        sql += " AND kind=?"
        p.append(kind)
    if content_id:
        sql += " AND content_id=?"
        p.append(content_id)
    return [{**a, "meta": db.loads(a["meta"], {}), "url": f"/api/assets/{a['id']}/file"} for a in db.rows(sql + " ORDER BY created_at DESC LIMIT 300", p)]


@r.get("/assets/{aid}/file")
def asset_file(aid: str):
    a = db.one("SELECT * FROM assets WHERE id=?", (aid,))
    if not a:
        _404("fichier")
    p = storage.abs_path(a["path"])
    if not p.is_file():
        _404("fichier")
    return FileResponse(p, media_type=a["mime"], filename=p.name)


@r.patch("/assets/{aid}")
def asset_update(aid: str, body: dict = Body(...)):
    if "approved" in body:
        db.update("assets", "id", aid, {"approved": int(bool(body["approved"]))})
    return db.one("SELECT * FROM assets WHERE id=?", (aid,)) or _404("fichier")


@r.delete("/assets/{aid}")
def asset_delete(aid: str):
    a = db.one("SELECT * FROM assets WHERE id=?", (aid,)) or _404("fichier")
    storage.abs_path(a["path"]).unlink(missing_ok=True)
    db.execute("DELETE FROM assets WHERE id=?", (aid,))
    activity("user", "asset_deleted", aid)
    return {"ok": True}


# --- calendar ----------------------------------------------------------------------
@r.get("/calendar")
def calendar(start: str = Query(...), end: str = Query(...)):
    return db.rows("SELECT id, title, platform, format, status, scheduled_at, published_at FROM contents "
                   "WHERE (scheduled_at>=? AND scheduled_at<?) OR (published_at>=? AND published_at<?) ORDER BY COALESCE(scheduled_at, published_at)",
                   (start, end, start, end))




# --- character ---------------------------------------------------------------------
@r.get("/character")
def character():
    ch = active_character()
    refs = db.rows("SELECT * FROM assets WHERE kind='reference' ORDER BY created_at DESC")
    return {**ch, "references": [{**a, "meta": db.loads(a["meta"], {}), "url": f"/api/assets/{a['id']}/file"} for a in refs]}


@r.put("/character")
def update_character(body: dict = Body(...)):
    body.pop("references", None)
    scanned = {k: v for k, v in body.items() if k not in ("visual_identity", "editorial_line")}
    for k in ("visual_identity", "editorial_line"):  # "dont" lists describe what is forbidden: not scanned
        scanned[k] = {kk: vv for kk, vv in (body.get(k) or {}).items() if kk != "dont"}
    blocks = compliance.check_text(db.dumps(scanned))
    if blocks:
        raise HTTPException(422, f"fiche personnage non conforme : {blocks}")
    data = save_character({**active_character(), **body, "is_placeholder": False})
    activity("user", "character_updated", data["id"])
    return data


@r.post("/character/voice-preview")
def voice_preview(body: dict = Body(default={})):
    if not db.setting("voice_enabled"):
        raise HTTPException(403, "Génération vocale désactivée (Settings > voice_enabled) : elle consomme vos crédits ElevenLabs.")
    v = active_character()["voice"]
    text = (body.get("text") or "Coucou, moi c'est Nova, une créatrice virtuelle générée par IA.")[:300]
    try:
        audio = elevenlabs.tts(v.get("voice_id"), text, v.get("model_id"), v.get("settings"))
    except elevenlabs.ElevenLabsError as e:
        raise HTTPException(502, str(e))
    a = storage.save_bytes(audio, "voice-previews", ".mp3", "audio", "elevenlabs", meta={"chars": len(text)})
    db.insert("api_usage", {"at": db.now(), "service": "elevenlabs", "operation": "tts_preview", "units": len(text), "unit": "characters",
                            "cost_usd": None, "provenance": "estimated", "details": "{}"})
    return {**a, "url": f"/api/assets/{a['id']}/file"}


# --- growth ------------------------------------------------------------------------
@r.get("/growth")
def growth():
    from ..agents.library import EVERGREEN_FORMATS, HOOKS
    top = db.rows("SELECT c.id, c.hook, c.format, c.platform, m.views, (m.likes+m.comments+m.shares+m.saves)*1.0/NULLIF(m.views,0) er, m.provenance "
                  "FROM contents c JOIN metrics m ON m.content_id=c.id WHERE m.id IN (SELECT MAX(id) FROM metrics GROUP BY content_id) "
                  "ORDER BY er DESC LIMIT 10")
    return {
        "competitors": db.rows("SELECT * FROM competitors ORDER BY updated_at DESC"),
        "research": db.rows("SELECT * FROM research_items WHERE kind IN ('trend','competitor_note','opportunity','insight') ORDER BY created_at DESC LIMIT 60"),
        "experiments": db.rows("SELECT * FROM experiments ORDER BY created_at DESC LIMIT 30"),
        "hook_patterns": [{"type": t, "pattern": p} for t, p in HOOKS],
        "formats": [{"name": n, "recipe": d, "format": f} for n, d, f in EVERGREEN_FORMATS],
        "top_contents": top,
    }


@r.post("/competitors")
def add_competitor(body: dict = Body(...)):
    if not body.get("handle") or body.get("platform") not in ("tiktok", "instagram"):
        raise HTTPException(400, "handle et platform (tiktok|instagram) requis")
    cid = db.new_id("CMP")
    db.insert("competitors", {"id": cid, "platform": body["platform"], "handle": body["handle"][:80], "niche": body.get("niche"),
                              "notes": body.get("notes"), "followers": body.get("followers"), "avg_views": body.get("avg_views"),
                              "provenance": "manual", "updated_at": db.now()})
    return {"id": cid}


@r.delete("/competitors/{cid}")
def del_competitor(cid: str):
    return {"ok": db.execute("DELETE FROM competitors WHERE id=?", (cid,)) > 0}


@r.patch("/experiments/{eid}")
def update_experiment(eid: str, body: dict = Body(...)):
    fields = {k: body[k] for k in ("status", "result") if k in body}
    if fields.get("status") and fields["status"] not in ("proposed", "running", "concluded", "dropped"):
        raise HTTPException(400, "status invalide")
    db.update("experiments", "id", eid, {**fields, "updated_at": db.now()})
    return db.one("SELECT * FROM experiments WHERE id=?", (eid,))


# --- community ---------------------------------------------------------------------
@r.get("/messages")
def messages(status: str = ""):
    if status:
        return db.rows("SELECT * FROM messages WHERE status=? ORDER BY received_at DESC LIMIT 300", (status,))
    return db.rows("SELECT * FROM messages ORDER BY received_at DESC LIMIT 300")


@r.post("/messages/import")
def import_messages(body: dict = Body(...)):
    items = body.get("messages") or []
    if body.get("csv"):
        items += list(csv.DictReader(io.StringIO(body["csv"])))
    n = 0
    for m in items:
        text = (m.get("text") or "").strip()
        if not text:
            continue
        db.insert("messages", {"id": db.new_id("MSG"), "platform": (m.get("platform") or "instagram")[:20], "author": (m.get("author") or "")[:80],
                               "text": text[:2000], "content_id": m.get("content_id") or None, "received_at": m.get("received_at") or db.now(),
                               "status": "new", "created_at": db.now(), "updated_at": db.now()})
        n += 1
    activity("user", "messages_imported", details={"count": n})
    res = worker.run_now("community.triage", "community") if body.get("triage", True) and n else None
    return {"imported": n, "triage": res}


@r.post("/messages/triage")
def triage():
    return worker.run_now("community.triage", "community")


@r.patch("/messages/{mid}")
def update_message(mid: str, body: dict = Body(...)):
    fields = {k: body[k] for k in ("status", "final_reply") if k in body}
    if fields.get("status") and fields["status"] not in ("new", "drafted", "needs_human", "replied", "ignored"):
        raise HTTPException(400, "status invalide")
    if fields.get("final_reply") and compliance.check_text(fields["final_reply"]):
        raise HTTPException(422, "réponse non conforme")
    db.update("messages", "id", mid, {**fields, "updated_at": db.now()})
    return db.one("SELECT * FROM messages WHERE id=?", (mid,))


# --- analytics / finance -------------------------------------------------------------
@r.post("/metrics")
def add_metrics(body: dict = Body(...)):
    if not body.get("platform") or not body.get("date"):
        raise HTTPException(400, "platform et date requis")
    row = {k: body.get(k) for k in ("content_id", "platform", "date", "views", "likes", "comments", "shares", "saves", "followers_delta")}
    db.insert("metrics", {**row, "provenance": "manual", "created_at": db.now()})
    if row["content_id"]:
        worker.run_now("analyst.analyze", "analyst", {}, content_id=row["content_id"])
    return {"ok": True}


@r.get("/analytics")
def analytics():
    latest = "m.id IN (SELECT MAX(id) FROM metrics GROUP BY COALESCE(content_id, platform || date))"
    agg = lambda col: db.rows(  # noqa: E731
        f"SELECT {col} k, COUNT(*) n, SUM(m.views) views, SUM(m.likes+m.comments+m.shares+m.saves) eng FROM metrics m "
        f"LEFT JOIN contents c ON c.id=m.content_id WHERE {latest} GROUP BY {col} ORDER BY views DESC")
    return {
        "provenance_note": "Statistiques saisies manuellement (aucune API de plateforme connectée).",
        "totals": db.one(f"SELECT COUNT(*) n, COALESCE(SUM(views),0) views, COALESCE(SUM(likes),0) likes, COALESCE(SUM(comments),0) comments, "
                         f"COALESCE(SUM(shares),0) shares, COALESCE(SUM(saves),0) saves, COALESCE(SUM(followers_delta),0) followers FROM metrics m WHERE {latest}"),
        "by_platform": agg("m.platform"), "by_format": agg("c.format"), "by_pillar": agg("c.pillar"),
        "series": db.rows("SELECT date, SUM(views) views, SUM(likes+comments+shares+saves) eng FROM metrics GROUP BY date ORDER BY date"),
        "contents": db.rows(f"SELECT m.*, c.title, c.format FROM metrics m LEFT JOIN contents c ON c.id=m.content_id WHERE {latest} ORDER BY m.date DESC LIMIT 100"),
        "insights": db.rows("SELECT * FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 10"),
    }


@r.get("/finance")
def finance(month: str = ""):
    month = month or db.now()[:7]
    entries = db.rows("SELECT * FROM finance_entries WHERE substr(date,1,7)=? ORDER BY date DESC", (month,))
    api_cost = db.scalar("SELECT COALESCE(SUM(cost_usd),0) FROM llm_calls WHERE substr(at,1,7)=?", (month,))
    rev = sum(e["amount"] for e in entries if e["kind"] == "revenue")
    exp = sum(e["amount"] for e in entries if e["kind"] == "expense")
    cats: dict[str, float] = {}
    for e in entries:
        cats[f"{e['kind']}:{e['category']}"] = cats.get(f"{e['kind']}:{e['category']}", 0) + e["amount"]
    return {"month": month, "entries": entries, "revenue": rev, "expenses": exp, "net": rev - exp, "by_category": cats,
            "api_cost_usd_estimated": api_cost, "provenance": {"entries": "manual", "api_cost": "estimated"},
            "budget": {"daily_usd": db.setting("daily_budget_usd"), "monthly_usd": db.setting("monthly_budget_usd")}}


@r.post("/finance")
def add_finance(body: dict = Body(...)):
    if body.get("kind") not in ("revenue", "expense") or body.get("amount") is None:
        raise HTTPException(400, "kind (revenue|expense) et amount requis")
    fid = db.new_id("FIN")
    db.insert("finance_entries", {"id": fid, "date": body.get("date") or db.now()[:10], "kind": body["kind"],
                                  "category": (body.get("category") or "autre")[:60], "amount": float(body["amount"]),
                                  "currency": body.get("currency", "EUR"), "source": body.get("source"), "provenance": "manual",
                                  "note": body.get("note"), "created_at": db.now()})
    return {"id": fid}


@r.delete("/finance/{fid}")
def del_finance(fid: str):
    return {"ok": db.execute("DELETE FROM finance_entries WHERE id=?", (fid,)) > 0}


# --- integrations / usage / settings ---------------------------------------------------
@r.get("/integrations")
def integrations():
    return registry.status_all()


@r.post("/integrations/{name}/test")
def integration_test(name: str):
    return registry.test(name)


@r.get("/integrations/elevenlabs/voices")
def el_voices(search: str = ""):
    try:
        return elevenlabs.voices(search)
    except elevenlabs.ElevenLabsError as e:
        raise HTTPException(502, str(e))


@r.get("/usage")
def usage_summary(days: int = Query(30, le=365)):
    return usage.summary(days)


@r.post("/usage/import-claude-code")
def usage_import(body: dict = Body(default={})):
    return usage.import_claude_code(project_filter=body.get("project_filter", ""))


@r.get("/settings")
def get_settings():
    return {"settings": db.get_settings(), "locked": LOCKED_SETTINGS, "defaults": DEFAULT_SETTINGS,
            "schedules": db.rows("SELECT * FROM schedules ORDER BY name")}


@r.put("/settings")
def put_settings(body: dict = Body(...)):
    bad = set(body) & set(LOCKED_SETTINGS)
    if bad:
        raise HTTPException(403, f"réglages verrouillés : {sorted(bad)}")
    unknown = set(body) - set(DEFAULT_SETTINGS) - {"agent_modes"}
    if unknown:
        raise HTTPException(400, f"réglages inconnus : {sorted(unknown)}")
    if "llm_mode" in body and body["llm_mode"] not in LLM_MODES:
        raise HTTPException(400, f"llm_mode ∈ {sorted(LLM_MODES)}")
    if "agent_modes" in body and (not isinstance(body["agent_modes"], dict) or set(body["agent_modes"].values()) - LLM_MODES
                                  or set(body["agent_modes"]) - set(AGENTS)):
        raise HTTPException(400, "agent_modes : {agent: offline|claude_code|api}")
    if "posting_hours" in body:
        import re
        ok = isinstance(body["posting_hours"], dict) and all(
            isinstance(v, list) and v and all(isinstance(h, str) and re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", h) for h in v)
            for v in body["posting_hours"].values())
        if not ok:
            raise HTTPException(400, "posting_hours : {plateforme: [\"HH:MM\", ...]}")
    if "image_provider" in body and body["image_provider"] not in IMAGE_PROVIDERS:
        raise HTTPException(400, f"image_provider ∈ {sorted(IMAGE_PROVIDERS)}")
    for k in ("daily_budget_usd", "monthly_budget_usd"):
        if k in body and not (0 <= float(body[k]) <= 1000):
            raise HTTPException(400, f"{k} hors bornes (0-1000)")
    if "contents_per_run" in body and not (1 <= int(body["contents_per_run"]) <= 10):
        raise HTTPException(400, "contents_per_run entre 1 et 10")
    s = db.set_settings(body)
    activity("user", "settings_updated", details={k: body[k] for k in body})
    return s


@r.patch("/schedules/{sid}")
def update_schedule(sid: str, body: dict = Body(...)):
    from ..scheduler import next_run
    s = db.one("SELECT * FROM schedules WHERE id=?", (sid,)) or _404("planification")
    spec = body.get("spec", s["spec"])
    next_run(spec)  # validates
    db.update("schedules", "id", sid, {"enabled": int(bool(body.get("enabled", s["enabled"]))), "spec": spec, "next_run_at": next_run(spec)})
    return db.one("SELECT * FROM schedules WHERE id=?", (sid,))


# --- logs / notifications / briefs / claude code -------------------------------------
@r.get("/logs")
def logs(level: str = "", limit: int = Query(200, le=1000)):
    if level:
        return db.rows("SELECT * FROM activity_log WHERE level=? ORDER BY id DESC LIMIT ?", (level, limit))
    return db.rows("SELECT * FROM activity_log ORDER BY id DESC LIMIT ?", (limit,))


@r.get("/notifications")
def notifications():
    return db.rows("SELECT * FROM notifications ORDER BY id DESC LIMIT 100")


@r.post("/notifications/read")
def notifications_read():
    return {"updated": db.execute("UPDATE notifications SET read=1 WHERE read=0")}


@r.get("/briefs")
def briefs():
    return sorted((p.stem for p in reports.BRIEFS_DIR.glob("*.md")), reverse=True) if reports.BRIEFS_DIR.is_dir() else []


@r.post("/briefs/generate")
def brief_generate():
    return {"path": reports.write_daily_brief().name}


@r.get("/briefs/{day}", response_class=PlainTextResponse)
def brief(day: str):
    p = reports.BRIEFS_DIR / f"{Path(day).name}.md"
    if not p.is_file():
        _404("rapport")
    return p.read_text(encoding="utf-8")


@r.get("/cc/tasks")
def cc_tasks():
    return claude_code.list_tasks()


@r.get("/cc/tasks/{task_id}")
def cc_task(task_id: str):
    try:
        return claude_code.get_task(task_id)
    except KeyError:
        _404("tâche")


@r.post("/cc/tasks/{task_id}/result")
def cc_submit(task_id: str, body: dict = Body(...)):
    try:
        res = claude_code.submit(task_id, body)
    except KeyError:
        _404("tâche")
    if not res["ok"]:
        raise HTTPException(422, res)
    return res


@r.post("/work/once")
def work_once():
    """Process ready jobs now (useful when no background worker is running)."""
    return {"processed": worker.run_once(ignore_state=False)}

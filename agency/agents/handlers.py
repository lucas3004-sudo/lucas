"""Job handlers = what each agent actually does. Pipeline:
plan -> research.scan -> growth.strategy -> reviewer.challenge -> (per content) creative.develop -> platform.optimize
-> prompt.build -> producer.generate -> producer.edit -> reviewer.qc -> [HUMAN approval] -> planner.schedule
-> (scheduler, at slot) publisher.prepare -> [HUMAN posts + enters metrics] -> analyst.analyze / analyst.learn."""
from __future__ import annotations

import re
import shutil
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .. import control, db, queue, storage
from ..config import load_env
from ..events import activity, history, notify
from ..integrations import elevenlabs, media
from ..llm.gateway import Task, run as llm
from ..llm.schema import B, I, N, S, arr, enum, obj
from . import compliance, library
from .character import active_character
from .specs import AGENTS

JSON_FIELDS = ("script", "prompts", "hashtags", "qc", "meta")
VIDEO_FORMATS = {"video", "reel", "talking_head", "storytime", "tutorial", "day_in_life", "trend_remix", "pov"}
MEDIA_EXT = (".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov")


# --- helpers ------------------------------------------------------------------
def get_content(cid: str) -> dict:
    c = db.one("SELECT * FROM contents WHERE id=?", (cid,))
    if not c:
        raise queue.PermanentError(f"content {cid} not found")
    for f in JSON_FIELDS:
        c[f] = db.loads(c[f], {} if f in ("prompts", "qc", "meta", "script") else [])
    return c


def save_content(cid: str, actor: str, action: str, details: dict | None = None, **fields) -> None:
    data = {k: (db.dumps(v) if k in JSON_FIELDS else v) for k, v in fields.items()}
    data["updated_at"] = db.now()
    db.update("contents", "id", cid, data)
    history(cid, actor, action, details)


def _task(agent: str, name: str, inp: dict, schema: dict, max_tokens: int) -> Task:
    return Task(agent, name, AGENTS[agent]["tier"], AGENTS[agent]["instructions"], inp, schema, max_tokens)


def _research(kind: str, title: str, body: str, source: str, provenance: str, run_id: str | None,
              platform: str | None = None, url: str | None = None) -> None:
    db.insert("research_items", {"id": db.new_id("RES"), "kind": kind, "platform": platform, "title": title[:300], "body": body,
                                 "url": url or None, "source": source, "provenance": provenance, "run_id": run_id, "created_at": db.now()})


def _src(data: dict) -> str:
    return data.get("_generated_by", "offline-template")


# --- orchestrator ---------------------------------------------------------------
def orchestrator_plan(job: dict) -> dict:
    s = db.get_settings()
    n = max(1, min(int(job["payload"].get("contents") or s["contents_per_run"]), 10))
    insights = [r["title"] for r in db.rows("SELECT title FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 5")]
    plan = {"contents": n, "platforms": s["platforms"], "language": s["language"], "focus_insights": insights, "llm_mode": s["llm_mode"]}
    _research("plan", f"Plan du run : {n} contenus", db.dumps(plan), "orchestrator", "n/a", job["run_id"])
    db.update("runs", "id", job["run_id"], {"params": db.dumps(plan)})
    queue.enqueue("research.scan", "research", {"plan": plan}, run_id=job["run_id"], priority=9)
    return plan


def orchestrator_autolaunch(job: dict) -> dict:
    return control.launch("schedule")


# --- research -------------------------------------------------------------------
RESEARCH_SCHEMA = obj(
    trends=arr(obj(title=S, why_relevant=S, platform=enum("tiktok", "instagram", "both"),
                   confidence=enum("low", "medium", "high"), source_url=S), 6),
    competitor_patterns=arr(obj(pattern=S, takeaway=S), 6),
    opportunities=arr(obj(title=S, angle=S), 6),
)


def research_scan(job: dict) -> dict:
    ch = active_character()
    comps = db.rows("SELECT platform, handle, niche, notes FROM competitors ORDER BY updated_at DESC LIMIT 15")
    insights = [r["title"] for r in db.rows("SELECT title FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 5")]
    inp = {"niche": ch["niche"], "pillars": [p["name"] for p in ch["pillars"]], "platforms": job["payload"]["plan"]["platforms"],
           "language": job["payload"]["plan"]["language"], "competitor_notes": comps, "insights": insights}

    def offline() -> dict:
        return {
            "trends": [{"title": f, "why_relevant": d, "platform": "both", "confidence": "low", "source_url": ""}
                       for f, d, _ in library.EVERGREEN_FORMATS[:4]],
            "competitor_patterns": [{"pattern": f"{c['handle']} ({c['platform']})", "takeaway": (c["notes"] or "à analyser")[:200]} for c in comps[:5]],
            "opportunities": [{"title": p["name"], "angle": p["topics"][0]} for p in ch["pillars"]],
        }

    data = llm(_task("research", "scan", inp, RESEARCH_SCHEMA, 1500), job, offline)
    src = _src(data)
    for t in data["trends"]:
        prov = "observed" if t.get("source_url") else ("template" if src == "offline-template" else "hypothesis")
        _research("trend", t["title"], f"{t['why_relevant']} (confiance {t['confidence']})", src, prov, job["run_id"], t["platform"], t.get("source_url"))
    for p in data["competitor_patterns"]:
        _research("competitor_note", p["pattern"], p["takeaway"], src, "manual" if comps else "template", job["run_id"])
    for o in data["opportunities"]:
        _research("opportunity", o["title"], o["angle"], src, "template" if src == "offline-template" else "hypothesis", job["run_id"])
    queue.enqueue("growth.strategy", "growth", {"plan": job["payload"]["plan"], "trends": [t["title"] for t in data["trends"]],
                                                 "opportunities": data["opportunities"]}, run_id=job["run_id"], priority=8)
    return {"trends": len(data["trends"]), "opportunities": len(data["opportunities"]), "source": src}


# --- growth ---------------------------------------------------------------------
BRIEF = obj(platform=enum("tiktok", "instagram"), format=S, pillar=S, angle=S, hook_idea=S, hook_type=S,
            objective=enum("portée", "engagement", "abonnés"))
STRATEGY_SCHEMA = obj(briefs=arr(BRIEF, 10), experiment=obj(hypothesis=S, variable=S, variant_a=S, variant_b=S, metric=S))


def growth_strategy(job: dict) -> dict:
    ch = active_character()
    plan = job["payload"]["plan"]
    n = plan["contents"]
    insights = [r["title"] for r in db.rows("SELECT title FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 5")]
    inp = {"n": n, "platforms": plan["platforms"], "pillars": ch["pillars"], "trends": job["payload"]["trends"],
           "opportunities": job["payload"]["opportunities"], "insights": insights,
           "formats": library.FORMATS}
    fallback = library.pick_briefs(ch, plan["platforms"], n, [{"title": i} for i in insights], job["run_id"])

    def offline() -> dict:
        return {"briefs": fallback, "experiment": {
            "hypothesis": "Un hook en question génère plus de commentaires qu'un hook « liste »", "variable": "type de hook",
            "variant_a": "question", "variant_b": "liste", "metric": "commentaires / vues"}}

    data = llm(_task("growth", "strategy", inp, STRATEGY_SCHEMA, 1500), job, offline)
    briefs = [b for b in data["briefs"] if b["platform"] in plan["platforms"]][:n]
    briefs += fallback[len(briefs):n]  # never fewer than planned
    e = data["experiment"]
    db.insert("experiments", {"id": db.new_id("EXP"), "hypothesis": e["hypothesis"], "variable": e["variable"],
                              "variant_a": e["variant_a"], "variant_b": e["variant_b"], "metric": e["metric"],
                              "status": "proposed", "run_id": job["run_id"], "created_at": db.now(), "updated_at": db.now()})
    _research("strategy", f"Stratégie : {len(briefs)} briefs", db.dumps(briefs), _src(data), "n/a", job["run_id"])
    queue.enqueue("reviewer.challenge", "reviewer", {"briefs": briefs}, run_id=job["run_id"], priority=7)
    return {"briefs": len(briefs), "source": _src(data)}


# --- reviewer -------------------------------------------------------------------
CHALLENGE_SCHEMA = obj(reviews=arr(obj(index=I, keep=B, risk=S, improvement=S), 10))


def reviewer_challenge(job: dict) -> dict:
    briefs = job["payload"]["briefs"]
    seen, rule_notes = set(), []
    for i, b in enumerate(briefs):
        blocks = compliance.check_text(f"{b['angle']} {b['hook_idea']}")
        dup = (b["pillar"], b["format"]) in seen
        seen.add((b["pillar"], b["format"]))
        rule_notes.append({"index": i, "keep": not blocks, "risk": ", ".join(blocks) or ("format répété" if dup else "aucun risque majeur"),
                           "improvement": "varier le format" if dup else ""})

    def offline() -> dict:
        return {"reviews": rule_notes}

    data = llm(_task("reviewer", "challenge", {"briefs": briefs, "rule_checks": rule_notes}, CHALLENGE_SCHEMA, 800), job, offline)
    reviews = {r["index"]: r for r in data["reviews"]}
    created = []
    for i, b in enumerate(briefs):
        rev = reviews.get(i, rule_notes[i])
        if not rule_notes[i]["keep"] or not rev.get("keep", True):  # rules always win over the LLM
            activity("reviewer", "brief_dropped", job["run_id"], {"brief": b, "risk": rev.get("risk")}, "warn")
            continue
        cid = db.new_id("CNT")
        db.insert("contents", {"id": cid, "run_id": job["run_id"], "title": f"{b['pillar']} · {b['angle']}"[:200],
                               "stage": "concept", "status": "in_progress", "platform": b["platform"], "format": b["format"],
                               "pillar": b["pillar"], "meta": db.dumps({"brief": b, "review": rev}), "hashtags": "[]",
                               "created_at": db.now(), "updated_at": db.now()})
        history(cid, "reviewer", "created_from_brief", {"risk": rev.get("risk")})
        queue.enqueue("creative.develop", "creative", {}, run_id=job["run_id"], content_id=cid, priority=6)
        created.append(cid)
    return {"created": created, "dropped": len(briefs) - len(created)}


def reviewer_qc(job: dict) -> dict:
    c = get_content(job["content_id"])
    ch = active_character()
    res = compliance.check_content(c, storage.content_assets(c["id"]), ch["disclosure"]["short"])
    qc = {k: res[k] for k in ("passed", "score", "blockers", "warnings", "fixes")} | {"checked_at": db.now(), "by": "rules"}
    status, stage = ("awaiting_approval", "approval") if res["passed"] else ("needs_revision", "qc")
    save_content(c["id"], "reviewer", "qc_passed" if res["passed"] else "qc_failed", qc, qc=qc, caption=res["caption"], status=status, stage=stage)
    if res["passed"]:
        notify("Contenu à valider", f"{c['title']} (score {res['score']})", "info", f"#/studio?c={c['id']}")
    else:
        notify("Contenu à revoir", f"{c['title']} : {'; '.join(res['blockers'])[:200]}", "warn", f"#/studio?c={c['id']}")
    return qc


# --- creative / platform / prompt ----------------------------------------------
CREATIVE_SCHEMA = obj(title=S, concept=S, hook=S, cta=S, caption=S,
                      script=obj(duration_s=I, beats=arr(obj(t=S, visual=S, on_screen_text=S, voiceover=S), 8)))


def creative_develop(job: dict) -> dict:
    c = get_content(job["content_id"])
    ch = active_character()
    brief = c["meta"].get("brief", {})
    fb = job["payload"].get("feedback", "")
    inp = {"brief": brief, "platform": c["platform"], "format": c["format"], "language": db.setting("language"),
           "feedback": fb, "hook_patterns": [h for _, h in library.HOOKS[:4]]}
    data = llm(_task("creative", "develop", inp, CREATIVE_SCHEMA, 1800), job,
               lambda: library.script_for(brief, ch, c["id"] + fb))
    blocks = compliance.check_text(" ".join([data["hook"], data["caption"], data["concept"]]))
    if blocks:
        save_content(c["id"], "creative", "blocked_by_rules", {"blockers": blocks}, status="needs_revision", stage="script",
                     qc={"passed": False, "blockers": blocks, "by": "rules"})
        return {"blocked": blocks}
    history(c["id"], "creative", "concept_written", {"source": _src(data)})
    save_content(c["id"], "creative", "script_written", {"source": _src(data)}, title=data["title"][:200], concept=data["concept"],
                 hook=data["hook"], script=data["script"], caption=data["caption"], stage="script", status="in_progress")
    queue.enqueue("platform.optimize", "platform", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
    return {"source": _src(data)}


PLATFORM_SCHEMA = obj(caption=S, hashtags=arr(S, 10), keywords=arr(S, 8), notes=S)


def platform_optimize(job: dict) -> dict:
    c = get_content(job["content_id"])
    tag = active_character()["disclosure"]["short"]

    def offline() -> dict:
        return {"caption": c["caption"], "hashtags": library.hashtags_for(c["pillar"] or "", c["platform"]),
                "keywords": [w for w in re.findall(r"\w{5,}", c["title"].lower())][:5], "notes": "heuristique hors ligne"}

    data = llm(_task("platform", "optimize", {"platform": c["platform"], "caption": c["caption"], "pillar": c["pillar"],
                                              "title": c["title"], "disclosure_tag": tag}, PLATFORM_SCHEMA, 600), job, offline)
    caption, _ = compliance.ensure_disclosure(data["caption"], tag)
    tags = [t if t.startswith("#") else f"#{t}" for t in data["hashtags"]]
    if "#IA" not in tags:
        tags.append("#IA")
    meta = {**c["meta"], "keywords": data["keywords"], "platform_notes": data["notes"]}
    save_content(c["id"], "platform", "platform_optimized", {"source": _src(data)}, caption=caption, hashtags=tags, meta=meta)
    queue.enqueue("prompt.build", "prompt", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
    return {"hashtags": len(tags)}


PROMPT_SCHEMA = obj(image_prompts=arr(obj(shot=S, prompt=S, negative_prompt=S, aspect_ratio=S), 6),
                    video_prompt=S, voiceover_text=S, voice_direction=S)


def prompt_build(job: dict) -> dict:
    c = get_content(job["content_id"])
    ch = active_character()
    neg = compliance.SFW_NEGATIVE

    def offline() -> dict:
        beats = c["script"].get("beats", [])
        return {"image_prompts": library.image_prompts(c, ch, neg),
                "video_prompt": f"Vidéo verticale 9:16, {ch['name']}, {ch['visual_identity']['style']}, mouvements naturels, "
                                f"{c['concept']}",
                "voiceover_text": " ".join(b["voiceover"] for b in beats),
                "voice_direction": ch["voice"]["description"]}

    data = llm(_task("prompt", "build", {"script": c["script"], "concept": c["concept"], "platform": c["platform"],
                                         "format": c["format"], "negative_prompt": neg,
                                         "visual_identity": ch["visual_identity"]}, PROMPT_SCHEMA, 1200), job, offline)
    for p in data["image_prompts"]:
        if neg not in p["negative_prompt"]:
            p["negative_prompt"] = f"{p['negative_prompt']}, {neg}".strip(", ")
    blocks = compliance.check_text(" ".join(p["prompt"] for p in data["image_prompts"]) + " " + data["video_prompt"])
    if blocks:
        save_content(c["id"], "prompt", "blocked_by_rules", {"blockers": blocks}, status="needs_revision",
                     qc={"passed": False, "blockers": blocks, "by": "rules"})
        return {"blocked": blocks}
    data.pop("_generated_by", None)
    save_content(c["id"], "prompt", "prompts_written", None, prompts=data, stage="prompt")
    queue.enqueue("producer.generate", "producer", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
    return {"image_prompts": len(data["image_prompts"])}


# --- producer -------------------------------------------------------------------
def _voice(c: dict, notes: list[str]) -> None:
    s = db.get_settings()
    assets = storage.content_assets(c["id"])
    if any(a["kind"] == "audio" for a in assets):
        return notes.append("voix déjà présente")
    if not s.get("voice_enabled"):
        return notes.append("voix désactivée (Settings)")
    if not elevenlabs.configured():
        return notes.append("ElevenLabs non configuré")
    voice = active_character()["voice"]
    text = (c["prompts"] or {}).get("voiceover_text", "")[:2500]
    if not voice.get("voice_id") or not text:
        return notes.append("voice_id ou texte manquant")
    day = datetime.now(timezone.utc).date().isoformat()
    used = db.scalar("SELECT COALESCE(SUM(units),0) FROM api_usage WHERE service='elevenlabs' AND at>=?", (day,)) or 0
    if used + len(text) > int(s["voice_daily_char_cap"]):
        return notes.append(f"plafond voix journalier atteint ({used}/{s['voice_daily_char_cap']} caractères)")
    try:
        audio = elevenlabs.tts(voice["voice_id"], text, voice.get("model_id"), voice.get("settings"))
    except (elevenlabs.ElevenLabsError, OSError) as e:
        activity("producer", "voice_failed", c["id"], str(e)[:200], "warn")
        return notes.append(f"échec voix : {str(e)[:120]}")
    storage.save_bytes(audio, f"contents/{c['id']}", ".mp3", "audio", "elevenlabs", content_id=c["id"], meta={"chars": len(text)})
    db.insert("api_usage", {"at": db.now(), "service": "elevenlabs", "operation": "tts", "units": len(text), "unit": "characters",
                            "cost_usd": None, "provenance": "estimated", "details": db.dumps({"content_id": c["id"]})})
    notes.append("voix générée (ElevenLabs)")


def producer_generate(job: dict) -> dict:
    c = get_content(job["content_id"])
    notes: list[str] = []
    _voice(c, notes)
    visuals = [a for a in storage.content_assets(c["id"]) if a["kind"] in ("image", "video", "drop") and a["path"].lower().endswith(MEDIA_EXT)]
    provider = db.setting("image_provider")
    if not visuals:
        if provider == "placeholder":
            for k, p in enumerate((c["prompts"] or {}).get("image_prompts", [])[:4] or [{"shot": "plan 1"}]):
                rel, path = storage.new_path(f"contents/{c['id']}", ".png")
                media.placeholder_image(path, f"PLACEHOLDER\n{p['shot']}")
                storage.register(rel, "image", "placeholder", content_id=c["id"], meta={"shot": p["shot"]})
            notes.append("visuels provisoires générés (placeholder, non publiables)")
        elif provider == "alexya":
            raise queue.PermanentError("Intégration Alexya non vérifiée : utilisez le mode 'manual' (prompts → Alexya → zone Drop).")
        else:
            save_content(c["id"], "producer", "waiting_assets", {"notes": notes}, status="waiting_assets", stage="generation")
            notify("Visuels à générer", f"{c['title']} : copiez les prompts dans Alexya puis déposez les fichiers.", "info",
                   f"#/generator?c={c['id']}")
            return {"waiting_assets": True, "notes": notes}
    save_content(c["id"], "producer", "assets_ready", {"notes": notes}, stage="generation", status="in_progress")
    queue.enqueue("producer.edit", "producer", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
    return {"notes": notes}


def producer_edit(job: dict) -> dict:
    c = get_content(job["content_id"])
    if not media.available():
        raise queue.PermanentError("ffmpeg/ffprobe introuvable")
    assets = storage.content_assets(c["id"])
    visuals = [a for a in assets if a["kind"] in ("image", "video", "drop") and a["path"].lower().endswith(MEDIA_EXT)]
    if not visuals:
        raise queue.PermanentError("aucun visuel à monter")
    voice = next((storage.abs_path(a["path"]) for a in reversed(assets) if a["kind"] == "audio"), None)
    src = "placeholder" if any(a["source"] == "placeholder" for a in visuals) else "ffmpeg"
    db.execute("DELETE FROM assets WHERE content_id=? AND kind='final'", (c["id"],))  # re-edit replaces previous finals
    if c["format"] in VIDEO_FORMATS:
        texts = [b.get("on_screen_text", "") for b in c["script"].get("beats", [])]
        rel, out = storage.new_path(f"contents/{c['id']}", ".mp4")
        d = media.build_video([storage.abs_path(a["path"]) for a in visuals], out, texts, voice)
        storage.register(rel, "final", src, content_id=c["id"], meta={"duration_s": round(d, 2), "w": 1080, "h": 1920})
        info = {"video_s": round(d, 2)}
    else:
        n = 0
        for a in visuals:
            if not a["path"].lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            rel, out = storage.new_path(f"contents/{c['id']}", ".jpg")
            media.normalize_image(storage.abs_path(a["path"]), out)
            storage.register(rel, "final", src, content_id=c["id"], meta={"w": 1080, "h": 1350})
            n += 1
        info = {"images": n}
    save_content(c["id"], "producer", "edited", info, stage="editing")
    queue.enqueue("reviewer.qc", "reviewer", {}, run_id=c["run_id"], content_id=c["id"], priority=5)
    return info


# --- planner / publisher --------------------------------------------------------
def planner_schedule(job: dict) -> dict:
    c = get_content(job["content_id"])
    if c["status"] != "approved":
        raise queue.PermanentError("seul un contenu approuvé par un humain peut être planifié")
    when = job["payload"].get("scheduled_at")
    if not when:
        tz = ZoneInfo(load_env().timezone)
        hours = (db.setting("posting_hours") or {}).get(c["platform"], ["12:00"])
        taken = {r["scheduled_at"] for r in db.rows("SELECT scheduled_at FROM contents WHERE platform=? AND scheduled_at IS NOT NULL", (c["platform"],))}
        start = datetime.now(timezone.utc).astimezone(tz) + timedelta(hours=1)
        for day in range(0, 60):
            for h in sorted(hours):
                hh, mm = map(int, h.split(":"))
                slot = (start + timedelta(days=day)).replace(hour=hh, minute=mm, second=0, microsecond=0)
                iso = slot.astimezone(timezone.utc).isoformat(timespec="seconds")
                if slot > start and iso not in taken:
                    when = iso
                    break
            if when:
                break
    save_content(c["id"], "planner", "scheduled", {"scheduled_at": when}, scheduled_at=when, status="scheduled", stage="publication")
    return {"scheduled_at": when}


def publisher_prepare(job: dict) -> dict:
    c = get_content(job["content_id"])
    finals = [a for a in storage.content_assets(c["id"]) if a["kind"] == "final"]
    folder = storage.abs_path(f"exports/{c['id']}")
    folder.mkdir(parents=True, exist_ok=True)
    for a in finals:
        shutil.copy2(storage.abs_path(a["path"]), folder / storage.abs_path(a["path"]).name)
    (folder / "caption.txt").write_text(f"{c['caption']}\n\n{' '.join(c['hashtags'])}\n", encoding="utf-8")
    (folder / "CHECKLIST.md").write_text(
        f"# Publication manuelle - {c['title']}\n\nPlateforme : {c['platform']} · créneau : {c['scheduled_at']}\n\n"
        "- [ ] Activer l'étiquette « contenu généré par IA » de la plateforme\n- [ ] Coller la légende (caption.txt)\n"
        "- [ ] Vérifier le visuel une dernière fois\n- [ ] Après publication : saisir l'URL dans le dashboard (Content Studio)\n"
        "- [ ] J+1 / J+7 : saisir les statistiques (Analytics)\n", encoding="utf-8")
    zip_path = shutil.make_archive(str(folder), "zip", folder)
    rel = f"exports/{c['id']}.zip"
    storage.register(rel, "export", "system", content_id=c["id"])
    save_content(c["id"], "planner", "export_ready", {"zip": rel}, status="ready_to_publish", stage="publication")
    notify("Prêt à publier (manuel)", f"{c['title']} sur {c['platform']}", "info", f"#/studio?c={c['id']}")
    return {"export": rel, "files": len(finals), "zip_bytes": __import__("os").path.getsize(zip_path)}


# --- analyst --------------------------------------------------------------------
def _er(m: dict) -> float | None:
    v = m.get("views") or 0
    return round(sum(m.get(k) or 0 for k in ("likes", "comments", "shares", "saves")) / v, 4) if v else None


def analyst_analyze(job: dict) -> dict:
    c = get_content(job["content_id"])
    m = db.one("SELECT * FROM metrics WHERE content_id=? ORDER BY date DESC, id DESC LIMIT 1", (c["id"],))
    if not m:
        return {"skipped": "no metrics"}
    perf = {"views": m["views"], "engagement_rate": _er(m), "provenance": m["provenance"], "date": m["date"]}
    save_content(c["id"], "analyst", "analyzed", perf, meta={**c["meta"], "performance": perf}, stage="analysis")
    return perf


def analyst_learn(job: dict) -> dict:
    data = db.rows("SELECT c.format, c.pillar, c.meta, m.* FROM metrics m JOIN contents c ON c.id=m.content_id "
                   "WHERE m.id IN (SELECT MAX(id) FROM metrics GROUP BY content_id)")
    if len(data) < 3:
        return {"skipped": f"données insuffisantes ({len(data)} contenus mesurés, minimum 3)"}
    out = {}
    for dim in ("format", "pillar"):
        groups: dict[str, list[float]] = {}
        for r in data:
            er = _er(r)
            if er is not None:
                groups.setdefault(r[dim] or "?", []).append(er)
        ranked = sorted(((k, sum(v) / len(v), len(v)) for k, v in groups.items()), key=lambda x: -x[1])
        if ranked:
            k, avg, n = ranked[0]
            label = "Format gagnant" if dim == "format" else "Pilier gagnant"
            prov = "measured" if all(r["provenance"] == "measured" for r in data) else "manual"
            _research("insight", f"{label}: {k}", f"ER moyen {avg:.2%} sur {n} contenu(s) (données {prov})", "analyst", prov, None)
            out[dim] = {"best": k, "avg_er": round(avg, 4), "n": n}
    return out


def analyst_daily_brief(job: dict) -> dict:
    from ..reports import write_daily_brief
    path = write_daily_brief()
    return {"path": str(path)}


# --- community ------------------------------------------------------------------
SENSITIVE = {
    "détresse": r"(suicid|me tuer|envie de mourir|self[- ]?harm|je veux mourir)",
    "juridique": r"(avocat|plainte|porter plainte|mise en demeure|lawyer|sue you)",
    "mineur": r"(j'?ai 1[0-7] ans|\bi'?m 1[0-7]\b|je suis au coll[eè]ge)",
    "harcèlement": r"(sale \w+|connasse|pute|salope|je vais te retrouver|kill you)",
}
POS = r"(merci|trop bien|j'adore|magnifique|top|incroyable|love|parfait|génial|bravo|❤|😍|🔥)"
NEG = r"(nul|horrible|déteste|arnaque|fake|moche|pas ouf|décevant|hate|ennuyeux|👎)"
CATEGORY_RULES = [
    ("ai_question", r"(t'?es (une )?(vraie|réelle|ia|robot)|es[- ]tu (une )?(ia|réelle|vraie)|are you (real|an ai|a bot))"),
    ("collab_request", r"(collab|partenariat|sponsor|marque|brand deal|business)"),
    ("support", r"(bug|marche pas|problème|aide|help|comment faire)"),
    ("spam", r"(gagne de l'argent|crypto|promo code|clique ici|follow for follow|f4f)"),
    ("question", r"\?"),
    ("compliment", POS),
    ("criticism", NEG),
]
REPLIES = {
    "ai_question": "Bonne question ! Je suis Nova, une créatrice virtuelle générée par IA 🤖 L'équipe derrière moi lit tout 💬",
    "compliment": "Merci beaucoup, ça me fait trop plaisir ✨",
    "criticism": "Merci pour ton retour, on en tient compte pour les prochains contenus 🙏",
    "question": "Merci pour ta question ! Je te réponds en détail très vite 👇",
    "collab_request": "Merci ! Pour les collaborations, l'équipe te répond par message privé.",
    "support": "Merci de nous l'avoir signalé, l'équipe regarde ça 🙏",
    "other": "Merci pour ton message 💛",
}
COMMUNITY_SCHEMA = obj(items=arr(obj(id=S, category=enum(*REPLIES, "spam"), sentiment=N, priority=enum("low", "medium", "high"),
                                     reply=S, escalate=B, reason=S), 20))


def _rule_triage(m: dict) -> dict:
    t = m["text"].lower()
    for reason, p in SENSITIVE.items():
        if re.search(p, t):
            return {"id": m["id"], "category": "other", "sentiment": -1.0, "priority": "high", "reply": "", "escalate": True, "reason": reason}
    if compliance.check_text(t):
        return {"id": m["id"], "category": "other", "sentiment": 0.0, "priority": "high", "reply": "", "escalate": True,
                "reason": "demande à caractère sexuel ou adulte"}
    cat = next((c for c, p in CATEGORY_RULES if re.search(p, t)), "other")
    sent = (0.6 if re.search(POS, t) else 0.0) - (0.6 if re.search(NEG, t) else 0.0)
    prio = "high" if cat in ("collab_request", "support") else "low" if cat in ("compliment", "spam") else "medium"
    return {"id": m["id"], "category": cat, "sentiment": sent, "priority": prio,
            "reply": "" if cat == "spam" else REPLIES.get(cat, REPLIES["other"]), "escalate": cat == "collab_request",
            "reason": "opportunité commerciale : décision humaine" if cat == "collab_request" else ""}


def community_triage(job: dict) -> dict:
    msgs = db.rows("SELECT id, platform, author, text FROM messages WHERE status='new' ORDER BY received_at LIMIT 20")
    if not msgs:
        return {"triaged": 0}
    name = active_character()["name"]
    rules = {m["id"]: _rule_triage(m) for m in msgs}
    for v in rules.values():
        v["reply"] = v["reply"].replace("Nova", name)
    data = llm(_task("community", "triage", {"character_name": name, "messages": msgs, "rule_hints": list(rules.values())},
                     COMMUNITY_SCHEMA, 1500), job, lambda: {"items": list(rules.values())})
    by_id = {i["id"]: i for i in data["items"]}
    counts = {"drafted": 0, "needs_human": 0, "ignored": 0}
    for m in msgs:
        r, it = rules[m["id"]], by_id.get(m["id"], rules[m["id"]])
        if r["escalate"] and r["reason"] != "opportunité commerciale : décision humaine":
            it = r  # sensitive rules always override the LLM
        reply = it.get("reply", "")
        if reply and compliance.check_text(reply):
            it = {**it, "escalate": True, "reason": "réponse proposée non conforme", "reply": ""}
        status = "needs_human" if it["escalate"] else "ignored" if it["category"] == "spam" else "drafted"
        counts[status] += 1
        db.update("messages", "id", m["id"], {"category": it["category"], "sentiment": "positive" if it["sentiment"] > 0.2 else
                                              "negative" if it["sentiment"] < -0.2 else "neutral", "sentiment_score": it["sentiment"],
                                              "priority": it["priority"], "suggested_reply": it.get("reply") or None,
                                              "escalation_reason": it.get("reason") or None, "status": status, "updated_at": db.now()})
    if counts["needs_human"]:
        notify("Messages à traiter par un humain", f"{counts['needs_human']} message(s) sensibles ou importants", "warn", "#/community")
    return {"triaged": len(msgs), **counts, "source": _src(data)}


HANDLERS = {
    "orchestrator.plan": orchestrator_plan, "orchestrator.autolaunch": orchestrator_autolaunch,
    "research.scan": research_scan, "growth.strategy": growth_strategy,
    "reviewer.challenge": reviewer_challenge, "reviewer.qc": reviewer_qc,
    "creative.develop": creative_develop, "platform.optimize": platform_optimize, "prompt.build": prompt_build,
    "producer.generate": producer_generate, "producer.edit": producer_edit,
    "planner.schedule": planner_schedule, "publisher.prepare": publisher_prepare,
    "analyst.analyze": analyst_analyze, "analyst.learn": analyst_learn, "analyst.daily_brief": analyst_daily_brief,
    "community.triage": community_triage,
}

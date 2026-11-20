"""Job handlers = what each agent actually does. Pipeline:
plan -> research.scan -> growth.strategy -> reviewer.challenge -> (per content) creative.develop -> platform.optimize
-> prompt.build -> producer.generate -> producer.edit -> reviewer.qc -> [HUMAN approval] -> planner.schedule
-> (scheduler, at slot) publisher.prepare -> [HUMAN posts + enters metrics] -> analyst.analyze / analyst.learn."""
from __future__ import annotations

import re
import shutil
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .. import control, db, growth, queue, storage
from ..config import PLATFORMS, VIDEO_FORMATS, load_env
from ..events import activity, history, notify
from ..integrations import elevenlabs, media
from ..llm.gateway import Task, run as llm
from ..llm.schema import B, I, N, S, arr, enum, obj
from . import compliance, library
from .character import active_character
from .specs import AGENTS

JSON_FIELDS = ("script", "prompts", "hashtags", "qc", "meta")
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
    if kind == "insight" and db.one("SELECT 1 FROM research_items WHERE kind='insight' AND title=? AND body=?", (title[:300], body)):
        return  # same learning already recorded: avoid crowding prompts with duplicates
    db.insert("research_items", {"id": db.new_id("RES"), "kind": kind, "platform": platform, "title": title[:300], "body": body,
                                 "url": url or None, "source": source, "provenance": provenance, "run_id": run_id, "created_at": db.now()})


def _src(data: dict) -> str:
    return data.get("_generated_by", "offline-template")


# --- orchestrator ---------------------------------------------------------------
def orchestrator_plan(job: dict) -> dict:
    """Sizes the run from account quotas (or settings), reserves slots for double-downs on winners."""
    s = db.get_settings()
    explicit = job["payload"].get("contents")
    deficit = growth.quota_deficit() if s.get("auto_quota") and not explicit else None
    if explicit:
        n = max(1, min(int(explicit), 10))
    elif deficit is not None:
        n = min(sum(deficit.values()), 10)
    else:
        n = max(1, min(int(s["contents_per_run"]), 10))
    platform_slots = ([p for p, d in sorted(deficit.items(), key=lambda x: -x[1]) for _ in range(d)] if deficit
                      else [p for p in s["platforms"] if p in PLATFORMS]) or ["tiktok"]
    follow_ups = []
    for w in growth.winners()[: max(1, n // 3)] if n else []:  # flagged doubled_down only once the follow-up exists
        follow_ups.append({k: w[k] for k in ("id", "title", "hook", "platform", "format", "pillar", "perf_index")})
    insights = [r["title"] for r in db.rows("SELECT title FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 5")]
    plan = {"contents": n, "platforms": s["platforms"], "platform_slots": platform_slots, "deficit": deficit,
            "follow_ups": follow_ups, "language": s["language"], "focus_insights": insights, "llm_mode": s["llm_mode"]}
    _research("plan", f"Plan du run : {n} contenus" + (f" (dont {len(follow_ups)} suite(s) de gagnants)" if follow_ups else ""),
              db.dumps(plan), "orchestrator", "n/a", job["run_id"])
    db.update("runs", "id", job["run_id"], {"params": db.dumps(plan)})
    if n == 0:
        activity("orchestrator", "quotas_covered", job["run_id"], {"deficit": deficit})
        return {**plan, "note": "quotas couverts sur 3 jours : rien à produire"}
    queue.enqueue("research.scan", "research", {"plan": plan}, run_id=job["run_id"], priority=9)
    return plan


def orchestrator_autolaunch(job: dict) -> dict:
    return control.launch("schedule")


# --- research -------------------------------------------------------------------
RESEARCH_SCHEMA = obj(
    trends=arr(obj(title=S, why_relevant=S, platform=enum(*PLATFORMS, "all"),
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
            "trends": [{"title": f, "why_relevant": d, "platform": "all", "confidence": "low", "source_url": ""}
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
BRIEF = obj(angle=S, hook_idea=S, hook_type=S, objective=enum("portée", "engagement", "abonnés"))
STRATEGY_SCHEMA = obj(briefs=arr(BRIEF, 10))


def growth_strategy(job: dict) -> dict:
    """Allocation (platform x pillar x format) comes from the bandit; the LLM only writes angles and hooks."""
    ch = active_character()
    plan = job["payload"]["plan"]
    follow_ups = plan.get("follow_ups", [])
    n_new = max(plan["contents"] - len(follow_ups), 0)
    slots = growth.allocate(n_new, plan.get("platform_slots") or plan["platforms"], [p["name"] for p in ch["pillars"]], job["run_id"])
    exp = growth.current_experiment(job["run_id"])
    fallback = library.briefs_for_slots(slots, ch, job["run_id"], exp)
    inp = {"slots": slots, "pillars": ch["pillars"], "trends": job["payload"]["trends"], "opportunities": job["payload"]["opportunities"],
           "experiment": {k: exp[k] for k in ("variable", "variant_a", "variant_b")},
           "rule": "one brief per slot, same order; respect slot pillar/format/platform; strong, specific angle"}
    data = llm(_task("growth", "strategy", inp, STRATEGY_SCHEMA, 1500), job, lambda: {"briefs": fallback}) if slots else {"briefs": []}
    briefs = []
    for i, slot in enumerate(slots):
        b = {**fallback[i], **(data["briefs"][i] if i < len(data["briefs"]) else {}), **slot}
        b["experiment"] = fallback[i]["experiment"]  # assignment is deterministic, never left to the LLM
        if exp["variable"] == "hook_type":
            b["hook_type"] = b["experiment"]["value"]
        else:
            b["duration"] = b["experiment"]["value"]
        briefs.append(b)
    for f in follow_ups:
        briefs.append(library.follow_up_brief(f))
    library.attach_series(briefs, db.rows("SELECT * FROM series WHERE status='active'"))
    _research("strategy", f"Stratégie : {len(briefs)} briefs (bandit + {len(follow_ups)} suite(s))", db.dumps(briefs), _src(data), "n/a", job["run_id"])
    queue.enqueue("reviewer.challenge", "reviewer", {"briefs": briefs}, run_id=job["run_id"], priority=7)
    return {"briefs": len(briefs), "experiment": exp["id"], "source": _src(data)}


# --- reviewer -------------------------------------------------------------------
CHALLENGE_SCHEMA = obj(reviews=arr(obj(index=I, keep=B, risk=S, improvement=S), 10))


def primary_account(platform: str) -> str | None:
    return db.scalar("SELECT id FROM accounts WHERE platform=? AND status='active' ORDER BY created_at LIMIT 1", (platform,))


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
        episode = None
        if b.get("series_id"):
            db.execute("UPDATE series SET episodes=episodes+1, updated_at=? WHERE id=?", (db.now(), b["series_id"]))
            episode = db.scalar("SELECT episodes FROM series WHERE id=?", (b["series_id"],))
        db.insert("contents", {"id": cid, "run_id": job["run_id"], "title": f"{b['pillar']} · {b['angle']}"[:200],
                               "stage": "concept", "status": "in_progress", "platform": b["platform"], "format": b["format"],
                               "pillar": b["pillar"], "meta": db.dumps({"brief": b, "review": rev, "experiment": b.get("experiment"),
                                                                        "follow_up_of": b.get("follow_up_of")}),
                               "hashtags": "[]", "account_id": primary_account(b["platform"]), "series_id": b.get("series_id"),
                               "episode": episode, "created_at": db.now(), "updated_at": db.now()})
        history(cid, "reviewer", "created_from_brief", {"risk": rev.get("risk")})
        if b.get("follow_up_of"):
            orig = get_content(b["follow_up_of"]["id"])
            save_content(orig["id"], "reviewer", "double_down_created", {"follow_up": cid}, meta={**orig["meta"], "doubled_down": True})
        queue.enqueue("creative.develop", "creative", {}, run_id=job["run_id"], content_id=cid, priority=6)
        created.append(cid)
    return {"created": created, "dropped": len(briefs) - len(created)}


def reviewer_qc(job: dict) -> dict:
    c = get_content(job["content_id"])
    ch = active_character()
    res = compliance.check_content(c, storage.content_assets(c["id"]), ch["disclosure"]["short"], sponsor_of(c))
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
    series = db.one("SELECT name, premise FROM series WHERE id=?", (c["series_id"],)) if c.get("series_id") else None
    dur = growth.DURATIONS.get(brief.get("duration", ""), (15, 35))
    inp = {"brief": brief, "platform": c["platform"], "format": c["format"], "language": db.setting("language"),
           "feedback": fb, "target_duration_s": f"{dur[0]}-{dur[1]}", "hook_type": brief.get("hook_type"),
           "series": {**series, "episode": c.get("episode")} if series else None,
           "follow_up_of": c["meta"].get("follow_up_of"),
           "sponsor": brief.get("sponsor"),
           "hook_patterns": [h for _, h in library.HOOKS[:4]]}
    data = llm(_task("creative", "develop", inp, CREATIVE_SCHEMA, 1800), job,
               lambda: library.script_for({**brief, "series_name": series and series["name"], "episode": c.get("episode")}, ch, c["id"] + fb))
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
        return {"caption": library.fit_caption(c["caption"], c["platform"], tag), "hashtags": library.hashtags_for(c["pillar"] or "", c["platform"]),
                "keywords": [w for w in re.findall(r"\w{5,}", c["title"].lower())][:5], "notes": "heuristique hors ligne"}

    data = llm(_task("platform", "optimize", {"platform": c["platform"], "caption": c["caption"], "pillar": c["pillar"],
                                              "title": c["title"], "disclosure_tag": tag}, PLATFORM_SCHEMA, 600), job, offline)
    caption, _ = compliance.ensure_disclosure(library.fit_caption(data["caption"], c["platform"], tag), tag)
    tags = [t if t.startswith("#") else f"#{t}" for t in data["hashtags"]][: PLATFORMS[c["platform"]]["hashtags"] - 1]
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


def sponsor_of(c: dict) -> str | None:
    return db.scalar("SELECT name FROM collabs WHERE id=?", (c["deal_id"],)) if c.get("deal_id") else None


def _overlay_label(c: dict) -> str:
    """Burned-in mentions, visible for the whole video (French influencer law)."""
    return f"Collaboration commerciale\n{media.DISCLOSURE}" if c.get("deal_id") else media.DISCLOSURE


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
        d = media.build_video([storage.abs_path(a["path"]) for a in visuals], out, texts, voice, label=_overlay_label(c))
        storage.register(rel, "final", src, content_id=c["id"], meta={"duration_s": round(d, 2), "w": 1080, "h": 1920})
        info = {"video_s": round(d, 2)}
    else:
        n = 0
        for a in visuals:
            if not a["path"].lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            rel, out = storage.new_path(f"contents/{c['id']}", ".jpg")
            media.normalize_image(storage.abs_path(a["path"]), out, label=_overlay_label(c))
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
    acc = db.one("SELECT handle, status FROM accounts WHERE id=?", (c["account_id"],)) if c.get("account_id") else None
    if acc and acc["status"] != "active":
        history(c["id"], "planner", "schedule_held", {"account": acc["handle"], "status": acc["status"]})
        notify("Planification suspendue", f"{c['title']} : compte {acc['handle']} {acc['status']}. Réactivez-le puis relancez.", "warn", "#/accounts")
        return {"held": True, "account_status": acc["status"]}
    when = job["payload"].get("scheduled_at")
    if not when:
        tz = ZoneInfo(load_env().timezone)
        hours = (db.setting("posting_hours") or {}).get(c["platform"], ["12:00"])
        taken = {r["scheduled_at"] for r in db.rows("SELECT scheduled_at FROM contents WHERE platform=? AND scheduled_at IS NOT NULL", (c["platform"],))}
        start = datetime.now(timezone.utc).astimezone(tz) + timedelta(hours=1)
        if job["payload"].get("not_before"):
            start = max(start, datetime.fromisoformat(job["payload"]["not_before"]).astimezone(tz))
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


def create_variant(parent_id: str, platform: str, actor: str = "user") -> dict:
    """Cross-post an APPROVED video to another mainstream platform: same media, platform-fitted caption/hashtags,
    deterministic QC. The human approval of the parent explicitly listed this platform."""
    c = get_content(parent_id)
    if platform not in PLATFORMS or platform == c["platform"]:
        return {"platform": platform, "skipped": "plateforme invalide"}
    if c["format"] not in VIDEO_FORMATS:
        return {"platform": platform, "skipped": "format non vidéo (carrousel/photo) : pas de déclinaison"}
    if db.one("SELECT 1 FROM contents WHERE parent_id=? AND platform=?", (parent_id, platform)):
        return {"platform": platform, "skipped": "variante déjà créée"}
    if not primary_account(platform) and db.one("SELECT 1 FROM accounts WHERE platform=?", (platform,)):
        return {"platform": platform, "skipped": "compte en pause ou restreint"}
    tag = active_character()["disclosure"]["short"]
    vid = db.new_id("CNT")
    sponsor = sponsor_of(c)
    room = tag + (f"Collaboration commerciale avec {sponsor} · " if sponsor else "")
    caption, _ = compliance.ensure_disclosure(library.fit_caption(c["caption"] or "", platform, room), tag)
    db.insert("contents", {
        "id": vid, "run_id": c["run_id"], "parent_id": parent_id, "title": f"{c['title']} [{PLATFORMS[platform]['label']}]"[:200],
        "stage": "approval", "status": "in_progress", "platform": platform, "format": PLATFORMS[platform]["formats"][0],
        "pillar": c["pillar"], "concept": c["concept"], "hook": c["hook"], "script": db.dumps(c["script"]),
        "prompts": db.dumps(c["prompts"]), "caption": caption, "hashtags": db.dumps(library.hashtags_for(c["pillar"] or "", platform)),
        "meta": db.dumps({**{k: v for k, v in c["meta"].items() if k not in ("experiment", "follow_up_of")},
                          "variant_of": parent_id, "doubled_down": True}), "account_id": primary_account(platform),
        "series_id": c.get("series_id"), "episode": c.get("episode"), "deal_id": c.get("deal_id"),
        "created_at": db.now(), "updated_at": db.now()})
    for a in storage.content_assets(parent_id):
        if a["kind"] == "final":
            db.insert("assets", {**a, "id": db.new_id("AST"), "content_id": vid, "created_at": db.now()})
    history(vid, actor, "variant_created", {"parent": parent_id, "platform": platform})
    v = get_content(vid)
    res = compliance.check_content(v, storage.content_assets(vid), tag, sponsor_of(v))
    qc = {k: res[k] for k in ("passed", "score", "blockers", "warnings", "fixes")} | {"checked_at": db.now(), "by": "rules"}
    if not res["passed"]:
        save_content(vid, "reviewer", "qc_failed", qc, qc=qc, caption=res["caption"], status="needs_revision", stage="qc")
        return {"platform": platform, "id": vid, "status": "needs_revision"}
    save_content(vid, actor, "approved_with_parent", {"parent": parent_id}, qc=qc, caption=res["caption"], status="approved")
    return {"platform": platform, "id": vid, "status": "approved"}


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
    out: dict = {"experiments": [], "slots": {}}
    for exp in db.rows("SELECT * FROM experiments WHERE status IN ('running','proposed')"):
        ev = growth.evaluate_experiment(exp)
        out["experiments"].append({"id": exp["id"], **ev})
        if ev["p_b_better"] is not None and not ev["decision"].startswith(("données", "collecte")):
            txt = (f"{ev['decision']} · P(B>A)={ev['p_b_better']:.0%} · lift {ev['lift']:+.0%} · ER A {ev['A']['er']:.2%} "
                   f"({ev['A']['views']} vues) vs B {ev['B']['er']:.2%} ({ev['B']['views']} vues)") if ev["lift"] is not None else ev["decision"]
            db.update("experiments", "id", exp["id"], {"status": "concluded", "result": txt, "updated_at": db.now()})
            _research("insight", f"Expérience conclue: {exp['variable']}", txt, "analyst", "manual", None)
            notify("Expérience A/B conclue", f"{exp['hypothesis']} → {ev['decision']}", "info", "#/growth")
    for platform in PLATFORMS:
        sl = growth.best_slots(platform)
        if sl:
            out["slots"][platform] = sl[:3]
            _research("insight", f"Créneau gagnant {platform}: {sl[0]['slot']}",
                      f"indice moyen {sl[0]['avg_index']} sur {sl[0]['n']} contenus (heure locale)", "analyst", "manual", None)
    out["learn"] = _learn_formats()
    return out


def _learn_formats() -> dict:
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


def analyst_watch(job: dict) -> dict:
    """Hourly: account health anomalies -> notifications (each alert once per key)."""
    sent = 0
    for a in growth.anomalies():
        if db.one("SELECT 1 FROM alerts_seen WHERE key=?", (a["key"],)):
            continue
        db.insert("alerts_seen", {"key": a["key"], "at": db.now()})
        notify(a["title"], a["body"], a["level"], a["link"])
        sent += 1
    return {"alerts": sent}


def analyst_weekly_review(job: dict) -> dict:
    from ..reports import write_weekly_review
    return {"path": str(write_weekly_review())}


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


OUTREACH_SCHEMA = obj(subject=S, message=S, value_proposition=S)


def community_outreach_draft(job: dict) -> dict:
    """Draft (never sends) a collaboration message. Transparent: the creator is an AI character run by a team."""
    col = db.one("SELECT * FROM collabs WHERE id=?", (job["payload"]["collab_id"],))
    if not col:
        raise queue.PermanentError("collab introuvable")
    ch = active_character()

    def offline() -> dict:
        idea = {"creator": "un duo / une vidéo croisée sur un thème commun", "brand": "une intégration produit non explicite et sincère",
                "media": "une interview sur la création d'une influenceuse IA transparente", "engage": "un échange en commentaires"}[col["kind"]]
        return {"subject": f"Idée de collab avec {ch['name']} ({ch['disclosure']['bio_line']})",
                "message": f"Salut {col['name']} ! On gère {ch['name']}, une créatrice virtuelle générée par IA (et on le dit clairement). "
                           f"On adore ce que tu fais sur {col['platform'] or 'les réseaux'} et on pense à {idea}. "
                           "Ça te dirait d'en parler ? L'équipe de " + ch["name"],
                "value_proposition": idea}

    data = llm(_task("community", "outreach", {"collab": {k: col[k] for k in ("kind", "name", "platform", "handle", "notes")},
                                               "character": ch["name"], "disclosure": ch["disclosure"]["bio_line"]},
                     OUTREACH_SCHEMA, 600), job, offline)
    msg = data["message"]
    if compliance.check_text(f"{data['subject']} {msg}"):
        raise queue.PermanentError("brouillon non conforme")
    if not re.search(r"\b(ia|ai)\b|virtuel", msg.lower()):
        msg += f"\n\n({ch['disclosure']['bio_line']})"
    db.update("collabs", "id", col["id"], {"draft_message": f"{data['subject']}\n\n{msg}", "updated_at": db.now()})
    return {"collab": col["id"], "source": _src(data)}


HANDLERS = {
    "orchestrator.plan": orchestrator_plan, "orchestrator.autolaunch": orchestrator_autolaunch,
    "research.scan": research_scan, "growth.strategy": growth_strategy,
    "reviewer.challenge": reviewer_challenge, "reviewer.qc": reviewer_qc,
    "creative.develop": creative_develop, "platform.optimize": platform_optimize, "prompt.build": prompt_build,
    "producer.generate": producer_generate, "producer.edit": producer_edit,
    "planner.schedule": planner_schedule, "publisher.prepare": publisher_prepare,
    "analyst.analyze": analyst_analyze, "analyst.learn": analyst_learn, "analyst.daily_brief": analyst_daily_brief,
    "community.triage": community_triage, "community.outreach_draft": community_outreach_draft,
    "analyst.watch": analyst_watch, "analyst.weekly_review": analyst_weekly_review,
}

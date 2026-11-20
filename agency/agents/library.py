"""Offline content library: generic, original patterns (no competitor content copied).
Used by the `offline` LLM mode so the whole pipeline works with zero API cost. Outputs are drafts."""
from __future__ import annotations

import hashlib
import random

HOOKS = [  # {topic} is a noun phrase with its article ("la routine du matin")
    ("liste", "3 erreurs que je faisais avec {topic}"),
    ("contre-intuitif", "Personne ne te dit ça sur {topic}"),
    ("pov", "POV : une IA t'explique {topic}"),
    ("défi", "J'ai testé {topic} pendant 7 jours"),
    ("question", "Toi aussi tu galères avec {topic} ?"),
    ("coulisses", "Dans les coulisses : {topic}"),
    ("rapide", "{topic} en 30 secondes chrono"),
    ("transparence", "Oui je suis une IA, et voici mon avis sur {topic}"),
]
from ..config import PLATFORMS

FORMATS = {p: v["formats"] for p, v in PLATFORMS.items()}
EVERGREEN_FORMATS = [
    ("Tutoriel en étapes", "Promesse claire + 3 étapes visuelles + récap", "tutorial"),
    ("Avant / après", "Contraste visuel fort dès la 1re seconde", "reel"),
    ("Storytime", "Situation relatable + tension + chute", "storytime"),
    ("Carrousel conseils", "Slide 1 = promesse, slides 2-6 = 1 idée chacune, dernière = question", "carousel"),
    ("Coulisses IA", "Montrer le processus de création de façon transparente", "talking_head"),
]
HASHTAGS = {
    "Vie étudiante": ["#etudiante", "#viedetudiante", "#fac", "#revisions"],
    "Style & beauté accessibles": ["#ootd", "#streetwear", "#petitbudget", "#lookdujour"],
    "Vie de quartier & famille": ["#famille", "#quartier", "#viedequartier", "#humour"],
    "Culture marocaine & cuisine": ["#maroc", "#cuisinemarocaine", "#recette", "#darija"],
    "Coulisses d'une créatrice IA": ["#creatriceIA", "#intelligenceartificielle", "#coulisses", "#virtualcreator"],
}
CTAS = ["Dis-moi en commentaire laquelle tu préfères 👇", "Enregistre pour plus tard 📌",
        "Tu veux la partie 2 ? Commente « 2 »", "Partage à quelqu'un qui en a besoin"]


def rng(*seed: str) -> random.Random:
    return random.Random(int(hashlib.sha256("|".join(seed).encode()).hexdigest()[:12], 16))


def pick_briefs(character: dict, platforms: list[str], n: int, insights: list[dict], seed: str) -> list[dict]:
    r = rng(seed)
    pillars = character["pillars"][:]
    preferred = {i.get("title", "").split(":")[-1].strip() for i in insights if i.get("title", "").startswith("Format gagnant")}
    briefs = []
    for i in range(n):
        p = pillars[i % len(pillars)]
        platform = platforms[i % len(platforms)]
        formats = [f for f in FORMATS[platform] if f in preferred] or FORMATS[platform]
        hook_type, hook_tpl = r.choice(HOOKS)
        topic = r.choice(p["topics"])
        hook = hook_tpl.format(topic=topic)
        briefs.append({"platform": platform, "format": r.choice(formats), "pillar": p["name"], "angle": topic,
                       "hook_idea": hook[0].upper() + hook[1:], "hook_type": hook_type,
                       "objective": r.choice(["portée", "engagement", "abonnés"])})
    return briefs


def script_for(brief: dict, character: dict, seed: str) -> dict:
    r = rng(seed, "script")
    topic, name = brief["angle"], character["name"]
    n_steps = {"court": 1, "long": 4}.get(brief.get("duration", ""), 3)
    steps = [f"Astuce {k} sur {topic} : une idée simple, montrée à l'écran" for k in range(1, n_steps + 1)]
    beats = [{"t": "0-2s", "visual": f"Gros plan sur {name}, regard caméra, décor lumineux", "on_screen_text": brief["hook_idea"], "voiceover": brief["hook_idea"]}]
    for k, s in enumerate(steps):
        beats.append({"t": f"{2 + k * 6}-{8 + k * 6}s", "visual": f"Plan illustrant l'étape {k + 1} ({topic})", "on_screen_text": f"Astuce {k + 1}", "voiceover": s})
    cta = r.choice(CTAS)
    end = 2 + n_steps * 6
    beats.append({"t": f"{end}-{end + 4}s", "visual": f"{name} sourit, geste vers la caméra", "on_screen_text": cta, "voiceover": cta})
    prefix = f"{brief['series_name']} #{brief.get('episode') or '?'} · " if brief.get("series_name") else ""
    if brief.get("sponsor"):
        prefix = f"Partenariat {brief['sponsor']['brand']} · "
        beats.insert(-1, {"t": f"{end - 4}-{end}s", "visual": f"{name} montre le produit {brief['sponsor']['brand']} en situation réelle",
                          "on_screen_text": f"Collaboration commerciale · {brief['sponsor']['brand']}",
                          "voiceover": brief["sponsor"].get("key_message") or f"Merci à {brief['sponsor']['brand']} pour ce partenariat"})
    return {
        "title": f"{prefix}{brief['pillar']} · {topic}",
        "concept": f"{brief['format']} sur « {topic} » ({brief['pillar']}), angle {brief['hook_type']}, objectif {brief['objective']}.",
        "hook": brief["hook_idea"],
        "script": {"duration_s": end + 4, "beats": beats},
        "caption": f"{brief['hook_idea']}\n\n{cta}",
        "cta": cta,
    }


def hashtags_for(pillar: str, platform: str) -> list[str]:
    limit = PLATFORMS.get(platform, PLATFORMS["instagram"])["hashtags"]
    return (PLATFORMS.get(platform, {}).get("tags", []) + HASHTAGS.get(pillar, []))[: limit - 1] + ["#IA"]


def fit_caption(caption: str, platform: str, tag: str) -> str:
    """Short-caption platforms (Shorts title, Spotlight): keep the first line + room for the AI tag."""
    limit = PLATFORMS.get(platform, PLATFORMS["instagram"])["caption"]
    if len(caption) + len(tag) + 2 <= limit:
        return caption
    first = (caption.split("\n")[0] or caption)[: max(10, limit - len(tag) - 3)].rstrip()
    return first


def _hook(hook_type: str, topic: str, r: random.Random) -> tuple[str, str]:
    choices = [h for h in HOOKS if h[0] == hook_type] or HOOKS
    t, tpl = r.choice(choices)
    h = tpl.format(topic=topic)
    return t, h[0].upper() + h[1:]


def briefs_for_slots(slots: list[dict], character: dict, seed: str, experiment: dict) -> list[dict]:
    """Offline briefs for bandit slots; experiment arms alternate A/B so both get comparable exposure."""
    r = rng(seed, "slots")
    pillars = {p["name"]: p for p in character["pillars"]}
    out = []
    for i, slot in enumerate(slots):
        p = pillars.get(slot["pillar"]) or character["pillars"][0]
        topic = r.choice(p["topics"])
        variant = "A" if i % 2 == 0 else "B"
        value = experiment["variant_a"] if variant == "A" else experiment["variant_b"]
        hook_type = value if experiment["variable"] == "hook_type" else r.choice(HOOKS)[0]
        t, hook = _hook(hook_type, topic, r)
        out.append({**slot, "angle": topic, "hook_idea": hook, "hook_type": t, "objective": r.choice(["portée", "engagement", "abonnés"]),
                    "experiment": {"id": experiment["id"], "variable": experiment["variable"], "variant": variant, "value": value}})
    return out


def follow_up_brief(f: dict) -> dict:
    """Double down on a winner: same platform/format/pillar, explicit part 2."""
    return {"platform": f["platform"], "format": f["format"], "pillar": f["pillar"], "angle": f"suite de « {f['title']} »",
            "hook_idea": f"Partie 2 : {f['hook'] or f['title']}"[:120], "hook_type": "suite", "objective": "portée",
            "follow_up_of": {"id": f["id"], "title": f["title"], "hook": f["hook"], "perf_index": f["perf_index"]}}


def attach_series(briefs: list[dict], series: list[dict]) -> None:
    """At most one episode per active series per run, on the first brief matching its pillar (and platform if set)."""
    for s in series:
        for b in briefs:
            if b.get("series_id") or b.get("follow_up_of"):
                continue
            if s["pillar"] in (None, "", b["pillar"]) and s["platform"] in (None, "", b["platform"]):
                b["series_id"], b["series_name"] = s["id"], s["name"]
                if s.get("format") and s["format"] in FORMATS.get(b["platform"], []):
                    b["format"] = s["format"]
                break


def image_prompts(content: dict, character: dict, negative: str) -> list[dict]:
    v = character["visual_identity"]
    base = (f"photo réaliste verticale, {character['name']}, femme adulte ({v['age_appearance']}), {v['face']}, "
            f"cheveux {v['hair']}, yeux {v['eyes']}, {v['signature']}, style {v['style']}, {v['photography']}, tenue du quotidien couvrante")
    beats = (content.get("script") or {}).get("beats", [])[:4] or [{"visual": content.get("concept", "")}]
    return [{"shot": f"plan {k + 1}", "prompt": f"{base}, scène : {b['visual']}", "negative_prompt": negative,
             "aspect_ratio": "9:16" if content["platform"] == "tiktok" or content["format"] != "carousel" else "4:5"}
            for k, b in enumerate(beats)]

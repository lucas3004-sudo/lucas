"""Offline content library: generic, original patterns (no competitor content copied).
Used by the `offline` LLM mode so the whole pipeline works with zero API cost. Outputs are drafts."""
from __future__ import annotations

import hashlib
import random

HOOKS = [
    ("liste", "3 erreurs que je faisais avec {topic} (la 2e surtout)"),
    ("contre-intuitif", "Personne ne parle de ça quand on parle de {topic}"),
    ("pov", "POV : tu découvres {topic} version créatrice IA"),
    ("défi", "J'ai testé {topic} pendant 7 jours, voilà le bilan"),
    ("question", "Tu fais aussi ça avec {topic} ?"),
    ("coulisses", "Ce que vous ne voyez pas derrière {topic}"),
    ("rapide", "{topic} en moins de 30 secondes"),
    ("transparence", "Oui je suis une IA, et voici comment je gère {topic}"),
]
FORMATS = {
    "tiktok": ["talking_head", "tutorial", "storytime", "day_in_life", "pov", "trend_remix"],
    "instagram": ["reel", "carousel", "photo", "reel"],
}
EVERGREEN_FORMATS = [
    ("Tutoriel en étapes", "Promesse claire + 3 étapes visuelles + récap", "tutorial"),
    ("Avant / après", "Contraste visuel fort dès la 1re seconde", "reel"),
    ("Storytime", "Situation relatable + tension + chute", "storytime"),
    ("Carrousel conseils", "Slide 1 = promesse, slides 2-6 = 1 idée chacune, dernière = question", "carousel"),
    ("Coulisses IA", "Montrer le processus de création de façon transparente", "talking_head"),
]
HASHTAGS = {
    "Style du quotidien": ["#ootd", "#lookdujour", "#modeaccessible", "#styleinspo"],
    "Routines & bien-être": ["#routinedumatin", "#bienetre", "#organisation", "#selfcare"],
    "Coulisses d'une créatrice IA": ["#creatriceIA", "#intelligenceartificielle", "#coulisses", "#virtualcreator"],
    "Tendances & mini-défis": ["#defi7jours", "#tendance", "#challenge", "#pourtoi"],
}
PLATFORM_TAGS = {"tiktok": ["#pourtoi", "#fyp"], "instagram": ["#reels", "#inspiration"]}
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
        briefs.append({"platform": platform, "format": r.choice(formats), "pillar": p["name"], "angle": topic,
                       "hook_idea": hook_tpl.format(topic=topic), "hook_type": hook_type,
                       "objective": r.choice(["portée", "engagement", "abonnés"])})
    return briefs


def script_for(brief: dict, character: dict, seed: str) -> dict:
    r = rng(seed, "script")
    topic, name = brief["angle"], character["name"]
    steps = [f"Astuce {k} : une idée simple et concrète sur {topic}" for k in (1, 2, 3)]
    beats = [{"t": "0-2s", "visual": f"Gros plan sur {name}, regard caméra, décor lumineux", "on_screen_text": brief["hook_idea"], "voiceover": brief["hook_idea"]}]
    for k, s in enumerate(steps):
        beats.append({"t": f"{2 + k * 6}-{8 + k * 6}s", "visual": f"Plan illustrant l'étape {k + 1} ({topic})", "on_screen_text": f"{k + 1}.", "voiceover": s})
    cta = r.choice(CTAS)
    beats.append({"t": "20-24s", "visual": f"{name} sourit, geste vers la caméra", "on_screen_text": cta, "voiceover": cta})
    return {
        "title": f"{brief['pillar']} · {topic}",
        "concept": f"{brief['format']} sur « {topic} » ({brief['pillar']}), angle {brief['hook_type']}, objectif {brief['objective']}.",
        "hook": brief["hook_idea"],
        "script": {"duration_s": 24, "beats": beats},
        "caption": f"{brief['hook_idea']}\n\n{cta}",
        "cta": cta,
    }


def hashtags_for(pillar: str, platform: str) -> list[str]:
    return (HASHTAGS.get(pillar, []) + PLATFORM_TAGS.get(platform, []))[:6] + ["#IA"]


def image_prompts(content: dict, character: dict, negative: str) -> list[dict]:
    v = character["visual_identity"]
    base = (f"photo réaliste verticale, {character['name']}, femme adulte ({v['age_appearance']}), {v['face']}, "
            f"cheveux {v['hair']}, yeux {v['eyes']}, {v['signature']}, style {v['style']}, {v['photography']}, tenue du quotidien couvrante")
    beats = (content.get("script") or {}).get("beats", [])[:4] or [{"visual": content.get("concept", "")}]
    return [{"shot": f"plan {k + 1}", "prompt": f"{base}, scène : {b['visual']}", "negative_prompt": negative,
             "aspect_ratio": "9:16" if content["platform"] == "tiktok" or content["format"] != "carousel" else "4:5"}
            for k, b in enumerate(beats)]

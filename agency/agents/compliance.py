"""Deterministic compliance + quality rules (run before any LLM review: free and predictable)."""
from __future__ import annotations

import re

from ..config import PLATFORMS, VIDEO_FORMATS

BLOCK_PATTERNS = {
    "explicit": r"\b(nude|nudes|nu(e|es)?\s+int[ée]gral|porn\w*|xxx|nsfw|sex(e|uel|uelle)?\b|[ée]rotique|fetish|f[ée]tich\w*|strip[- ]?tease|seins nus|topless|lingerie sexy)",
    "adult_platform": r"\b(onlyfans|only\s*fans|fanvue|mym\.fans|\bmym\b|fansly|patreon\s*18|18\+|contenu (priv[ée]|exclusif) payant)",
    "solicitation": r"(lien (en|dans (la|ma)) bio pour (plus|voir)|dm (moi )?pour (plus|du contenu)|abonne[- ]?toi pour voir|contenu non censur[ée])",
    "minor": r"\b(mineure?s?|ado(lescente)?s?|teen\w*|lyc[ée]enne|coll[ée]gienne|schoolgirl|petite fille|loli\w*|barely legal|tout juste majeure|petite jeune)\b",
    "fake_human": r"(je suis une vraie (fille|femme|personne)|pas une ia\b|not an ai|real (girl|person|woman)|je ne suis pas une ia)",
}
WARN_PATTERNS = {
    "suggestive": r"\b(sexy|sensuel\w*|hot\b|d[ée]collet[ée]|maillot|bikini|lingerie)",
    "unsourced_stat": r"\b\d{1,3}\s?%|\b\d+\s?(millions?|milliards?)\b",
    "absolute_claim": r"\b(garanti|100\s?% efficace|miracle|jamais rat[ée])",
}
SFW_NEGATIVE = ("nudity, nsfw, cleavage focus, lingerie, suggestive pose, minor, childlike features, "
                "real celebrity likeness, logo, watermark, text artifacts, extra fingers")


def scan(text: str) -> tuple[list[str], list[str]]:
    t = (text or "").lower()
    blocks = [k for k, p in BLOCK_PATTERNS.items() if re.search(p, t)]
    warns = [k for k, p in WARN_PATTERNS.items() if re.search(p, t)]
    return blocks, warns


# French influencer law (loi n° 2023-451): AI-generated face/silhouette -> "Image virtuelle";
# commercial partnership -> "Publicité" or "Collaboration commerciale". To be confirmed by a lawyer.
VIRTUAL_MENTION = "image virtuelle"
SPONSOR_MENTIONS = ("collaboration commerciale", "publicité")
# Categories banned or heavily restricted for influencer promotion (same law + sector rules): block sponsorship.
RESTRICTED_SPONSOR = r"(chirurgi\w* esth[ée]tique|injection|botox|nicotine|vape|puff|cigarette|crypto|trading|forex|nft|" \
                     r"paris sportifs?|casino|jeux d'argent|pronostic|m[ée]dicament|abstention th[ée]rapeutique|animaux sauvages)"


def ensure_disclosure(caption: str, tag: str) -> tuple[str, bool]:
    low = (caption or "").lower()
    if VIRTUAL_MENTION in low:
        return caption, False
    return (caption.rstrip() + f"\n\n{tag}").strip(), True


def ensure_sponsor(caption: str, brand: str) -> tuple[str, bool]:
    low = (caption or "").lower()
    if any(m in low for m in SPONSOR_MENTIONS):
        return caption, False
    return f"Collaboration commerciale avec {brand} · {caption}".strip(), True


def restricted_sponsor(text: str) -> list[str]:
    import re as _re
    return sorted(set(_re.findall(RESTRICTED_SPONSOR, (text or "").lower())))


def check_content(c: dict, assets: list[dict], disclosure_tag: str, sponsor: str | None = None) -> dict:
    """Returns {passed, score, blockers[], warnings[], fixes[], caption}."""
    blockers, warnings, fixes = [], [], []
    script = c.get("script") or {}
    beats = script.get("beats", []) if isinstance(script, dict) else []
    text_all = " ".join(filter(None, [
        c.get("title"), c.get("concept"), c.get("hook"), c.get("caption"), " ".join(c.get("hashtags") or []),
        " ".join(f"{b.get('visual', '')} {b.get('on_screen_text', '')} {b.get('voiceover', '')}" for b in beats),
        " ".join(p.get("prompt", "") for p in (c.get("prompts") or {}).get("image_prompts", [])),
    ]))
    b, w = scan(text_all)
    blockers += [f"interdit:{x}" for x in b]
    warnings += [f"à vérifier:{x}" for x in w]

    caption, fixed = ensure_disclosure(c.get("caption") or "", disclosure_tag)
    if fixed:
        fixes.append("mention « Image virtuelle » ajoutée à la légende")
    if sponsor:
        caption, fixed = ensure_sponsor(caption, sponsor)
        if fixed:
            fixes.append("mention « Collaboration commerciale » ajoutée en tête de légende")
        if restricted_sponsor(f"{sponsor} {c.get('concept', '')} {caption}"):
            blockers.append("catégorie de produit interdite ou encadrée pour la promotion par influenceur")
    lim = PLATFORMS.get(c["platform"], PLATFORMS["instagram"])
    if len(caption) > lim["caption"]:
        blockers.append(f"légende trop longue ({len(caption)}>{lim['caption']})")
    tags = c.get("hashtags") or []
    if len(tags) > lim["hashtags"]:
        warnings.append(f"trop de hashtags ({len(tags)}>{lim['hashtags']})")
    if not c.get("hook"):
        blockers.append("hook manquant")
    elif len(c["hook"].split()) > 14:
        warnings.append("hook long (>14 mots) : risque de perte d'attention")
    is_video = c["format"] in VIDEO_FORMATS
    if is_video and not beats:
        blockers.append("script vidéo sans séquences")
    if is_video and script.get("duration_s", 0) > 90:
        warnings.append("durée > 90 s")
    if not any(k in (c.get("caption") or "").lower() for k in ("?", "commente", "dis-moi", "enregistre", "partage")):
        warnings.append("pas d'appel à l'action clair")
    finals = [a for a in assets if a["kind"] == "final"]
    if any(a["source"] == "placeholder" for a in assets):
        blockers.append("visuels provisoires (placeholder) : non publiable")
    elif not finals:
        blockers.append("aucun fichier final monté")
    score = max(0, 100 - 30 * len(blockers) - 7 * len(warnings))
    return {"passed": not blockers and score >= 60, "score": score, "blockers": blockers,
            "warnings": warnings, "fixes": fixes, "caption": caption}


def check_text(text: str) -> list[str]:
    """Used for community replies and prompts."""
    b, _ = scan(text)
    return b

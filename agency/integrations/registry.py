"""Integration status. Status vocabulary: not_configured | configured | verified | error | unavailable.
`verified` is only ever set by a real successful test call."""
from __future__ import annotations

from .. import db
from ..config import has_secret, load_env
from . import elevenlabs, media

CATALOG = {
    "anthropic": {"label": "Claude API (Anthropic)", "purpose": "Agents en mode api", "secret": "ANTHROPIC_API_KEY", "paid": True,
                  "docs": "https://platform.claude.com/docs"},
    "elevenlabs": {"label": "ElevenLabs", "purpose": "Voix off (TTS), gestion des voix", "secret": "ELEVENLABS_API_KEY", "paid": True,
                   "docs": "https://elevenlabs.io/docs"},
    "alexya": {"label": "Alexya", "purpose": "Génération d'images/vidéos du personnage", "secret": "ALEXYA_API_KEY", "paid": True,
               "docs": "https://alexya.ai", "note": "API non vérifiée : mode manuel (prompts → Alexya → zone Drop) en attendant."},
    "ffmpeg": {"label": "ffmpeg", "purpose": "Montage vidéo/image local", "secret": None, "paid": False, "docs": "https://ffmpeg.org"},
    "webhook": {"label": "Webhook notifications", "purpose": "Discord / Slack / JSON", "secret": None, "paid": False, "docs": ""},
    "instagram": {"label": "Instagram Graph API", "purpose": "Publication + statistiques", "secret": None, "paid": False,
                  "docs": "https://developers.facebook.com/docs/instagram-platform",
                  "note": "Non intégré : compte pro + app Meta validée requis. Publication = export manuel."},
    "tiktok": {"label": "TikTok Content Posting API", "purpose": "Publication + statistiques", "secret": None, "paid": False,
               "docs": "https://developers.tiktok.com", "note": "Non intégré : app TikTok auditée requise. Publication = export manuel."},
}


def _last(name: str) -> dict | None:
    return db.one("SELECT * FROM integration_checks WHERE name=?", (name,))


def _save(name: str, status: str, details: dict) -> dict:
    db.execute("INSERT INTO integration_checks(name,status,checked_at,details) VALUES (?,?,?,?) "
               "ON CONFLICT(name) DO UPDATE SET status=excluded.status, checked_at=excluded.checked_at, details=excluded.details",
               (name, status, db.now(), db.dumps(details)))
    return {"status": status, "details": details}


def status_all() -> list[dict]:
    out = []
    for name, meta in CATALOG.items():
        if meta["secret"]:
            base = "configured" if has_secret(meta["secret"]) else "not_configured"
        elif name == "ffmpeg":
            base = "configured" if media.available() else "unavailable"
        elif name == "webhook":
            base = "configured" if load_env().notify_webhook_url else "not_configured"
        else:
            base = "unavailable"
        last = _last(name)
        status = last["status"] if last and base == "configured" and last["status"] in ("verified", "error") else base
        out.append({"name": name, **meta, "status": status, "last_check": last and {**last, "details": db.loads(last["details"], {})}})
    return out


def test(name: str) -> dict:
    try:
        if name == "elevenlabs":
            sub = elevenlabs.subscription()
            return _save(name, "verified", {"subscription": sub, "voices": len(elevenlabs.voices(page_size=10))})
        if name == "ffmpeg":
            if not media.available():
                return _save(name, "error", {"error": "ffmpeg/ffprobe introuvable"})
            return _save(name, "verified", {"ok": True})
        if name == "anthropic":
            if not has_secret("ANTHROPIC_API_KEY"):
                return _save(name, "error", {"error": "ANTHROPIC_API_KEY manquante"})
            import anthropic
            m = anthropic.Anthropic().models.retrieve("claude-haiku-5-5")  # free metadata call, no tokens billed
            return _save(name, "verified", {"model": m.id})
        if name == "webhook":
            from ..events import notify
            notify("Test de notification", "Si vous lisez ceci, le webhook fonctionne.")
            last = db.one("SELECT delivered FROM notifications ORDER BY id DESC LIMIT 1")
            return _save(name, "verified" if last and last["delivered"] else "error", {"delivered": bool(last and last["delivered"])})
        return {"status": "unavailable", "details": {"reason": CATALOG.get(name, {}).get("note", "pas de test disponible")}}
    except Exception as e:  # report any failure honestly
        return _save(name, "error", {"error": str(e)[:300]})

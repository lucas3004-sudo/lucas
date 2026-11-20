"""ElevenLabs REST client (official API, auth header `xi-api-key`).
Endpoints implemented from the public API reference as known on 2026-11-20; the docs were NOT reachable from the
build environment, so this client is UNVERIFIED until `POST /api/integrations/elevenlabs/test` succeeds with a real key."""
from __future__ import annotations

import httpx

from ..config import has_secret, secret

BASE = "https://api.elevenlabs.io"
DEFAULT_MODEL = "eleven_multilingual_v2"  # multilingual (incl. French)


class ElevenLabsError(RuntimeError):
    pass


def configured() -> bool:
    return has_secret("ELEVENLABS_API_KEY")


def _client() -> httpx.Client:
    if not configured():
        raise ElevenLabsError("ELEVENLABS_API_KEY missing")
    return httpx.Client(base_url=BASE, headers={"xi-api-key": secret("ELEVENLABS_API_KEY")}, timeout=60)


def _check(r: httpx.Response) -> httpx.Response:
    if r.status_code >= 400:
        raise ElevenLabsError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r


def subscription() -> dict:
    with _client() as c:
        d = _check(c.get("/v1/user/subscription")).json()
    keys = ("tier", "character_count", "character_limit", "next_character_count_reset_unix", "status")
    return {k: d.get(k) for k in keys}


def voices(search: str = "", page_size: int = 50) -> list[dict]:
    params = {"page_size": page_size, **({"search": search} if search else {})}
    with _client() as c:
        d = _check(c.get("/v2/voices", params=params)).json()
    return [{"voice_id": v.get("voice_id"), "name": v.get("name"), "category": v.get("category"),
             "labels": v.get("labels"), "preview_url": v.get("preview_url")} for v in d.get("voices", [])]


def tts(voice_id: str, text: str, model_id: str = DEFAULT_MODEL, settings: dict | None = None,
        output_format: str = "mp3_44100_128") -> bytes:
    if not voice_id:
        raise ElevenLabsError("voice_id missing (Character Studio > Voix)")
    body = {"text": text, "model_id": model_id or DEFAULT_MODEL}
    if settings:
        body["voice_settings"] = {k: settings[k] for k in ("stability", "similarity_boost", "style", "use_speaker_boost", "speed") if k in settings}
    with _client() as c:
        r = _check(c.post(f"/v1/text-to-speech/{voice_id}", params={"output_format": output_format}, json=body))
    if not r.headers.get("content-type", "").startswith("audio"):
        raise ElevenLabsError(f"unexpected content-type {r.headers.get('content-type')}")
    return r.content

"""`python -m agency doctor`: pre-flight checks before the first launch. Never prints secret values, never spends money."""
from __future__ import annotations

import importlib
import socket
import sys

OK, WARN, FAIL = "[OK]  ", "[!]   ", "[X]   "


def run(network: bool = False) -> int:
    from .config import ROOT, has_secret, load_env
    env = load_env()
    fails = 0
    lines: list[str] = []

    def out(status: str, msg: str, fix: str = "") -> None:
        nonlocal fails
        fails += status == FAIL
        lines.append(f"{status}{msg}" + (f"\n        -> {fix}" if fix else ""))

    v = sys.version_info
    out(OK if v >= (3, 11) else FAIL, f"Python {v.major}.{v.minor}", "" if v >= (3, 11) else "installer Python 3.11+ (python.org)")
    for mod, pkg in (("fastapi", "fastapi"), ("uvicorn", "uvicorn"), ("httpx", "httpx"), ("multipart", "python-multipart")):
        try:
            importlib.import_module(mod)
            out(OK, f"dépendance {pkg}")
        except ImportError:
            out(FAIL, f"dépendance {pkg} manquante", 'relancer l\'installateur ou: pip install -e ".[api]"')
    try:
        importlib.import_module("anthropic")
        out(OK, "SDK Anthropic (mode api)")
    except ImportError:
        out(WARN, "SDK Anthropic absent (seulement utile en mode api)", 'pip install -e ".[api]"')
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(env.timezone)
        out(OK, f"fuseau horaire {env.timezone}")
    except Exception:
        out(FAIL, f"fuseau horaire {env.timezone} introuvable", "pip install tzdata (Windows)")

    from .integrations import media
    if media.available():
        out(OK, "ffmpeg + ffprobe")
        out(OK if media._font() else WARN, "police pour les textes vidéo", "" if media._font() else "installer une police (Arial / DejaVu Sans)")
    else:
        out(FAIL, "ffmpeg introuvable (montage impossible)",
            "Windows: winget install Gyan.FFmpeg  |  macOS: brew install ffmpeg  |  Linux: apt install ffmpeg  (puis rouvrir le terminal)")

    try:
        env.data_dir.mkdir(parents=True, exist_ok=True)
        probe = env.data_dir / ".write-test"
        probe.write_text("ok")
        probe.unlink()
        out(OK, f"dossier de données accessible ({env.data_dir})")
    except OSError as e:
        out(FAIL, f"dossier de données non accessible : {e}", "vérifier AGENCY_DATA_DIR dans .env")
    try:
        from . import db
        db.configure()
        n = db.scalar("SELECT COUNT(*) FROM schema_migrations")
        out(OK, f"base de données prête ({n} migrations)")
        from .agents.character import active_character
        ch = active_character()
        out(WARN if ch.get("is_placeholder") else OK, f"personnage : {ch['name']}" + (" (profil par défaut, à personnaliser)" if ch.get("is_placeholder") else ""))
        accs = db.scalar("SELECT COUNT(*) FROM accounts")
        out(OK if accs else WARN, f"comptes enregistrés : {accs}", "" if accs else "page Comptes : ajouter TikTok / Instagram")
        s = db.get_settings()
        out(OK, f"mode LLM : {s['llm_mode']} · appels payants {'AUTORISÉS' if s['allow_paid_calls'] else 'bloqués'} · visuels : {s['image_provider']}")
    except Exception as e:  # report, do not crash
        out(FAIL, f"base de données : {e}")

    out(OK if (ROOT / ".env").is_file() else WARN, "fichier .env", "" if (ROOT / ".env").is_file() else "copier .env.example en .env")
    for name, why in (("ELEVENLABS_API_KEY", "voix off"), ("ANTHROPIC_API_KEY", "mode api (payant)"), ("ALEXYA_API_KEY", "visuels automatiques")):
        out(OK if has_secret(name) else WARN, f"{name} {'présente' if has_secret(name) else 'absente'} ({why})")
    out(WARN if env.host not in ("127.0.0.1", "localhost") and not env.admin_token else OK,
        f"exposition : {env.host}" + ("" if env.admin_token or env.host in ("127.0.0.1", "localhost") else " SANS jeton"),
        "définir AGENCY_ADMIN_TOKEN avant d'exposer le dashboard" if env.host not in ("127.0.0.1", "localhost") and not env.admin_token else "")

    with socket.socket() as sock:
        free = sock.connect_ex(("127.0.0.1", env.port)) != 0
    out(OK if free else WARN, f"port {env.port} {'libre' if free else 'déjà utilisé (agence déjà lancée ?)'}",
        "" if free else "changer AGENCY_PORT dans .env ou fermer l'autre instance")

    if network:
        import httpx
        for host in ("api.anthropic.com", "api.elevenlabs.io", "alexya.ai"):
            try:
                httpx.head(f"https://{host}", timeout=6, follow_redirects=True)
                out(OK, f"réseau : {host} joignable")
            except httpx.HTTPError as e:
                out(WARN, f"réseau : {host} injoignable ({type(e).__name__})")

    print("AI Agency OS - diagnostic\n" + "\n".join(lines))
    print("\nPRÊT - lancer avec : python -m agency serve" if not fails else f"\n{fails} problème(s) bloquant(s) à corriger avant de lancer.")
    return 1 if fails else 0

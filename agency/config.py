"""Configuration. Secrets come ONLY from the environment / .env and are never stored in the DB
nor returned by the API. Runtime (non-secret) settings live in the `settings` table."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(os.environ.get("AGENCY_ROOT") or Path(__file__).resolve().parent.parent)

# Hard-coded guardrails: intentionally NOT configurable (no env var, no UI toggle).
ADULT_CONTENT_ENABLED = False
HUMAN_APPROVAL_REQUIRED = True
AI_DISCLOSURE_REQUIRED = True


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (no dependency). Existing env vars win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Env:
    data_dir: Path
    host: str
    port: int
    timezone: str
    admin_token: str
    llm_mode: str
    notify_webhook_url: str
    notify_webhook_format: str

    @property
    def db_path(self) -> Path:
        return self.data_dir / "agency.db"

    @property
    def storage_dir(self) -> Path:
        return self.data_dir / "storage"

    @property
    def cc_dir(self) -> Path:  # Claude Code task exchange (inbox/outbox)
        return self.data_dir / "claude_code"


def secret(name: str) -> str:
    """Read a secret at call time (never cached, never logged)."""
    return os.environ.get(name, "").strip()


def has_secret(name: str) -> bool:
    return bool(secret(name))


_env: Env | None = None


def load_env(reload: bool = False) -> Env:
    global _env
    if _env is not None and not reload:
        return _env
    _load_dotenv(ROOT / ".env")
    data_dir = Path(os.environ.get("AGENCY_DATA_DIR", str(ROOT / "data"))).resolve()
    _env = Env(
        data_dir=data_dir,
        host=os.environ.get("AGENCY_HOST", "127.0.0.1"),
        port=int(os.environ.get("AGENCY_PORT", "8000")),
        timezone=os.environ.get("AGENCY_TIMEZONE", "Europe/Paris"),
        admin_token=os.environ.get("AGENCY_ADMIN_TOKEN", "").strip(),
        llm_mode=os.environ.get("AGENCY_LLM_MODE", "offline").strip() or "offline",
        notify_webhook_url=os.environ.get("NOTIFY_WEBHOOK_URL", "").strip(),
        notify_webhook_format=os.environ.get("NOTIFY_WEBHOOK_FORMAT", "json").strip(),
    )
    for d in (_env.data_dir, _env.storage_dir, _env.cc_dir / "inbox", _env.cc_dir / "outbox"):
        d.mkdir(parents=True, exist_ok=True)
    return _env


# Default runtime settings (editable in the dashboard, stored in DB).
DEFAULT_SETTINGS: dict = {
    "llm_mode": None,  # None -> use AGENCY_LLM_MODE
    "allow_paid_calls": False,
    "fallback_to_offline": True,
    "daily_budget_usd": 1.0,
    "monthly_budget_usd": 10.0,
    "model_routing": {"simple": "claude-haiku-5-5", "standard": "claude-sonnet-5-5", "complex": "claude-opus-5-5"},
    "contents_per_run": 3,
    "platforms": ["tiktok", "instagram"],
    "language": "fr",
    "posting_hours": {"tiktok": ["12:30", "19:00"], "instagram": ["11:30", "18:30"]},
    "image_provider": "manual",  # manual | placeholder | alexya (alexya disabled until API verified)
    "voice_enabled": False,  # ElevenLabs generation consumes account credits -> explicit opt-in
    "voice_daily_char_cap": 5000,
    "max_upload_mb": 200,
}

LOCKED_SETTINGS = {
    "adult_content": False,
    "human_approval_before_publish": True,
    "ai_disclosure": True,
}

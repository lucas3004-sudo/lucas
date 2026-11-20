import os

import pytest


@pytest.fixture()
def agency_env(tmp_path, monkeypatch):
    """Isolated data dir + DB per test. Never touches the real data/ or briefs/."""
    monkeypatch.setenv("AGENCY_DATA_DIR", str(tmp_path / "data"))
    for k in ("ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "AGENCY_ADMIN_TOKEN", "NOTIFY_WEBHOOK_URL"):
        monkeypatch.setenv(k, "")
    monkeypatch.setenv("AGENCY_LLM_MODE", "offline")
    monkeypatch.setenv("AGENCY_ALLOWED_HOSTS", "testserver")
    from agency import config, reports, worker
    config.load_env(reload=True)
    monkeypatch.setattr(reports, "BRIEFS_DIR", tmp_path / "briefs")
    worker.boot()
    yield tmp_path
    config.load_env(reload=True)


@pytest.fixture()
def client(agency_env):
    from fastapi.testclient import TestClient

    from agency.api.app import create_app
    return TestClient(create_app())


@pytest.fixture()
def image_file(agency_env):
    from agency.integrations import media
    p = agency_env / "photo.png"
    media.placeholder_image(p, "photo test", 1080, 1350, "0x8FA58A")
    return p


os.environ.setdefault("AGENCY_LLM_MODE", "offline")

"""Safety guards: locked settings, budgets, auth, community escalation, API provider accounting (mocked SDK)."""
from types import SimpleNamespace

import pytest

from agency import db
from agency.llm import gateway


def test_locked_and_invalid_settings(client):
    assert client.put("/api/settings", json={"adult_content": True}).status_code == 403
    assert client.put("/api/settings", json={"human_approval_before_publish": False}).status_code == 403
    assert client.put("/api/settings", json={"llm_mode": "gpt"}).status_code == 400
    assert client.put("/api/settings", json={"daily_budget_usd": 5000}).status_code == 400
    assert client.put("/api/settings", json={"contents_per_run": 4}).json()["contents_per_run"] == 4


def test_upload_rejects_bad_extension(client, agency_env):
    p = agency_env / "x.exe"
    p.write_bytes(b"MZ")
    with p.open("rb") as f:
        r = client.post("/api/uploads", files={"file": ("x.exe", f)}, data={"non_explicit": "true"})
    assert r.status_code == 400


def test_character_must_stay_compliant_and_adult(client):
    assert client.put("/api/character", json={"bio": "lien OnlyFans en bio"}).status_code == 422
    assert client.put("/api/character", json={"age": 15}).json()["age"] == 18


def test_admin_token(agency_env, monkeypatch):
    from fastapi.testclient import TestClient

    from agency import config
    from agency.api.app import create_app
    monkeypatch.setenv("AGENCY_ADMIN_TOKEN", "s3cret")
    config.load_env(reload=True)
    c = TestClient(create_app())
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/overview").status_code == 401
    assert c.get("/api/overview", headers={"Authorization": "Bearer s3cret"}).status_code == 200


def test_secrets_never_exposed(client, monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "el-secret-value")
    body = client.get("/api/integrations").text + client.get("/api/settings").text + client.get("/api/overview").text
    assert "el-secret-value" not in body
    el = next(i for i in client.get("/api/integrations").json() if i["name"] == "elevenlabs")
    assert el["status"] == "configured"  # configured != verified: only a real test call verifies


def test_community_triage_escalates_sensitive(client):
    msgs = [{"platform": "tiktok", "author": "a", "text": "Trop beau ce look 😍"},
            {"platform": "tiktok", "author": "b", "text": "Es-tu une IA ?"},
            {"platform": "instagram", "author": "c", "text": "tu as un onlyfans ?"},
            {"platform": "instagram", "author": "d", "text": "j'ai 15 ans et je t'adore"},
            {"platform": "instagram", "author": "e", "text": "Partenariat avec notre marque ?"}]
    r = client.post("/api/messages/import", json={"messages": msgs}).json()
    assert r["imported"] == 5 and r["triage"]["status"] == "done"
    got = {m["author"]: m for m in client.get("/api/messages").json()}
    assert got["a"]["status"] == "drafted" and got["a"]["sentiment"] == "positive"
    assert "IA" in got["b"]["suggested_reply"]
    assert got["c"]["status"] == "needs_human" and not got["c"]["suggested_reply"]
    assert got["d"]["status"] == "needs_human" and got["d"]["escalation_reason"] == "mineur"
    assert got["e"]["status"] == "needs_human"


def _task():
    return gateway.Task("platform", "optimize", "simple", "x", {"a": 1},
                        {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False}, 100)


def test_api_mode_falls_back_when_paid_calls_disabled(agency_env):
    db.set_settings({"llm_mode": "api"})
    out = gateway.run(_task(), None, lambda: {"ok": True})
    assert out["_generated_by"] == "offline-template"
    log = db.one("SELECT * FROM activity_log WHERE action='llm_fallback_offline'")
    assert "paid calls disabled" in log["details"]


def test_api_mode_budget_guard(agency_env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    db.set_settings({"llm_mode": "api", "allow_paid_calls": True, "daily_budget_usd": 0})
    out = gateway.run(_task(), None, lambda: {"ok": True})
    assert out["_generated_by"] == "offline-template"
    assert "daily budget" in db.one("SELECT details FROM activity_log WHERE action='llm_fallback_offline'")["details"]


def test_api_call_records_measured_usage(agency_env, monkeypatch):
    anthropic = pytest.importorskip("anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    db.set_settings({"llm_mode": "api", "allow_paid_calls": True})
    seen = {}

    def create(**kw):
        seen.update(kw)
        return SimpleNamespace(stop_reason="end_turn", model=kw["model"], content=[SimpleNamespace(type="text", text='{"ok": true}')],
                               usage=SimpleNamespace(input_tokens=1000, output_tokens=200, cache_read_input_tokens=3000, cache_creation_input_tokens=0))

    fake = SimpleNamespace(messages=SimpleNamespace(create=create), beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: fake)
    out = gateway.run(_task(), None, lambda: {"ok": False})
    assert out == {"ok": True, "_generated_by": "anthropic:claude-haiku-5-5"}
    assert seen["model"] == "claude-haiku-5-5" and seen["output_config"]["effort"] == "low"
    assert seen["system"][0]["cache_control"] == {"type": "ephemeral"}
    row = db.one("SELECT * FROM llm_calls WHERE provider='anthropic'")
    assert row["token_provenance"] == "measured" and row["cost_provenance"] == "estimated"
    assert row["cost_usd"] == pytest.approx((1000 * 0.10 + 200 * 0.50 + 3000 * 0.01) / 1e6)

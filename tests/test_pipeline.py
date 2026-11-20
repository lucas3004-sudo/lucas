"""End-to-end pipeline through the API, offline mode (zero cost)."""
from agency import db, scheduler, worker


def _drain():
    return worker.run_once(ignore_state=True)


def test_full_pipeline_manual_visuals(client, image_file):
    db.set_settings({"contents_per_run": 1, "platforms": ["instagram"], "image_provider": "manual"})
    r = client.post("/api/agency/launch")
    assert r.status_code == 200
    assert client.post("/api/agency/launch").status_code == 409  # one run at a time
    _drain()
    contents = client.get("/api/contents").json()
    assert len(contents) == 1
    c = contents[0]
    assert c["status"] == "waiting_assets"  # manual mode: the human generates visuals (Alexya) and drops them

    detail = client.get(f"/api/contents/{c['id']}").json()
    assert detail["prompts"]["image_prompts"] and "nudity" in detail["prompts"]["image_prompts"][0]["negative_prompt"]

    with image_file.open("rb") as f:
        bad = client.post("/api/uploads", files={"file": ("p.png", f, "image/png")}, data={"content_id": c["id"]})
    assert bad.status_code == 400  # non-explicit attestation is mandatory
    with image_file.open("rb") as f:
        up = client.post("/api/uploads", files={"file": ("p.png", f, "image/png")}, data={"content_id": c["id"], "non_explicit": "true"})
    assert up.status_code == 200
    assert client.post(f"/api/contents/{c['id']}/continue").status_code == 200
    _drain()

    detail = client.get(f"/api/contents/{c['id']}").json()
    assert detail["status"] == "awaiting_approval", detail["qc"]
    assert any(a["kind"] == "final" for a in detail["assets"])
    assert "#IA" in detail["caption"] or "personnage virtuel" in detail["caption"]

    r = client.post(f"/api/contents/{c['id']}/approve", json={})
    assert r.status_code == 200 and r.json()["status"] == "done"
    detail = client.get(f"/api/contents/{c['id']}").json()
    assert detail["status"] == "scheduled" and detail["scheduled_at"]

    db.execute("UPDATE contents SET scheduled_at=? WHERE id=?", (db.now(-60), c["id"]))
    assert scheduler.tick()["publications_due"] == 1
    _drain()
    detail = client.get(f"/api/contents/{c['id']}").json()
    assert detail["status"] == "ready_to_publish" and any(a["kind"] == "export" for a in detail["assets"])

    assert client.post(f"/api/contents/{c['id']}/mark-published", json={"url": "https://example.com/p/1"}).status_code == 200
    assert client.post("/api/metrics", json={"content_id": c["id"], "platform": "instagram", "date": db.now()[:10],
                                             "views": 1000, "likes": 80, "comments": 12, "shares": 5, "saves": 20}).status_code == 200
    detail = client.get(f"/api/contents/{c['id']}").json()
    assert detail["status"] == "published" and detail["meta"]["performance"]["engagement_rate"] == 0.117
    actions = [h["action"] for h in detail["history"]]
    for a in ("created_from_brief", "script_written", "prompts_written", "waiting_assets", "edited", "qc_passed",
              "approved", "scheduled", "export_ready", "published", "analyzed"):
        assert a in actions
    run = client.get("/api/runs").json()[0]
    assert run["status"] == "completed"


def test_placeholder_visuals_never_pass_qc(client):
    db.set_settings({"contents_per_run": 1, "platforms": ["tiktok"], "image_provider": "placeholder"})
    client.post("/api/agency/launch")
    _drain()
    c = client.get("/api/contents").json()[0]
    assert c["status"] == "needs_revision"
    assert client.post(f"/api/contents/{c['id']}/approve").status_code == 409


def test_pause_stop_and_agent_controls(client):
    client.post("/api/agency/launch")
    assert client.post("/api/agency/pause").json()["status"] == "paused"
    assert worker.run_once() == 0  # paused: nothing runs
    assert client.post("/api/agency/resume").json()["status"] == "running"
    assert client.post("/api/agents/research/pause").json()["status"] == "paused"
    worker.run_once()  # plan runs, research is blocked
    jobs = {j["type"]: j["status"] for j in client.get("/api/jobs").json()}
    assert jobs["orchestrator.plan"] == "done" and jobs["research.scan"] == "queued"
    stopped = client.post("/api/agency/stop").json()
    assert stopped["status"] == "stopped" and stopped["cancelled_jobs"] == 1


def test_claude_code_mode_roundtrip(client):
    db.set_settings({"llm_mode": "claude_code", "contents_per_run": 1})
    client.post("/api/agency/launch")
    worker.run_once()
    tasks = client.get("/api/cc/tasks").json()
    assert len(tasks) == 1 and tasks[0]["task"] == "scan"
    t = client.get(f"/api/cc/tasks/{tasks[0]['task_id']}").json()
    assert t["schema"]["type"] == "object"
    assert client.post(f"/api/cc/tasks/{t['task_id']}/result", json={"trends": "nope"}).status_code == 422
    good = {"trends": [{"title": "Routines 5 minutes", "why_relevant": "format court", "platform": "both", "confidence": "low", "source_url": ""}],
            "competitor_patterns": [], "opportunities": [{"title": "Coulisses IA", "angle": "transparence"}]}
    assert client.post(f"/api/cc/tasks/{t['task_id']}/result", json=good).status_code == 200
    worker.run_once()
    jobs = {j["type"]: j["status"] for j in client.get("/api/jobs").json()}
    assert jobs["research.scan"] == "done" and jobs["growth.strategy"] == "waiting"
    calls = db.rows("SELECT provider, token_provenance FROM llm_calls WHERE provider='claude_code'")
    assert calls and calls[0]["token_provenance"] == "estimated"

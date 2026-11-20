"""Queue, scheduler, compliance, usage import, briefs."""
import json

from agency import db, queue, scheduler
from agency.agents import compliance


def test_queue_lease_complete_and_backoff(agency_env):
    jid = queue.enqueue("x.test", "analyst", {"a": 1}, max_attempts=2)
    job = queue.lease("w1")
    assert job["id"] == jid and job["status"] == "running" and job["attempts"] == 1 and job["payload"] == {"a": 1}
    assert queue.lease("w1") is None  # nothing else ready
    assert queue.fail(job, "boom", retryable=True) == "queued"
    row = db.one("SELECT * FROM jobs WHERE id=?", (jid,))
    assert row["run_after"] > db.now() and row["last_error"] == "boom"
    db.execute("UPDATE jobs SET run_after=? WHERE id=?", (db.now(-1), jid))
    job = queue.lease("w1")
    assert queue.fail(job, "boom again", retryable=True) == "dead"  # attempts exhausted -> dead letter
    assert queue.retry(jid) and db.one("SELECT status FROM jobs WHERE id=?", (jid,))["status"] == "queued"


def test_queue_permanent_failure_and_blocked_agents(agency_env):
    a = queue.enqueue("x.a", "creative")
    queue.enqueue("x.b", "analyst")
    job = queue.lease("w", blocked_agents={"creative"})
    assert job["agent"] == "analyst"
    assert queue.fail(job, "bad input", retryable=False) == "failed"
    assert queue.lease("w", blocked_agents={"creative"}) is None
    assert queue.lease("w")["id"] == a


def test_recover_expired_lease(agency_env):
    jid = queue.enqueue("x.c", "analyst")
    queue.lease("dead-worker", lease_s=-5)  # lease already expired: simulates a crashed worker
    assert queue.recover_expired() == 1
    assert db.one("SELECT status FROM jobs WHERE id=?", (jid,))["status"] == "queued"


def test_scheduler_specs_and_tick(agency_env):
    assert scheduler.next_run("every:3600") > db.now()
    assert scheduler.next_run("daily:07:30") > db.now()
    sid = db.one("SELECT id FROM schedules WHERE job_type='analyst.daily_brief'")["id"]
    db.execute("UPDATE schedules SET next_run_at=? WHERE id=?", (db.now(-10), sid))
    res = scheduler.tick()
    assert res["fired"] == 1
    assert db.one("SELECT COUNT(*) n FROM jobs WHERE type='analyst.daily_brief'")["n"] == 1
    assert scheduler.tick()["fired"] == 0  # claimed once only


def test_compliance_rules():
    assert "explicit" in compliance.check_text("contenu nsfw")
    assert "adult_platform" in compliance.check_text("rejoins mon OnlyFans")
    assert "fake_human" in compliance.check_text("je ne suis pas une IA, promis")
    assert "minor" in compliance.check_text("look de lycéenne")
    assert compliance.check_text("ma routine du matin en 3 étapes") == []
    cap, fixed = compliance.ensure_disclosure("Super look #IA", "Image virtuelle · #IA")
    assert fixed and cap.endswith("Image virtuelle · #IA")  # FR law wording required, "#IA" alone is not enough
    assert compliance.ensure_disclosure(cap, "Image virtuelle · #IA")[1] is False
    sp, fixed = compliance.ensure_sponsor(cap, "MarqueX")
    assert fixed and sp.startswith("Collaboration commerciale avec MarqueX")
    assert compliance.restricted_sponsor("promo crypto trading") and not compliance.restricted_sponsor("sneakers")


def test_claude_code_usage_import_dedupes(agency_env):
    from agency import usage
    proj = agency_env / "cc" / "proj-a"
    proj.mkdir(parents=True)
    lines = []
    for out in (5, 40):  # same message streamed twice -> keep the complete one
        lines.append({"type": "assistant", "sessionId": "s1", "timestamp": "2026-11-20T10:00:00Z",
                      "message": {"id": "msg_1", "model": "claude-sonnet-5-5",
                                  "usage": {"input_tokens": 100, "output_tokens": out, "cache_read_input_tokens": 1000}}})
    lines.append({"type": "user", "message": {"content": "hi"}})
    (proj / "s1.jsonl").write_text("\n".join(json.dumps(x) for x in lines))
    res = usage.import_claude_code(agency_env / "cc")
    assert res == {"imported": 1, "files": 1}
    row = db.one("SELECT * FROM cc_usage")
    assert row["output_tokens"] == 40 and row["cache_read_tokens"] == 1000
    s = usage.summary(3650)
    assert s["claude_code_sessions"][0]["api_equivalent_usd"] > 0


def test_daily_brief_written(agency_env):
    from agency import reports
    p = reports.write_daily_brief()
    text = p.read_text()
    assert p.name.endswith(".md") and "# Rapport quotidien" in text and "Ressources & coûts" in text

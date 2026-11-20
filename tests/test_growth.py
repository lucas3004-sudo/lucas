"""Growth engine: bandit, double-down, A/B statistics, cross-posting, account health, quotas, targets, weekly review."""
from datetime import datetime, timedelta, timezone

from agency import db, growth, worker


def _published(platform="tiktok", fmt="tutorial", pillar="Vie étudiante", views=1000, inter=50, account=None,
               days_ago=1, experiment=None, hook_type="question"):
    cid = db.new_id("CNT")
    when = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(timespec="seconds")
    meta = {"brief": {"hook_type": hook_type}, "experiment": experiment}
    db.insert("contents", {"id": cid, "title": f"t-{cid}", "stage": "analysis", "status": "published", "platform": platform,
                           "format": fmt, "pillar": pillar, "hook": "hook", "caption": "c #IA", "hashtags": "[]",
                           "meta": db.dumps(meta), "account_id": account, "published_at": when, "created_at": when, "updated_at": when})
    db.insert("metrics", {"content_id": cid, "platform": platform, "date": when[:10], "views": views, "likes": inter, "comments": 0,
                          "shares": 0, "saves": 0, "provenance": "manual", "created_at": db.now()})
    return cid


def test_performance_index_and_winners(agency_env):
    ids = [_published(views=v) for v in (1000, 1000, 1000, 5000)]
    perf = {p["id"]: p for p in growth.performance()}
    assert perf[ids[3]]["perf_index"] == 5.0 and perf[ids[0]]["perf_index"] == 1.0
    assert [w["id"] for w in growth.winners(2.0)] == [ids[3]]


def test_bandit_prefers_winning_pillar_but_keeps_exploring(agency_env):
    for _ in range(6):
        _published(pillar="Vie étudiante", views=4000)
        _published(pillar="Culture marocaine & cuisine", views=300)
    pillars = ["Vie étudiante", "Culture marocaine & cuisine", "Vie de quartier & famille"]
    picks = [s["pillar"] for i in range(40) for s in growth.allocate(2, ["tiktok"], pillars, f"seed{i}")]
    assert picks.count("Vie étudiante") > picks.count("Culture marocaine & cuisine")
    assert "Vie de quartier & famille" in picks  # unseen arm still explored


def test_ab_experiment_conclusion(agency_env):
    db.set_settings({"experiment_min_views": 1000})
    exp = growth.current_experiment(None)
    assert exp["status"] == "running" and growth.current_experiment(None)["id"] == exp["id"]
    for _ in range(3):
        _published(views=3000, inter=60, experiment={"id": exp["id"], "variant": "A"})
        _published(views=3000, inter=240, experiment={"id": exp["id"], "variant": "B"})
    ev = growth.evaluate_experiment(exp)
    assert ev["p_b_better"] > 0.99 and ev["decision"].startswith("B gagne") and ev["lift"] > 2
    out = worker.run_now("analyst.learn", "analyst")
    assert out["status"] == "done"
    assert db.one("SELECT status FROM experiments WHERE id=?", (exp["id"],))["status"] == "concluded"
    assert growth.current_experiment(None)["id"] != exp["id"]  # rotates to the next hypothesis


def test_experiment_needs_enough_data(agency_env):
    exp = growth.current_experiment(None)
    _published(views=100, inter=5, experiment={"id": exp["id"], "variant": "A"})
    assert growth.evaluate_experiment(exp)["decision"].startswith("données insuffisantes")


def test_run_uses_quotas_bandit_experiment_and_double_down(client):
    db.set_settings({"platforms": ["tiktok"], "auto_quota": True})
    acc = client.post("/api/accounts", json={"platform": "tiktok", "handle": "@nour.ia", "daily_quota": 1}).json()["id"]
    for v in (1000, 1000, 1000, 6000):
        _published(views=v, account=acc)
    client.post("/api/agency/launch")
    worker.run_once(ignore_state=True)
    plan = client.get("/api/runs").json()[0]["params"]
    assert plan["contents"] == 3 and plan["deficit"] == {"tiktok": 3} and len(plan["follow_ups"]) == 1
    contents = [c for c in client.get("/api/contents").json() if c["status"] != "published"]
    assert len(contents) == 3
    details = [client.get(f"/api/contents/{c['id']}").json() for c in contents]
    assert all(d["account_id"] == acc for d in details)
    assert sum(1 for d in details if d["meta"].get("follow_up_of")) == 1
    variants = {d["meta"]["experiment"]["variant"] for d in details if d["meta"].get("experiment")}
    assert variants == {"A", "B"}
    client.post("/api/agency/stop")
    rid = client.post("/api/agency/launch").json()["run_id"]  # quotas now covered by the pipeline -> nothing new
    worker.run_once(ignore_state=True)
    assert next(r for r in client.get("/api/runs").json() if r["id"] == rid)["params"]["contents"] == 0


def test_series_episodes(client):
    db.set_settings({"platforms": ["tiktok"], "contents_per_run": 2, "auto_quota": False})
    sid = client.post("/api/series", json={"name": "Les galères de Nour", "pillar": "", "premise": "une galère par épisode"}).json()["id"]
    client.post("/api/agency/launch")
    worker.run_once(ignore_state=True)
    eps = db.rows("SELECT episode, title FROM contents WHERE series_id=?", (sid,))
    assert len(eps) == 1 and eps[0]["episode"] == 1 and eps[0]["title"].startswith("Les galères de Nour #1")


def test_crosspost_variants_on_approval(client, image_file):
    db.set_settings({"platforms": ["tiktok"], "contents_per_run": 1, "auto_quota": False})
    client.post("/api/accounts", json={"platform": "youtube", "handle": "@nour-shorts"})
    client.post("/api/agency/launch")
    worker.run_once(ignore_state=True)
    c = client.get("/api/contents").json()[0]
    with image_file.open("rb") as f:
        client.post("/api/uploads", files={"file": ("p.png", f, "image/png")}, data={"content_id": c["id"], "non_explicit": "true"})
    client.post(f"/api/contents/{c['id']}/continue")
    assert client.get(f"/api/contents/{c['id']}").json()["status"] == "awaiting_approval"
    assert client.post(f"/api/contents/{c['id']}/approve", json={"crosspost": ["onlyfans"]}).status_code == 400
    r = client.post(f"/api/contents/{c['id']}/approve", json={"crosspost": ["youtube", "snapchat"]}).json()
    assert [v["status"] for v in r["variants"]] == ["approved", "approved"]
    parent = client.get(f"/api/contents/{c['id']}").json()
    for v in r["variants"]:
        d = client.get(f"/api/contents/{v['id']}").json()
        assert d["status"] == "scheduled" and d["parent_id"] == c["id"] and d["scheduled_at"] >= parent["scheduled_at"]
        assert len(d["caption"]) <= {"youtube": 100, "snapchat": 160}[d["platform"]] and "#IA" in d["caption"]
        assert any(a["kind"] == "final" for a in d["assets"])
    yt = next(v for v in r["variants"] if v["platform"] == "youtube")
    assert client.get(f"/api/contents/{yt['id']}").json()["account_id"]


def test_account_health_alerts(client):
    acc = client.post("/api/accounts", json={"platform": "instagram", "handle": "@nour", "bio": "étudiante"}).json()["id"]
    for i, v in enumerate([5000] * 8 + [1000] * 3):
        _published(platform="instagram", fmt="reel", views=v, account=acc, days_ago=20 - i)
    keys = [a["key"].split(":")[0] for a in growth.anomalies()]
    assert "drop" in keys and "gap" in keys
    assert worker.run_now("analyst.watch", "analyst")["result"]["alerts"] >= 2
    assert worker.run_now("analyst.watch", "analyst")["result"]["alerts"] == 0  # each alert once
    a = client.get("/api/accounts").json()[0]
    assert a["bio_has_disclosure"] is False and "IA" in a["suggested_bio"]
    client.post(f"/api/accounts/{acc}/events", json={"kind": "restriction", "details": "avertissement plateforme"})
    assert any(x["key"].startswith("restricted") for x in growth.anomalies())


def test_targets_forecast(client):
    acc = client.post("/api/accounts", json={"platform": "tiktok", "handle": "@n"}).json()["id"]
    base = datetime.now(timezone.utc) - timedelta(days=10)
    for d, v in ((0, 1000), (5, 1500), (10, 2000)):
        client.post(f"/api/accounts/{acc}/events", json={"kind": "followers", "value": v, "at": (base + timedelta(days=d)).isoformat()})
    deadline = (base + timedelta(days=30)).date().isoformat()
    client.post("/api/targets", json={"account_id": acc, "metric": "followers", "target": 3500, "deadline": deadline})
    t = client.get("/api/targets").json()[0]
    assert t["current"] == 2000 and t["forecast"]["per_day"] == 100.0 and t["forecast"]["provenance"] == "forecast"
    assert 3900 <= t["forecast"]["projected"] <= 4100 and t["on_track"] is True


def test_collab_draft_and_weekly_review(client):
    cid = client.post("/api/collabs", json={"kind": "creator", "name": "Créatrice cuisine", "platform": "tiktok"}).json()["id"]
    assert client.post("/api/collabs", json={"kind": "brand", "name": "x", "notes": "onlyfans"}).status_code == 422
    d = client.post(f"/api/collabs/{cid}/draft").json()
    assert d["status"] == "done" and "IA" in d["collab"]["draft_message"]
    path = client.post("/api/reviews/weekly").json()["path"]
    assert path.startswith("weekly-")
    intel = client.get("/api/growth/intel").json()
    assert {"winners", "arms", "slots", "anomalies", "targets"} <= set(intel)


def test_review_fixes_dates_restricted_accounts_and_variant_samples(client):
    acc = client.post("/api/accounts", json={"platform": "tiktok", "handle": "@x"}).json()["id"]
    assert client.post("/api/targets", json={"account_id": acc, "metric": "followers", "target": 10, "deadline": "bientôt"}).status_code == 400
    assert client.post(f"/api/accounts/{acc}/events", json={"kind": "followers", "value": "beaucoup"}).status_code == 400
    assert client.post(f"/api/accounts/{acc}/events", json={"kind": "followers", "value": 10, "at": "hier"}).status_code == 400
    assert client.patch(f"/api/accounts/{acc}", json={"notes": "lien onlyfans"}).status_code == 422
    assert client.put("/api/settings", json={"daily_budget_usd": "abc"}).status_code == 400
    # restricted account: approved content is held, not scheduled
    cid = _published(account=acc)
    db.execute("UPDATE contents SET status='approved' WHERE id=?", (cid,))
    client.patch(f"/api/accounts/{acc}", json={"status": "restricted"})
    res = worker.run_now("planner.schedule", "planner", {}, content_id=cid)
    assert res["result"]["held"] is True and db.one("SELECT status FROM contents WHERE id=?", (cid,))["status"] == "approved"
    # cross-post variants never count as A/B samples nor trigger their own double-down
    exp = growth.current_experiment(None)
    parent = _published(views=1000, experiment={"id": exp["id"], "variant": "A"})
    v = _published(views=9000, experiment={"id": exp["id"], "variant": "A"})
    meta = db.loads(db.one("SELECT meta FROM contents WHERE id=?", (v,))["meta"])
    db.execute("UPDATE contents SET meta=? WHERE id=?", (db.dumps({**meta, "variant_of": parent}), v))
    assert growth.evaluate_experiment(exp)["A"]["contents"] == 1
    assert v not in [w["id"] for w in growth.winners(1.5)]


def test_acquisition_ranking_and_benchmark(client):
    for views, fol, series in ((1000, 30, True), (1000, 20, True), (1000, 2, False), (1000, 4, False)):
        cid = _published(views=views)
        db.execute("UPDATE metrics SET followers_delta=? WHERE content_id=?", (fol, cid))
        if series:
            db.execute("UPDATE contents SET series_id='SER-x' WHERE id=?", (cid,))
    acq = {(a["lever"], a["value"]): a for a in growth.acquisition()}
    assert acq[("série", "oui")]["followers_per_1k_views"] == 25.0 and acq[("série", "non")]["followers_per_1k_views"] == 3.0
    client.post("/api/competitors", json={"platform": "tiktok", "handle": "@rival", "avg_views": 2000})
    b = client.get("/api/growth/intel").json()["benchmark"][0]
    assert b["own_avg_views"] == 1000 and b["ratio"] == 0.5


def test_niche_lab_offline_is_honest_and_apply(client):
    r = client.post("/api/niches/analyze").json()
    assert r["status"] == "done" and "hors ligne" in r["result"]["recommendation"]
    n = client.get("/api/niches").json()[0]
    assert n["score"] is None and n["provenance"] == "template"  # no market data -> no fake score
    assert growth.niche_score({"audience_demand": "high", "competition": "low", "brand_monetization": "high",
                               "persona_fit": "high", "content_sustainability": "high"}) == 100
    db.insert("research_items", {"id": "RES-n1", "kind": "niche", "title": "Cuisine étudiante", "source": "claude-code", "provenance": "observed",
                                 "body": db.dumps({"name": "Cuisine étudiante", "pillars": [{"name": "Recettes à 2 €", "topics": ["les pâtes au four"]}]}),
                                 "created_at": db.now()})
    applied = client.post("/api/niches/RES-n1/apply").json()
    assert applied["pillars"] == ["Recettes à 2 €"] and client.get("/api/character").json()["niche"] == "Cuisine étudiante"

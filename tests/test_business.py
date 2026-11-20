"""Monetisation: legal mentions on sponsored content, restricted categories, deliverables, payment, economics, media kit."""
from agency import db, worker


def _brand(client, **kw):
    cid = client.post("/api/collabs", json={"kind": "brand", "name": "SneakCo", "platform": "tiktok", **kw}).json()["id"]
    client.patch(f"/api/collabs/{cid}", json={"stage": "agreed", "deal_value": 300, "deliverables": 2, "due_date": "2026-12-15",
                                              "notes": "baskets confortables pour la fac"})
    return cid


def test_restricted_categories_refused(client):
    assert client.post("/api/collabs", json={"kind": "brand", "name": "CryptoMax", "notes": "trading crypto"}).status_code == 422
    cid = client.post("/api/collabs", json={"kind": "brand", "name": "Marque"}).json()["id"]
    assert client.patch(f"/api/collabs/{cid}", json={"notes": "puff goût mangue"}).status_code == 422
    assert client.post(f"/api/collabs/{cid}/deliverables").status_code == 409  # not agreed yet


def test_sponsored_deliverables_carry_legal_mentions(client, image_file):
    cid = _brand(client)
    r = client.post(f"/api/collabs/{cid}/deliverables").json()
    assert len(r["created"]) == 2
    assert client.post(f"/api/collabs/{cid}/deliverables").json()["created"] == []  # idempotent
    c = r["created"][0]
    with image_file.open("rb") as f:
        client.post("/api/uploads", files={"file": ("p.png", f, "image/png")}, data={"content_id": c, "non_explicit": "true"})
    client.post(f"/api/contents/{c}/continue")
    d = client.get(f"/api/contents/{c}").json()
    assert d["status"] == "awaiting_approval", d["qc"]
    assert d["caption"].startswith("Collaboration commerciale avec SneakCo") and "Image virtuelle" in d["caption"]
    assert d["title"].startswith("Partenariat SneakCo")


def test_payment_creates_revenue_once_and_economics(client):
    cid = _brand(client)
    client.post(f"/api/collabs/{cid}/deliverables")
    assert client.post(f"/api/collabs/{cid}/paid").json()["finance_entry"]
    assert client.post(f"/api/collabs/{cid}/paid").json() == {"already_paid": True}
    fin = db.rows("SELECT * FROM finance_entries WHERE deal_id=?", (cid,))
    assert len(fin) == 1 and fin[0]["amount"] == 300 and fin[0]["provenance"] == "manual"
    eco = client.get("/api/business/economics").json()
    sponsored = [x for x in eco["contents"] if x["deal_id"] == cid]
    assert len(sponsored) == 2 and all(x["revenue_eur"] == 150 for x in sponsored)
    assert eco["totals"]["revenue_eur"] == 300 and eco["provenance"]["llm_cost"] == "estimated"


def test_media_kit_and_rate_card_need_your_cpm(client):
    acc = client.post("/api/accounts", json={"platform": "tiktok", "handle": "@nour", "followers": 5000}).json()["id"]
    for v in (2000, 4000):
        cid = db.new_id("CNT")
        db.insert("contents", {"id": cid, "title": "x", "stage": "analysis", "status": "published", "platform": "tiktok", "format": "pov",
                               "account_id": acc, "hashtags": "[]", "meta": "{}", "published_at": db.now(), "created_at": db.now(), "updated_at": db.now()})
        db.insert("metrics", {"content_id": cid, "platform": "tiktok", "date": db.now()[:10], "views": v, "likes": 100, "provenance": "manual", "created_at": db.now()})
    k = client.get("/api/business/media-kit").json()
    assert k["platforms"][0]["avg_views_last10"] == 3000 and k["rate_card"] == [] and k["rate_card_note"]
    assert client.put("/api/settings", json={"cpm_eur": {"low": 10, "high": 20}}).status_code == 200
    k = client.get("/api/business/media-kit").json()
    assert k["rate_card"][0]["low_eur"] == 30 and k["rate_card"][0]["high_eur"] == 60 and k["rate_card"][0]["provenance"] == "estimated"
    md = client.post("/api/business/media-kit/export").json()["markdown"]
    assert "Kit média" in md and "Image virtuelle" in md or "image virtuelle" in md.lower()

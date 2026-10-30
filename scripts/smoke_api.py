"""Smoke test script for ReliefOS API endpoints."""
from __future__ import annotations
import json
import os
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["OFFLINE_MODE"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from backend.app import create_app

def test_api():
    app = create_app({"DATABASE_URL": "sqlite:///:memory:"})
    client = app.test_client()

    print("[1] Testing GET /api/health")
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.get_json()
    assert data["status"] == "ok"
    assert data["mode"] == "offline"
    assert "rules" in data["providers"]
    print("    OK:", data)

    print("[2] Testing GET /api/join")
    r = client.get("/api/join")
    assert r.status_code == 200
    data = r.get_json()
    assert "url" in data and "ip" in data
    print("    OK: url =", data["url"])

    print("[3] Testing GET /api/locations")
    r = client.get("/api/locations")
    assert r.status_code == 200
    locs = r.get_json()
    assert len(locs) >= 8
    print(f"    OK: {len(locs)} locations loaded")

    print("[4] Testing GET /api/items")
    r = client.get("/api/items")
    assert r.status_code == 200
    items = r.get_json()
    assert len(items) == 5
    print(f"    OK: {len(items)} items found")

    print("[5] Testing GET /api/vehicles")
    r = client.get("/api/vehicles")
    assert r.status_code == 200
    print(f"    OK: {len(r.get_json())} vehicles found")

    print("[6] Testing GET /api/demands")
    r = client.get("/api/demands")
    assert r.status_code == 200
    demands = r.get_json()
    print(f"    OK: {len(demands)} demands in seeded DB")

    print("[7] Testing POST /api/intake (Headline demo sentence)")
    intake_payload = {
        "text": "Camp 17 needs drinking water for approx 600 people, urgent",
        "client_uuid": "smoke-test-uuid-001"
    }
    r = client.post("/api/intake", json=intake_payload)
    assert r.status_code == 201
    dem = r.get_json()
    assert dem["item_id"] == "water"
    assert dem["beneficiaries"] == 600
    assert dem["urgency"] == "critical"
    assert dem["camp_id"] == "camp17"
    print("    OK: parsed ->", dem["item"], dem["beneficiaries"], dem["urgency"])

    print("[7b] Testing Idempotency on /api/intake")
    r2 = client.post("/api/intake", json=intake_payload)
    assert r2.status_code == 200
    assert r2.get_json()["id"] == dem["id"]
    print("    OK: idempotent UUID returned same ID")

    print("[8] Testing POST /api/public/report")
    pub_payload = {
        "text": "Camp 8 ke paas log beemar hain please medical kits bhejo turant",
        "phone": "+91 99999 88888",
        "client_uuid": "smoke-pub-uuid-002"
    }
    r = client.post("/api/public/report", json=pub_payload)
    assert r.status_code == 201
    pub_res = r.get_json()
    assert pub_res["status"] == "received"
    print("    OK: public report received id =", pub_res["id"])

    print("[9] Testing POST /api/demands/<id>/correct")
    r = client.post(f"/api/demands/{dem['id']}/correct", json={"qty": 600.0, "notes": "Coordinator set qty to 600"})
    assert r.status_code == 200
    assert r.get_json()["qty"] == 600.0
    print("    OK: demand corrected")

    print("[10] Testing POST /api/demands/<id>/verify")
    r = client.post(f"/api/demands/{dem['id']}/verify")
    assert r.status_code == 200
    assert r.get_json()["verified"] is True
    print("    OK: demand verified")

    print("[11] Testing GET /api/stock")
    r = client.get("/api/stock")
    assert r.status_code == 200
    stock = r.get_json()
    assert len(stock) >= 4
    print(f"    OK: {len(stock)} stock lots retrieved")

    print("[12] Testing POST /api/supply/paste")
    paste_payload = {"text": "Ludhiana Depot: 2000 litres drinking water, 500 blankets"}
    r = client.post("/api/supply/paste", json=paste_payload)
    assert r.status_code == 200
    print("    OK: paste created lots:", len(r.get_json()))

    print("[13] Testing POST /api/supply/csv")
    csv_text = "item,qty,unit,depot_id\nwater,1000,litre,amritsar-depot\nfood,500,packet,amritsar-depot"
    r = client.post("/api/supply/csv", data=csv_text, content_type="text/csv")
    assert r.status_code == 200
    print("    OK: csv imported lots:", len(r.get_json()))

    print("[14] Testing POST /api/match/run")
    r = client.post("/api/match/run", json={"algorithm": "greedy"})
    assert r.status_code == 200
    plan = r.get_json()
    assert "recommendations" in plan
    assert "conflicts" in plan
    assert "warnings" in plan
    assert "shortages" in plan
    assert "surplus" in plan
    print(f"    OK: Plan generated with {len(plan['recommendations'])} moves, {len(plan['conflicts'])} conflicts, {len(plan['warnings'])} warnings")

    print("[15] Testing GET /api/plan/latest")
    r = client.get("/api/plan/latest")
    assert r.status_code == 200
    assert "recommendations" in r.get_json()
    print("    OK: latest plan retrieved")

    if plan["recommendations"]:
        first_move = plan["recommendations"][0]
        m_id = first_move["id"]
        print(f"[16] Testing Move State Actions for {m_id}")
        r = client.post(f"/api/moves/{m_id}/approve")
        assert r.status_code == 200
        assert r.get_json()["state"] == "approved"

        r = client.post(f"/api/moves/{m_id}/edit", json={"qty": 150.0, "notes": "Adjusted down"})
        assert r.status_code == 200
        assert r.get_json()["state"] == "edited"

        r = client.post(f"/api/moves/{m_id}/reject", json={"reason": "Bridge washed out"})
        assert r.status_code == 200
        assert r.get_json()["state"] == "rejected"
        print("    OK: Move state machine approve/edit/reject passed")

    print("[17] Testing GET /api/audit")
    r = client.get("/api/audit")
    assert r.status_code == 200
    audits = r.get_json()
    assert len(audits) >= 1
    print(f"    OK: {len(audits)} audit entries found")

    print("[18] Testing GET /api/shortages")
    r = client.get("/api/shortages")
    assert r.status_code == 200
    print(f"    OK: {len(r.get_json())} shortages reported")

    print("\n>>> ALL 18 API ENDPOINT SMOKE TESTS PASSED! <<<")

if __name__ == "__main__":
    test_api()

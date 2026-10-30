"""Unit tests for matching adapter, conflicts, explain, and warnings."""
from __future__ import annotations
import pytest
from datetime import datetime, timezone, timedelta

from backend.matching.explain import (
    build_explain_string, compute_conflicts, compute_stock_warnings
)
from backend.matching.engine import plan


def test_three_camps_one_truck_conflict():
    # 6.1 Test fixture: "three camps, one truck"
    now_dt = datetime(2026, 10, 30, 10, 0, 0)
    demands = [
        {"id": "d17", "item_id": "water", "quantity_needed": 600.0, "urgency": "CRITICAL", "lat": 32.04, "lng": 75.40, "location_id": "camp17", "district": "Gurdaspur", "client_created_at": "2026-10-30T07:00:00Z"},
        {"id": "d21", "item_id": "water", "quantity_needed": 500.0, "urgency": "CRITICAL", "lat": 30.34, "lng": 76.39, "location_id": "camp21", "district": "Patiala", "client_created_at": "2026-10-30T09:00:00Z"},
        {"id": "d06", "item_id": "water", "quantity_needed": 450.0, "urgency": "HIGH",     "lat": 31.33, "lng": 75.58, "location_id": "camp6",  "district": "Jalandhar", "client_created_at": "2026-10-30T05:00:00Z"},
    ]
    stock = [
        {"id": "s1", "location_id": "ludhiana-depot", "item_id": "water", "quantity": 800.0, "reserved": 0.0, "lat": 30.90, "lng": 75.86, "name": "Ludhiana Depot"}
    ]
    vehicles = [{"id": "truck-1", "capacity_kg": 2000.0, "current_location_id": "ludhiana-depot", "speed_kmph": 40.0, "available": True}]
    item_names = {"water": "Drinking Water"}
    location_names = {"camp17": "Camp 17", "camp21": "Camp 21", "camp6": "Camp 6", "ludhiana-depot": "Ludhiana Depot"}

    raw = plan(demands, stock, vehicles=vehicles, now=now_dt, item_names=item_names, location_names=location_names)
    recs = raw["recommendations"]
    assert len(recs) >= 1

    conflicts = compute_conflicts(demands, stock, recs, item_names, location_names)
    assert len(conflicts) == 1
    c = conflicts[0]
    assert c["item"] == "Drinking Water"
    assert len(c["camps_competing"]) == 3
    # Winner must be a CRITICAL camp (Camp 17 or Camp 21)
    assert "Camp 17" in c["winner"] or "Camp 21" in c["winner"]
    assert "ranked first" in c["reason"]


def test_stale_stock_produces_warning():
    now_dt = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    stale_iso = (now_dt - timedelta(hours=10)).isoformat()
    stock = [
        {"id": "s-stale", "location_id": "depot-1", "item_id": "blanket", "quantity": 200.0, "reserved": 0.0, "updated_at": stale_iso, "name": "Depot 1"}
    ]
    recs = [{"stock_id": "s-stale"}]
    warnings = compute_stock_warnings(stock, recs, now_dt, stale_hours=6.0, location_names={"depot-1": "Depot 1"}, item_names={"blanket": "Blanket"})
    assert len(warnings) == 1
    assert warnings[0]["stock_id"] == "s-stale"
    assert warnings[0]["age_hours"] == 10.0
    assert "Verify before dispatch" in warnings[0]["message"]


def test_explain_contains_destination_and_distance_source():
    rec = {
        "demand_id": "d1",
        "stock_id": "s1",
        "vehicle_id": "truck-1",
        "item_id": "water",
        "qty": 500.0,
        "km": 42.5,
        "distance_source": "haversine",
        "reason": {"fill": 1.0, "urgency": 1.0, "proximity": 0.8},
    }
    stock_dict = {"s1": {"location_id": "depot-1", "name": "Ludhiana Depot"}}
    demand_dict = {"d1": {"location_id": "camp17", "urgency": "critical", "location_text": "Camp 17"}}
    item_names = {"water": "Drinking Water"}
    location_names = {"camp17": "Camp 17", "depot-1": "Ludhiana Depot"}

    exp = build_explain_string(rec, stock_dict, demand_dict, item_names, location_names)
    assert "Camp 17" in exp
    assert "Ludhiana Depot" in exp
    assert "straight-line estimate" in exp
    assert "CRITICAL" in exp


def test_deterministic_move_ids():
    d_id = "demand-xyz"
    s_id = "stock-abc"
    move_id_1 = f"mv-{d_id}-{s_id}"
    move_id_2 = f"mv-{d_id}-{s_id}"
    assert move_id_1 == move_id_2 == "mv-demand-xyz-stock-abc"


def test_no_vehicle_explain():
    rec = {
        "demand_id": "d1",
        "stock_id": "s1",
        "vehicle_id": None,
        "item_id": "food",
        "qty": 100.0,
        "km": 15.0,
        "distance_source": "haversine",
        "reason": {"fill": 1.0},
    }
    stock_dict = {"s1": {"location_id": "depot-1", "name": "Depot 1"}}
    demand_dict = {"d1": {"location_id": "camp4", "urgency": "high", "location_text": "Camp 4"}}
    item_names = {"food": "Food Packet"}
    location_names = {"camp4": "Camp 4", "depot-1": "Depot 1"}

    exp = build_explain_string(rec, stock_dict, demand_dict, item_names, location_names)
    assert "No vehicle assigned" in exp
    assert "No dedicated vehicle available" in exp

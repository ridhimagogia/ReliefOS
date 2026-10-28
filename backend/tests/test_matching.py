from datetime import datetime, timedelta

import pytest

from backend.matching import match, plan
from backend.matching.greedy import stock_available
from backend.matching.scoring import urgency_value
from backend.matching.simulate import generate_scenario

BLANKET, MEDKIT, ORS, WATER = 3, 4, 6, 1
NOW = datetime(2026, 10, 29, 12, 0, 0)


def D(id, item, qty, urg="MEDIUM", lat=30.90, lng=75.80, loc=None, district="X", t=None):
    return {"id": id, "item_id": item, "quantity_needed": qty, "urgency": urg, "lat": lat, "lng": lng,
            "location_id": loc or 100 + id, "district": district,
            "client_created_at": (t or NOW).isoformat()}


def S(id, item, qty, lat=30.90, lng=75.80, reserved=0, loc=None):
    return {"id": id, "item_id": item, "quantity": qty, "reserved": reserved, "lat": lat, "lng": lng,
            "location_id": loc or id}


def test_problem_statement_example(no_network):
    # A has 10,000 blankets, B needs 7,000 blankets + 500 medical kits, C has 4,000 ORS
    stock = [S(1, BLANKET, 10000, 30.90, 75.85), S(2, ORS, 4000, 31.30, 75.50)]
    demands = [D(1, BLANKET, 7000, lat=31.0, lng=74.6, loc=50, district="Ferozepur"),
               D(2, MEDKIT, 500, lat=31.0, lng=74.6, loc=50, district="Ferozepur")]
    res = plan(demands, stock, item_names={BLANKET: "blankets", MEDKIT: "medical kits", ORS: "ORS"},
               now=NOW)
    recs = res["recommendations"]
    assert len(recs) == 1
    assert recs[0]["stock_id"] == 1 and recs[0]["qty"] == 7000 and recs[0]["distance_source"] == "haversine"
    short = res["shortages"]
    assert len(short) == 1 and short[0]["item_id"] == MEDKIT and short[0]["short_qty"] == 500
    assert "500 medical kits short" in short[0]["message"]
    ors = [s for s in res["surplus"] if s["item_id"] == ORS][0]
    assert ors["no_demand"] is True and ors["leftover_qty"] == 4000


def test_critical_beats_low_even_if_low_arrived_first():
    demands = [D(1, WATER, 100, "LOW", t=NOW - timedelta(hours=3)), D(2, WATER, 100, "CRITICAL")]
    recs = match(demands, [S(1, WATER, 100)], now=NOW)
    assert [(r["demand_id"], r["qty"]) for r in recs] == [(2, 100)]


def test_reserved_stock_is_not_double_booked():
    res = plan([D(1, WATER, 100)], [S(1, WATER, 100, reserved=60)], now=NOW)
    assert res["recommendations"][0]["qty"] == 40
    assert res["shortages"][0]["short_qty"] == 60


def test_split_load_nearest_first():
    demands = [D(1, WATER, 150, lat=30.90, lng=75.80)]
    stock = [S(1, WATER, 100, 30.95, 75.85), S(2, WATER, 100, 31.60, 75.80)]
    recs = match(demands, stock, now=NOW)
    assert [(r["stock_id"], r["qty"]) for r in recs] == [(1, 100), (2, 50)]


def test_weights_change_the_choice():
    demands = [D(1, WATER, 100)]
    stock = [S(1, WATER, 50, 30.95, 75.85), S(2, WATER, 100, 31.50, 75.80)]
    fill_heavy = match(demands, stock, weights={"urgency": 0.0, "fill": 0.9, "proximity": 0.1}, now=NOW)
    prox_heavy = match(demands, stock, weights={"urgency": 0.0, "fill": 0.05, "proximity": 0.9}, now=NOW)
    assert fill_heavy[0]["stock_id"] == 2
    assert prox_heavy[0]["stock_id"] == 1


def test_stock_never_negative_or_overallocated():
    sc = generate_scenario(42)
    recs = match(sc["demands"], sc["stock"], sc["vehicles"], item_kg=sc["item_kg"], now=NOW)
    used = {}
    for r in recs:
        used[r["stock_id"]] = used.get(r["stock_id"], 0) + r["qty"]
    for s in sc["stock"]:
        assert used.get(s["id"], 0) <= stock_available(s, {}) + 1e-6
    got = {}
    for r in recs:
        got[r["demand_id"]] = got.get(r["demand_id"], 0) + r["qty"]
    for d in sc["demands"]:
        assert got.get(d["id"], 0) <= d["quantity_needed"] + 1e-6


def test_deterministic():
    sc = generate_scenario(42)
    a = match(sc["demands"], sc["stock"], sc["vehicles"], now=NOW)
    b = match(sc["demands"], sc["stock"], sc["vehicles"], now=NOW)
    assert a == b


def test_vehicle_fits_load_and_multi_trip():
    stock = [S(1, WATER, 20000)]
    veh = [{"id": 7, "capacity_kg": 5000, "current_location_id": 9},
           {"id": 8, "capacity_kg": 10000, "current_location_id": 9}]
    r = match([D(1, WATER, 6000)], stock, veh, item_kg={WATER: 1.0}, now=NOW)[0]
    assert r["vehicle_id"] == 8 and r["trips"] == 1
    r2 = match([D(1, WATER, 12000)], stock, veh, item_kg={WATER: 1.0}, now=NOW)[0]
    assert r2["vehicle_id"] == 8 and r2["trips"] == 2


def test_empty_vehicle_list_means_nothing_feasible():
    assert match([D(1, WATER, 100)], [S(1, WATER, 100)], [], now=NOW) == []


def test_wait_bonus_uses_client_created_at_and_is_capped():
    fresh = D(1, WATER, 10, "LOW", t=NOW)
    old = D(2, WATER, 10, "LOW", t=NOW - timedelta(hours=10))
    ancient = D(3, WATER, 10, "LOW", t=NOW - timedelta(days=30))
    assert urgency_value(old, NOW) > urgency_value(fresh, NOW)
    assert urgency_value(ancient, NOW) == pytest.approx(0.5)  # 0.25 base + 0.25 cap


def test_lp_respects_limits_and_priority():
    pytest.importorskip("scipy")
    demands = [D(1, WATER, 100, "LOW"), D(2, WATER, 100, "CRITICAL")]
    res = plan(demands, [S(1, WATER, 100)], algorithm="lp", now=NOW)
    recs = res["recommendations"]
    assert sum(r["qty"] for r in recs) <= 100
    assert [r["demand_id"] for r in recs] == [2]


def test_plan_runs_with_no_network(no_network):
    sc = generate_scenario(1)
    res = plan(sc["demands"], sc["stock"], sc["vehicles"], item_kg=sc["item_kg"], now=NOW)
    assert res["recommendations"] and res["distance_sources"] == ["haversine"]


def test_vehicles_are_reused_across_routes():
    stock = [S(1, WATER, 5000, loc=1), S(2, WATER, 5000, 31.2, 75.9, loc=2)]
    demands = [D(i, WATER, 1000, lat=30.9 + i * 0.05, loc=50 + i) for i in range(1, 5)]
    veh = [{"id": 7, "capacity_kg": 5000, "current_location_id": 1}]
    recs = match(demands, stock, veh, item_kg={WATER: 1.0}, now=NOW)
    assert len(recs) == 4 and all(r["vehicle_id"] == 7 for r in recs)

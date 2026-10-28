"""Simulated Punjab-flood scenario: naive baseline vs ReliefOS.

Everything here is SIMULATED (seeded, reproducible). Run:

    python -m backend.matching.simulate            # writes backend/seed/simulation_results.json
    python -m backend.matching.simulate --seed 7

Naive baseline: demands are served in arrival order; each takes everything it can
from the single nearest depot holding the item (no urgency, no split loads).
ReliefOS: urgency-aware greedy matcher with split loads and vehicle assignment.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

from ..routing import distance
from .engine import plan
from .greedy import clean, make_dist, stock_available, remaining_qty

TOWNS = {
    "Ludhiana": (30.9010, 75.8573), "Patiala": (30.3398, 76.3869), "Jalandhar": (31.3260, 75.5762),
    "Amritsar": (31.6340, 74.8723), "Bathinda": (30.2110, 74.9455), "Sangrur": (30.2458, 75.8421),
    "Moga": (30.8167, 75.1667), "Hoshiarpur": (31.5320, 75.9170),
    "Ferozepur": (30.9331, 74.6225), "Fazilka": (30.4036, 74.0286), "Tarn Taran": (31.4519, 74.9286),
    "Kapurthala": (31.3800, 75.3800), "Gurdaspur": (32.0414, 75.4031), "Mansa": (29.9988, 75.3937),
}
DEPOT_TOWNS = ["Ludhiana", "Patiala", "Jalandhar", "Amritsar", "Bathinda", "Sangrur", "Moga", "Hoshiarpur"]
CAMP_DISTRICTS = ["Ferozepur", "Fazilka", "Tarn Taran", "Kapurthala", "Gurdaspur", "Mansa"]

# id: (name, unit, kg per unit, units per person, camp-asks probability, supply/demand ratio)
ITEMS = {
    1: ("WATER", "litre", 1.0, 15.0, 0.9, 0.80),
    2: ("FOOD", "kit", 6.0, 0.2, 0.7, 0.70),
    3: ("SHELTER", "blanket", 1.5, 1.0, 0.5, 0.70),
    4: ("MEDICAL", "kit", 3.0, 0.02, 0.5, 0.55),
    5: ("HYGIENE", "kit", 1.0, 0.2, 0.4, 0.80),
}
URGENCIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
URG_WEIGHTS = [0.2, 0.3, 0.3, 0.2]


def generate_scenario(seed=42, n_camps=22):
    rng = random.Random(seed)
    base = datetime(2026, 10, 29, 6, 0, 0)
    location_names, depots, camps = {}, [], []
    for i, town in enumerate(DEPOT_TOWNS, start=1):
        lat, lng = TOWNS[town]
        depots.append({"id": i, "name": f"{town} depot", "lat": lat, "lng": lng, "district": town})
        location_names[i] = f"{town} depot"
    for n in range(n_camps):
        district = CAMP_DISTRICTS[n % len(CAMP_DISTRICTS)]
        lat, lng = TOWNS[district]
        cid = 11 + n
        camps.append({
            "id": cid, "name": f"Camp {cid}", "district": district,
            "lat": round(lat + rng.uniform(-0.12, 0.12), 4), "lng": round(lng + rng.uniform(-0.12, 0.12), 4),
            "population": rng.randint(200, 1500),
        })
        location_names[cid] = f"Camp {cid}"

    demands, did = [], 1
    for camp in camps:
        for item_id, (_, _, _, per_person, p_ask, _) in ITEMS.items():
            if rng.random() > p_ask:
                continue
            qty = camp["population"] * per_person
            qty = math.ceil(qty) if per_person < 1 else int(qty)
            demands.append({
                "id": did, "location_id": camp["id"], "district": camp["district"],
                "lat": camp["lat"], "lng": camp["lng"], "item_id": item_id,
                "quantity_needed": max(1, qty),
                "urgency": rng.choices(URGENCIES, URG_WEIGHTS)[0],
                "client_created_at": None,
            })
            did += 1
    rng.shuffle(demands)  # random arrival order is what the naive baseline suffers from
    for k, dem in enumerate(demands):
        dem["client_created_at"] = (base + timedelta(minutes=7 * k)).isoformat()

    stock, sid = [], 1
    for item_id, (_, _, _, _, _, ratio) in ITEMS.items():
        need = sum(x["quantity_needed"] for x in demands if x["item_id"] == item_id)
        if need == 0:
            continue
        total = need * ratio
        ws = [(0.0 if rng.random() < 0.25 else rng.random() + 0.2) for _ in depots]
        if sum(ws) == 0:
            ws[0] = 1.0
        for dep, w in zip(depots, ws):
            q = int(total * w / sum(ws))
            if q > 0:
                stock.append({"id": sid, "location_id": dep["id"], "item_id": item_id, "quantity": q,
                              "reserved": 0, "lat": dep["lat"], "lng": dep["lng"]})
                sid += 1

    vehicles = []
    for v in range(12):
        dep = depots[rng.randrange(len(depots))]
        vehicles.append({"id": 100 + v, "capacity_kg": rng.choice([3000, 5000, 8000, 10000]),
                         "current_location_id": dep["id"], "speed_kmph": 40, "available": True})
    return {"depots": depots, "camps": camps, "demands": demands, "stock": stock,
            "vehicles": vehicles, "location_names": location_names,
            "item_names": {k: v[0] for k, v in ITEMS.items()},
            "item_kg": {k: v[2] for k, v in ITEMS.items()}}


def naive_allocations(demands, stock, dist_fn=distance):
    d = make_dist(dist_fn)
    taken, allocs = {}, []
    for dem in sorted(demands, key=lambda x: x["client_created_at"]):
        cands = [s for s in stock if s["item_id"] == dem["item_id"] and stock_available(s, taken) > 0]
        if not cands:
            continue
        s = min(cands, key=lambda s: d(s, dem)["km"])
        qty = min(stock_available(s, taken), remaining_qty(dem))
        taken[s["id"]] = taken.get(s["id"], 0.0) + qty
        info = d(s, dem)
        allocs.append({"demand_id": dem["id"], "qty": qty, "km": info["km"], "eta_h": info["eta_h"]})
    return allocs


def kpis(demands, allocs):
    by_dem = {}
    for a in allocs:
        by_dem[a["demand_id"]] = by_dem.get(a["demand_id"], 0.0) + float(a["qty"])
    urg = {x["id"]: x["urgency"] for x in demands}

    def cov(sel):
        sel = list(sel)
        if not sel:
            return 0.0
        return 100.0 * sum(min(1.0, by_dem.get(x["id"], 0.0) / x["quantity_needed"]) for x in sel) / len(sel)

    crit = [x for x in demands if x["urgency"] == "CRITICAL"]
    crit_eta = [float(a["eta_h"]) for a in allocs if urg.get(a["demand_id"]) == "CRITICAL"]
    return {
        "coverage_pct": round(cov(demands), 1),
        "critical_coverage_pct": round(cov(crit), 1),
        "critical_demands_with_zero_supply": sum(1 for x in crit if by_dem.get(x["id"], 0.0) <= 0),
        "avg_eta_critical_h": round(sum(crit_eta) / len(crit_eta), 2) if crit_eta else None,
        "total_km": round(sum(float(a["km"]) for a in allocs), 1),
        "demands_fully_met": sum(1 for x in demands if by_dem.get(x["id"], 0.0) >= x["quantity_needed"] - 1e-9),
        "total_demands": len(demands),
    }


def run_simulation(seed=42):
    sc = generate_scenario(seed)
    naive = kpis(sc["demands"], naive_allocations(sc["demands"], sc["stock"]))
    res = plan(sc["demands"], sc["stock"], sc["vehicles"], item_kg=sc["item_kg"],
               item_names=sc["item_names"], location_names=sc["location_names"],
               now=datetime(2026, 10, 29, 12, 0, 0))
    relief = kpis(sc["demands"], res["recommendations"])
    relief["shortage_rows"] = len(res["shortages"])
    relief["moves_without_vehicle"] = sum(1 for r in res["recommendations"] if r["vehicle_id"] is None)

    def delta(a, b):
        return None if a in (None, 0) or b is None else round(100.0 * (b - a) / a, 1)

    return {
        "label": "SIMULATED: seeded scenario, not real data",
        "seed": seed,
        "method": ("Naive = arrival order, nearest single depot, no urgency, no split loads. "
                   "ReliefOS = urgency-aware greedy with split loads. Same stock, demand and "
                   "distance (haversine x 1.3)."),
        "scenario": {"depots": len(sc["depots"]), "camps": len(sc["camps"]),
                     "demands": len(sc["demands"]), "stock_rows": len(sc["stock"]),
                     "vehicles": len(sc["vehicles"])},
        "naive": naive,
        "reliefos": relief,
        "improvement": {
            "critical_coverage_pp": round(relief["critical_coverage_pct"] - naive["critical_coverage_pct"], 1),
            "coverage_pp": round(relief["coverage_pct"] - naive["coverage_pct"], 1),
            "avg_eta_critical_pct": delta(naive["avg_eta_critical_h"], relief["avg_eta_critical_h"]),
            "total_km_pct": delta(naive["total_km"], relief["total_km"]),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "seed" / "simulation_results.json"))
    args = ap.parse_args()
    import os
    os.environ.setdefault("OFFLINE_MODE", "1")
    out = run_simulation(args.seed)
    p = Path(args.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("naive", "reliefos", "improvement")}, indent=2))
    print(f"\nwritten: {p}")


if __name__ == "__main__":
    main()

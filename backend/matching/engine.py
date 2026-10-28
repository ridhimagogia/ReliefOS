"""Public matcher API (the 'Matching <-> Backend' contract).

    match(demands, stock, vehicles, weights) -> recommendations[]
        {demand_id, stock_id, vehicle_id, qty, km, eta_h, score, reason,
         item_id, distance_source, trips}

    plan(...) -> {"recommendations", "shortages", "surplus", "algorithm", "distance_sources"}

`plan` is what /api/match/run and /api/shortages should call. No network access
happens here; distance comes from the injected `dist_fn` (default: routing.distance).
"""
from __future__ import annotations

from .greedy import allocate, build_recommendations
from .optimise import allocate_lp
from .scoring import MAX_ETA_H, MAX_KM
from .shortages import compute_shortages, compute_surplus


def plan(demands, stock, vehicles=None, weights=None, item_kg=None, now=None, dist_fn=None,
         algorithm="greedy", item_names=None, location_names=None,
         max_km=MAX_KM, max_eta_h=MAX_ETA_H):
    fn = allocate_lp if algorithm == "lp" else allocate
    allocs, unmet, taken = fn(demands, stock, weights=weights, now=now, dist_fn=dist_fn,
                              vehicles=vehicles, max_km=max_km, max_eta_h=max_eta_h)
    recs = build_recommendations(allocs, vehicles, item_kg)
    return {
        "recommendations": recs,
        "shortages": compute_shortages(unmet, stock, taken, item_names, location_names, dist_fn),
        "surplus": compute_surplus(demands, unmet, stock, taken, item_names, location_names),
        "algorithm": algorithm,
        "distance_sources": sorted({r["distance_source"] for r in recs}),
    }


def match(demands, stock, vehicles=None, weights=None, **kw):
    return plan(demands, stock, vehicles, weights, **kw)["recommendations"]

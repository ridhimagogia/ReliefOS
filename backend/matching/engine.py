
"""Public matcher API (the 'Matching <-> Backend' contract).

    match(demands, stock, vehicles, weights) -> recommendations[]

    plan(...) -> {
        "recommendations", "shortages", "surplus",
        "algorithm", "distance_sources", "conflicts", "warnings"
    }

No network access happens here. Distance comes from the injected dist_fn.
"""
from __future__ import annotations

from datetime import timezone

from .greedy import allocate, build_recommendations
from .optimise import allocate_lp
from .scoring import MAX_ETA_H, MAX_KM, parse_time, utcnow
from .shortages import compute_shortages, compute_surplus
from .explain import (
    build_explain_string,
    compute_conflicts,
    compute_stock_warnings,
)


def plan(
    demands,
    stock,
    vehicles=None,
    weights=None,
    item_kg=None,
    now=None,
    dist_fn=None,
    algorithm="greedy",
    item_names=None,
    location_names=None,
    max_km=MAX_KM,
    max_eta_h=MAX_ETA_H,
):
    fn = allocate_lp if algorithm == "lp" else allocate

    allocs, unmet, taken = fn(
        demands,
        stock,
        weights=weights,
        now=now,
        dist_fn=dist_fn,
        vehicles=vehicles,
        max_km=max_km,
        max_eta_h=max_eta_h,
    )

    item_names = item_names or {}
    location_names = location_names or {}

    stock_dict = {s.get("id"): s for s in stock}
    demand_dict = {d.get("id"): d for d in demands}

    recs = build_recommendations(allocs, vehicles, item_kg)

    for rec in recs:
        rec["explanation"] = build_explain_string(
            rec,
            stock_dict,
            demand_dict,
            item_names,
            location_names,
        )

    shortages = compute_shortages(
        unmet, stock, taken, item_names, location_names, dist_fn
    )

    surplus = compute_surplus(
        demands, unmet, stock, taken, item_names, location_names
    )

    conflicts = compute_conflicts(
        demands,
        stock,
        recs,
        item_names,
        location_names,
    )

    current_time = parse_time(now) or utcnow()

    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    else:
        current_time = current_time.astimezone(timezone.utc)

    warnings = compute_stock_warnings(
        stock,
        recs,
        current_time,
        stale_hours=48,
        location_names=location_names,
        item_names=item_names,
    )

    return {
        "recommendations": recs,
        "shortages": shortages,
        "surplus": surplus,
        "algorithm": algorithm,
        "distance_sources": sorted({
            r["distance_source"] for r in recs
        }),
        "conflicts": conflicts,
        "warnings": warnings,
    }


def match(demands, stock, vehicles=None, weights=None, **kw):
    return plan(
        demands, stock, vehicles, weights, **kw
    )["recommendations"]

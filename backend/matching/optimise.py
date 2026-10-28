"""Optional LP allocator (transportation problem, runs fully offline).

Per item: maximise sum(profit * x) subject to
    sum_d x[s,d] <= available[s]      (supply)
    sum_s x[s,d] <= remaining[d]      (demand)
profit = 1000*w_urgency*urgency + 100*w_proximity*prox, so urgency dominates and
distance breaks ties. Falls back to the greedy allocator if scipy is missing or
the solver fails.
"""
from __future__ import annotations

import math

from .greedy import (EPS, allocate, clean, make_dist, remaining_qty, stock_available,
                     vehicles_ok)
from .scoring import (DEFAULT_WEIGHTS, MAX_ETA_H, MAX_KM, score_pair, urgency_value, utcnow,
                      waiting_hours)


def allocate_lp(demands, stock, weights=None, now=None, dist_fn=None, vehicles=None,
                max_km=MAX_KM, max_eta_h=MAX_ETA_H):
    kwargs = dict(weights=weights, now=now, dist_fn=dist_fn, vehicles=vehicles,
                  max_km=max_km, max_eta_h=max_eta_h)
    try:
        import numpy as np
        from scipy.optimize import linprog
    except ImportError:
        return allocate(demands, stock, **kwargs)

    now = now or utcnow()
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    d = make_dist(dist_fn)
    veh_ok = vehicles_ok(vehicles)
    taken: dict = {}
    allocs = []
    got: dict = {}

    for item_id in sorted({x["item_id"] for x in demands}, key=str):
        dems = [x for x in demands if x["item_id"] == item_id and remaining_qty(x) > EPS]
        stks = [s for s in stock if s["item_id"] == item_id and stock_available(s, {}) > EPS]
        if not dems or not stks or not veh_ok:
            continue
        pairs = []
        for si, s in enumerate(stks):
            for di, dem in enumerate(dems):
                info = d(s, dem)
                if info["km"] <= max_km and info["eta_h"] <= max_eta_h:
                    pairs.append((si, di, info))
        if not pairs:
            continue
        profit = []
        for si, di, info in pairs:
            urg = urgency_value(dems[di], now)
            prox = 1.0 - min(info["km"] / max_km, 1.0)
            profit.append(1000 * w["urgency"] * urg + 100 * w["proximity"] * prox)
        n = len(pairs)
        A = np.zeros((len(stks) + len(dems), n))
        b = np.zeros(len(stks) + len(dems))
        for k, (si, di, _) in enumerate(pairs):
            A[si, k] = 1
            A[len(stks) + di, k] = 1
        for si, s in enumerate(stks):
            b[si] = stock_available(s, {})
        for di, dem in enumerate(dems):
            b[len(stks) + di] = remaining_qty(dem)
        res = linprog(-np.array(profit), A_ub=A, b_ub=b, bounds=(0, None), method="highs")
        if not res.success:
            return allocate(demands, stock, **kwargs)
        for k, (si, di, info) in enumerate(pairs):
            qty = math.floor(res.x[k] * 100 + 1e-6) / 100.0
            if qty <= EPS:
                continue
            s, dem = stks[si], dems[di]
            taken[s["id"]] = taken.get(s["id"], 0.0) + qty
            got[dem["id"]] = got.get(dem["id"], 0.0) + qty
            sc, parts = score_pair(qty, remaining_qty(dem), urgency_value(dem, now),
                                   info["km"], True, weights, max_km)
            allocs.append({
                "demand_id": dem["id"], "stock_id": s["id"], "item_id": item_id,
                "qty": clean(qty), "km": info["km"], "eta_h": info["eta_h"],
                "distance_source": info["source"], "score": sc,
                "parts": {**parts, "algorithm": "lp", "wait_h": round(waiting_hours(dem, now), 2)},
                "origin_location_id": s.get("location_id"),
                "dest_location_id": dem.get("location_id"), "urgency": dem.get("urgency"),
            })

    unmet = []
    for dem in demands:
        short = remaining_qty(dem) - got.get(dem["id"], 0.0)
        if short > EPS:
            unmet.append({
                "demand_id": dem["id"], "item_id": dem["item_id"], "short_qty": clean(short),
                "urgency": dem.get("urgency"), "district": dem.get("district"),
                "location_id": dem.get("location_id"), "lat": dem["lat"], "lng": dem["lng"],
            })
    return allocs, unmet, taken

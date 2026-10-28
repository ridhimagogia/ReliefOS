"""Greedy, deterministic allocator + vehicle assignment (no network calls).

Input shapes (plain dicts, so the same code runs against SQLAlchemy rows
converted by the API layer):

demand : {id, item_id, quantity_needed, fulfilled?, urgency, lat, lng,
          location_id?, district?, client_created_at?, created_at?}
stock  : {id, location_id, item_id, quantity, reserved?, lat, lng, name?}
vehicle: {id, capacity_kg, current_location_id?, speed_kmph?, available?}
"""
from __future__ import annotations

import math
from collections import defaultdict

from ..routing import distance as default_distance
from .scoring import (
    MAX_ETA_H,
    MAX_KM,
    score_pair,
    urgency_rank,
    urgency_value,
    utcnow,
    waiting_hours,
)

EPS = 1e-9


def clean(x):
    x = round(float(x), 2)
    return int(x) if x == int(x) else x


def stock_available(s, taken) -> float:
    return max(0.0, float(s["quantity"]) - float(s.get("reserved", 0) or 0) - taken.get(s["id"], 0.0))


def remaining_qty(d) -> float:
    return max(0.0, float(d["quantity_needed"]) - float(d.get("fulfilled", 0) or 0))


def vehicles_ok(vehicles) -> bool:
    """vehicles=None means 'do not constrain'; an empty list means none available."""
    if vehicles is None:
        return True
    return any(v.get("available", True) and v.get("capacity_kg", 0) > 0 for v in vehicles)


def make_dist(dist_fn):
    dist = dist_fn or default_distance
    cache = {}

    def d(a, b):
        key = (a["lat"], a["lng"], b["lat"], b["lng"])
        if key not in cache:
            cache[key] = dist(a, b)
        return cache[key]

    return d


def allocate(demands, stock, weights=None, now=None, dist_fn=None, vehicles=None,
             max_km=MAX_KM, max_eta_h=MAX_ETA_H):
    """Return (allocations, unmet, taken). Inputs are never mutated."""
    now = now or utcnow()
    d = make_dist(dist_fn)
    veh_ok = vehicles_ok(vehicles)
    stock_sorted = sorted(stock, key=lambda s: str(s["id"]))
    order = sorted(demands, key=lambda x: (-urgency_rank(x), -waiting_hours(x, now), str(x["id"])))
    taken: dict = {}
    allocs, unmet = [], []

    for dem in order:
        rem = remaining_qty(dem)
        urg = urgency_value(dem, now)
        while rem > EPS:
            best = None
            for s in stock_sorted:
                if s["item_id"] != dem["item_id"]:
                    continue
                av = stock_available(s, taken)
                if av <= EPS or not veh_ok:
                    continue
                info = d(s, dem)
                if info["km"] > max_km or info["eta_h"] > max_eta_h:
                    continue
                sc, parts = score_pair(av, rem, urg, info["km"], True, weights, max_km)
                key = (sc, -info["km"])
                if best is None or key > best[0]:
                    best = (key, s, av, info, sc, parts)
            if best is None:
                break
            _, s, av, info, sc, parts = best
            qty = min(av, rem)
            taken[s["id"]] = taken.get(s["id"], 0.0) + qty
            rem -= qty
            parts = {**parts, "wait_h": round(waiting_hours(dem, now), 2)}
            allocs.append({
                "demand_id": dem["id"], "stock_id": s["id"], "item_id": dem["item_id"],
                "qty": clean(qty), "km": info["km"], "eta_h": info["eta_h"],
                "distance_source": info["source"], "score": sc, "parts": parts,
                "origin_location_id": s.get("location_id"),
                "dest_location_id": dem.get("location_id"),
                "urgency": dem.get("urgency"),
            })
        if rem > EPS:
            unmet.append({
                "demand_id": dem["id"], "item_id": dem["item_id"], "short_qty": clean(rem),
                "urgency": dem.get("urgency"), "district": dem.get("district"),
                "location_id": dem.get("location_id"), "lat": dem["lat"], "lng": dem["lng"],
            })
    return allocs, unmet, taken


def build_recommendations(allocs, vehicles=None, item_kg=None):
    """Group allocations by (origin, destination) and assign one vehicle per group.

    Vehicle choice: the least-used vehicle that fits the load (a truck may do several
    runs), preferring one already at the origin, then the smallest that fits. If the load is bigger than any
    vehicle, the largest is used with `trips` > 1. If no vehicle is left,
    vehicle_id is None and the reason says so.
    """
    item_kg = item_kg or {}
    groups = defaultdict(list)
    for a in allocs:
        groups[(a["origin_location_id"], a["dest_location_id"])].append(a)

    def load_of(items):
        return sum(float(a["qty"]) * float(item_kg.get(a["item_id"], 1.0)) for a in items)

    free = [v for v in (vehicles or []) if v.get("available", True) and v.get("capacity_kg", 0) > 0]
    runs = {}  # vehicle id -> route groups already assigned (a truck can do several runs)
    assignment = {}
    ordered = sorted(
        groups.items(),
        key=lambda kv: (-max(URG.get(str(a.get("urgency")).upper(), 0.5) for a in kv[1]), -load_of(kv[1])),
    )
    for (origin, dest), items in ordered:
        load = load_of(items)
        if vehicles is None:
            assignment[(origin, dest)] = (None, 1, load, "no vehicle model supplied")
            continue
        cands = list(free)
        fit = sorted(
            (v for v in cands if v["capacity_kg"] >= load),
            key=lambda v: (runs.get(v["id"], 0), v.get("current_location_id") != origin, v["capacity_kg"]),
        )
        if fit:
            v = fit[0]
            runs[v["id"]] = runs.get(v["id"], 0) + 1
            assignment[(origin, dest)] = (v, 1, load, f"fits in one trip (vehicle run #{runs[v['id']]})")
        elif cands:
            v = max(cands, key=lambda v: (-runs.get(v["id"], 0), v["capacity_kg"]))
            runs[v["id"]] = runs.get(v["id"], 0) + 1
            trips = math.ceil(load / v["capacity_kg"])
            assignment[(origin, dest)] = (v, trips, load, f"load {clean(load)} kg needs {trips} trips")
        else:
            assignment[(origin, dest)] = (None, 0, load, "no vehicle available")

    recs = []
    for a in allocs:
        v, trips, load, note = assignment[(a["origin_location_id"], a["dest_location_id"])]
        eta = a["eta_h"]
        if v is not None and v.get("speed_kmph"):
            eta = round(a["km"] / v["speed_kmph"], 2)
        recs.append({
            "demand_id": a["demand_id"], "stock_id": a["stock_id"],
            "vehicle_id": v["id"] if v else None, "item_id": a["item_id"],
            "qty": a["qty"], "km": a["km"], "eta_h": eta,
            "distance_source": a["distance_source"], "score": a["score"], "trips": trips,
            "reason": {**a["parts"], "vehicle": note, "group_load_kg": clean(load)},
        })
    return recs


URG = {"CRITICAL": 1.0, "HIGH": 0.75, "MEDIUM": 0.5, "LOW": 0.25}

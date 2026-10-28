"""Shortage and surplus intelligence."""
from __future__ import annotations

from collections import defaultdict

from .greedy import EPS, clean, make_dist, stock_available


def compute_shortages(unmet, stock, taken, item_names=None, location_names=None, dist_fn=None):
    """Unmet demand grouped by (item, district), with the nearest known source.

    The nearest source is the closest stock row that holds the item at all, even
    if the plan already used it (`source_exhausted` says so). None = nobody holds it.
    """
    item_names = item_names or {}
    location_names = location_names or {}
    d = make_dist(dist_fn)
    groups = defaultdict(lambda: {"short_qty": 0.0, "demand_ids": [], "nearest": None})
    for u in unmet:
        key = (u["item_id"], u.get("district") or "Unknown")
        g = groups[key]
        g["short_qty"] += float(u["short_qty"])
        g["demand_ids"].append(u["demand_id"])
        for s in stock:
            if s["item_id"] != u["item_id"] or float(s["quantity"]) <= 0:
                continue
            info = d(s, u)
            if g["nearest"] is None or info["km"] < g["nearest"]["km"]:
                g["nearest"] = {
                    "location_id": s.get("location_id"),
                    "name": location_names.get(s.get("location_id")) or s.get("name") or f"stock {s['id']}",
                    "km": info["km"], "distance_source": info["source"],
                    "source_exhausted": stock_available(s, taken) <= EPS,
                }
    rows = []
    for (item_id, district), g in sorted(groups.items(), key=lambda kv: (-kv[1]["short_qty"], str(kv[0]))):
        name = item_names.get(item_id, str(item_id))
        n = g["nearest"]
        if n:
            tail = f"nearest source: {n['name']} ({n['km']} km" + (", fully allocated)" if n["source_exhausted"] else ")")
        else:
            tail = "no known source holds this item"
        rows.append({
            "item_id": item_id, "item_name": name, "district": district,
            "short_qty": clean(g["short_qty"]), "demand_ids": g["demand_ids"], "nearest_source": n,
            "message": f"{clean(g['short_qty'])} {name} short in {district}; {tail}",
        })
    return rows


def compute_surplus(demands, unmet, stock, taken, item_names=None, location_names=None, min_qty=1):
    """Stock left after planning for items with no unmet demand.

    `no_demand` = nobody asked for this item at all (the Kerala 2018 lesson: unsolicited goods).
    """
    item_names = item_names or {}
    location_names = location_names or {}
    asked = {x["item_id"] for x in demands}
    short_items = {u["item_id"] for u in unmet}
    rows = []
    for s in stock:
        left = stock_available(s, taken)
        if left < min_qty or s["item_id"] in short_items:
            continue
        no_demand = s["item_id"] not in asked
        name = item_names.get(s["item_id"], str(s["item_id"]))
        where = location_names.get(s.get("location_id")) or s.get("name") or f"stock {s['id']}"
        rows.append({
            "stock_id": s["id"], "location_id": s.get("location_id"), "item_id": s["item_id"],
            "item_name": name, "leftover_qty": clean(left), "no_demand": no_demand,
            "message": (f"{clean(left)} {name} at {where} " +
                        ("has no open demand anywhere: redirect or hold" if no_demand
                         else "is left after all open demand is met")),
        })
    return sorted(rows, key=lambda r: (-r["no_demand"], -float(r["leftover_qty"])))

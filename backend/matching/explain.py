"""Explanation, conflicts, and warnings generator for ReliefOS matching plans."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

SPHERE_RATES = {
    "water": 15.0,  # 15 L / person / day
    "food": 1.0,    # 1 packet / person / day
}


def build_explain_string(rec: Dict[str, Any],
                         stock_dict: Dict[str, Any],
                         demand_dict: Dict[str, Any],
                         item_names: Dict[str, str],
                         location_names: Dict[str, str]) -> str:
    """Build a one-sentence explanation for a recommendation."""
    veh_id = rec.get("vehicle_id")
    veh_label = f"Vehicle {veh_id}" if veh_id else "No vehicle assigned"

    stock_id = rec.get("stock_id")
    stock_item = stock_dict.get(stock_id, {})
    depot_loc_id = stock_item.get("location_id")
    depot_name = location_names.get(depot_loc_id) or stock_item.get("name") or "Depot"

    demand_id = rec.get("demand_id")
    demand = demand_dict.get(demand_id, {})
    camp_loc_id = demand.get("location_id") or demand.get("camp_id")
    camp_name = location_names.get(camp_loc_id) or demand.get("location_text") or "Camp"

    item_id = rec.get("item_id")
    item_label = item_names.get(item_id, item_id or "supplies")

    km = rec.get("km", 0.0)
    source_type = rec.get("distance_source", "haversine")
    dist_label = "road (OSRM)" if source_type == "osrm" else "straight-line estimate"

    urgency = (demand.get("urgency") or "medium").upper()

    reason = rec.get("reason") or {}
    fill_pct = int(round((reason.get("fill", 1.0) or 1.0) * 100))

    qty = rec.get("qty", 0)

    # Example: "Truck-1 -> Camp 17: Ludhiana Depot is the best-scoring source (59.8 km, straight-line estimate), CRITICAL urgency, covers 100% of the request."
    msg = (
        f"{veh_label} -> {camp_name}: {depot_name} is the best-scoring source for {qty} {item_label} "
        f"({km:.1f} km, {dist_label}), {urgency} urgency, covers {fill_pct}% of the request."
    )
    if veh_id is None:
        msg += " (No dedicated vehicle available)."
    return msg


def compute_conflicts(demands: List[Dict[str, Any]],
                      stock: List[Dict[str, Any]],
                      recommendations: List[Dict[str, Any]],
                      item_names: Dict[str, str],
                      location_names: Dict[str, str]) -> List[Dict[str, Any]]:
    """Compute conflicts when multiple camps compete for scarce stock of an item."""
    # Group demands by item_id
    demands_by_item: Dict[str, List[Dict[str, Any]]] = {}
    for d in demands:
        item_id = d.get("item_id")
        if item_id:
            demands_by_item.setdefault(item_id, []).append(d)

    # Sum available stock by item_id
    avail_by_item: Dict[str, float] = {}
    for s in stock:
        item_id = s.get("item_id")
        if item_id:
            avail = max(0.0, float(s.get("quantity", 0)) - float(s.get("reserved", 0)))
            avail_by_item[item_id] = avail_by_item.get(item_id, 0.0) + avail

    # Allocations by demand_id
    alloc_by_demand: Dict[str, float] = {}
    for r in recommendations:
        d_id = r.get("demand_id")
        alloc_by_demand[d_id] = alloc_by_demand.get(d_id, 0.0) + float(r.get("qty", 0))

    conflicts = []
    for item_id, item_demands in demands_by_item.items():
        if len(item_demands) < 2:
            continue
        total_needed = sum(float(d.get("quantity_needed", 0)) for d in item_demands)
        total_avail = avail_by_item.get(item_id, 0.0)

        if total_needed > total_avail:
            # Conflict detected!
            item_label = item_names.get(item_id, str(item_id).title())
            competing = []
            for d in item_demands:
                c_id = d.get("location_id") or d.get("camp_id")
                c_name = location_names.get(c_id) or d.get("location_text") or c_id or "Camp"
                urg = (d.get("urgency") or "medium").upper()
                competing.append(f"{c_name} ({urg})")

            # Determine winner (largest allocation; tie-breaker: order in recommendations)
            # Find the demand with largest allocated qty
            winner_demand = None
            max_alloc = -1.0
            for d in item_demands:
                allocated = alloc_by_demand.get(d.get("id"), 0.0)
                if allocated > max_alloc:
                    max_alloc = allocated
                    winner_demand = d

            if not winner_demand and item_demands:
                winner_demand = item_demands[0]

            w_camp_id = winner_demand.get("location_id") or winner_demand.get("camp_id")
            winner_camp_name = location_names.get(w_camp_id) or winner_demand.get("location_text") or w_camp_id or "Camp"

            w_urg = (winner_demand.get("urgency") or "medium").upper()
            w_alloc = alloc_by_demand.get(winner_demand.get("id"), 0.0)
            w_req = float(winner_demand.get("quantity_needed", 0))

            other_alloc_details = []
            for d in item_demands:
                if d.get("id") == winner_demand.get("id"):
                    continue
                o_camp_id = d.get("location_id") or d.get("camp_id")
                o_camp_name = location_names.get(o_camp_id) or d.get("location_text") or o_camp_id or "Camp"
                o_alloc = alloc_by_demand.get(d.get("id"), 0.0)
                o_req = float(d.get("quantity_needed", 0))
                other_alloc_details.append(f"{o_camp_name} received {int(o_alloc)} of {int(o_req)} requested")

            others_str = "; ".join(other_alloc_details)
            reason = (
                f"{winner_camp_name} ranked first ({w_urg}, allocated {int(w_alloc)} of {int(w_req)}). "
                f"{others_str} due to total available stock shortage ({int(total_avail)} available vs {int(total_needed)} requested)."
            )

            conflicts.append({
                "item": item_label,
                "camps_competing": competing,
                "winner": winner_camp_name,
                "reason": reason,
            })

    return conflicts


def compute_stock_warnings(stock: List[Dict[str, Any]],
                           recommendations: List[Dict[str, Any]],
                           now_dt: datetime,
                           stale_hours: float,
                           location_names: Dict[str, str],
                           item_names: Dict[str, str]) -> List[Dict[str, Any]]:
    """Flag stale stock lots used in recommendations (or available)."""
    used_stock_ids = {r.get("stock_id") for r in recommendations if r.get("stock_id")}
    warnings = []

    for s in stock:
        s_id = s.get("id")
        # Check if used in recommendations or has inventory
        if s_id not in used_stock_ids and float(s.get("quantity", 0)) <= 0:
            continue

        updated_str = s.get("updated_at")
        if not updated_str:
            continue

        try:
            dt = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            diff_h = (now_dt - dt).total_seconds() / 3600.0
            if diff_h > stale_hours:
                item_id = s.get("item_id")
                item_name = item_names.get(item_id, (item_id or "Supplies").title())
                depot_id = s.get("location_id")
                depot_name = location_names.get(depot_id) or s.get("name") or "Depot"
                warnings.append({
                    "stock_id": s_id,
                    "item": item_name,
                    "age_hours": round(diff_h, 1),
                    "message": f"Stock of {item_name} at {depot_name} was updated {diff_h:.1f} h ago (threshold: {stale_hours:.0f} h). Verify before dispatch.",
                })
        except Exception:
            pass

    return warnings



"""ReliefOS matching adapter: database-to-engine integration."""

import json
from datetime import datetime, timezone

from .models import (
    Demand, Stock, Vehicle, Location, Item, Move, PlanRun,
    gen_uuid, now_iso
)
from .config import Config
from .matching import engine
from .matching.explain import (
    build_explain_string,
    compute_conflicts,
    compute_stock_warnings,
    SPHERE_RATES,
)


def build_plan(db, weights=None, algorithm="greedy"):
    """Build, persist, and return a matching plan."""

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    # Load locations and items
    locations = {l.id: l for l in db.query(Location).all()}
    location_names = {l.id: l.name for l in locations.values()}
    items = {i.id: i for i in db.query(Item).all()}
    item_names = {i.id: i.name for i in items.values()}

    # Load open demands
    db_demands = db.query(Demand).filter(
        Demand.verified == True,
        Demand.rejected == False,
        Demand.duplicate_of == None,
        Demand.kind == "demand"
    ).all()

    matcher_demands = []
    demands_lookup = {}

    for d in db_demands:
        qty_needed = d.qty

        if (qty_needed is None or qty_needed <= 0) and d.beneficiaries:
            rate = SPHERE_RATES.get(d.item_id, 1.0)
            qty_needed = float(d.beneficiaries) * rate

        if not qty_needed:
            qty_needed = 100.0

        remaining = max(0.0, qty_needed - (d.fulfilled or 0.0))

        if remaining <= 0:
            continue

        camp_loc = locations.get(d.camp_id)
        lat = d.lat or (camp_loc.lat if camp_loc else 30.9)
        lng = d.lng or (camp_loc.lng if camp_loc else 75.8)
        district = camp_loc.district if camp_loc else "Punjab"

        item_dict = {
            "id": d.id,
            "item_id": d.item_id,
            "quantity_needed": remaining,
            "fulfilled": 0.0,
            "urgency": (d.urgency or "medium").upper(),
            "lat": lat,
            "lng": lng,
            "location_id": d.camp_id or "camp_unknown",
            "district": district,
            "client_created_at": d.client_created_at or d.created_at,
            "created_at": d.created_at,
            "location_text": d.location_text or (
                camp_loc.name if camp_loc else "Camp"
            ),
        }

        matcher_demands.append(item_dict)
        demands_lookup[d.id] = item_dict

    # Load available stock
    db_stock = db.query(Stock).all()
    matcher_stock = []
    stock_lookup = {}

    for s in db_stock:
        avail_qty = max(
            0.0,
            float(s.quantity or 0) - float(s.reserved or 0)
        )

        if avail_qty <= 0:
            continue

        depot_loc = locations.get(s.location_id)
        lat = depot_loc.lat if depot_loc else 30.9
        lng = depot_loc.lng if depot_loc else 75.8
        name = depot_loc.name if depot_loc else s.location_id

        stock_dict = {
            "id": s.id,
            "location_id": s.location_id,
            "item_id": s.item_id,
            "quantity": avail_qty,
            "reserved": 0.0,
            "lat": lat,
            "lng": lng,
            "name": name,
            "updated_at": s.updated_at,
        }

        matcher_stock.append(stock_dict)
        stock_lookup[s.id] = stock_dict

    # Load available vehicles
    db_vehicles = db.query(Vehicle).filter_by(available=True).all()

    matcher_vehicles = [
        {
            "id": v.id,
            "capacity_kg": v.capacity_kg,
            "current_location_id": v.current_location_id,
            "speed_kmph": v.speed_kmph,
            "available": True,
        }
        for v in db_vehicles
    ] if db_vehicles else None

    # Load persisted move states
    persisted_moves = {
        m.id: m for m in db.query(Move).all()
    }

    # Run matching engine
    item_kg_map = {
        "water": 1.0,
        "food": 0.5,
        "tent": 5.0,
        "medkit": 2.0,
        "blanket": 1.5,
    }

    raw_plan = engine.plan(
        demands=matcher_demands,
        stock=matcher_stock,
        vehicles=matcher_vehicles,
        weights=weights,
        item_kg=item_kg_map,
        now=now_dt,
        algorithm=algorithm or "greedy",
        item_names=item_names,
        location_names=location_names,
    )

    # Format recommendations
    recommendations_out = []

    for rec in raw_plan.get("recommendations", []):
        d_id = rec.get("demand_id")
        s_id = rec.get("stock_id")
        move_id = f"mv-{d_id}-{s_id}"

        existing_move = persisted_moves.get(move_id)

        move_state = existing_move.state if existing_move else "pending"
        edited_qty = existing_move.edited_qty if existing_move else None
        notes = existing_move.notes if existing_move else None

        stock_info = stock_lookup.get(s_id, {})
        demand_info = demands_lookup.get(d_id, {})

        origin_loc = stock_info.get("location_id")
        dest_loc = demand_info.get("location_id")

        explain_str = build_explain_string(
            rec,
            stock_lookup,
            demands_lookup,
            item_names,
            location_names
        )

        alloc_qty = (
            edited_qty
            if edited_qty is not None and move_state == "edited"
            else float(rec.get("qty", 0))
        )

        move_dict = {
            "id": move_id,
            "demand_id": d_id,
            "stock_id": s_id,
            "vehicle_id": rec.get("vehicle_id"),
            "origin_location_id": origin_loc,
            "dest_location_id": dest_loc,
            "qty": alloc_qty,
            "edited_qty": edited_qty,
            "km": rec.get("km", 0.0),
            "eta_h": rec.get("eta_h", 0.0),
            "score": rec.get("score", 0.0),
            "item_id": rec.get("item_id"),
            "distance_source": rec.get("distance_source", "haversine"),
            "trips": rec.get("trips", 1),
            "reason": rec.get("reason", {}),
            "explain": explain_str,
            "state": move_state,
            "notes": notes,
        }

        recommendations_out.append(move_dict)

        # Persist new moves
        if not existing_move:
            db_move = Move(
                id=move_id,
                demand_id=d_id,
                stock_id=s_id,
                vehicle_id=rec.get("vehicle_id"),
                origin_location_id=origin_loc,
                dest_location_id=dest_loc,
                qty=alloc_qty,
                edited_qty=edited_qty,
                km=rec.get("km", 0.0),
                eta_h=rec.get("eta_h", 0.0),
                score=rec.get("score", 0.0),
                item_id=rec.get("item_id"),
                distance_source=rec.get("distance_source", "haversine"),
                trips=rec.get("trips", 1),
                reason_json=json.dumps(rec.get("reason", {})),
                explain=explain_str,
                state=move_state,
                notes=notes,
                updated_at=now_iso(),
            )

            db.add(db_move)

    # Compute conflicts
    conflicts = compute_conflicts(
        matcher_demands,
        matcher_stock,
        raw_plan.get("recommendations", []),
        item_names,
        location_names
    )

    # Compute stock warnings
    warnings = compute_stock_warnings(
        matcher_stock,
        raw_plan.get("recommendations", []),
        now_dt,
        Config.STALE_HOURS,
        location_names,
        item_names
    )

    # Format shortages
    shortages_out = []

    for sh in raw_plan.get("shortages", []):
        it_id = sh.get("item_id")
        dem_ids = sh.get("demand_ids", [])

        req_total = sum(
            float(demands_lookup[d]["quantity_needed"])
            for d in dem_ids
            if d in demands_lookup
        )

        avail_total = sum(
            float(s["quantity"])
            for s in matcher_stock
            if s.get("item_id") == it_id
        )

        camp_label = None

        if len(dem_ids) == 1 and dem_ids[0] in demands_lookup:
            camp_label = demands_lookup[dem_ids[0]].get("location_text")

        shortages_out.append({
            "item": sh.get("item_name") or item_names.get(it_id, it_id),
            "item_id": it_id,
            "district": sh.get("district"),
            "shortage": sh.get("short_qty", 0.0),
            "requested": req_total,
            "available": avail_total,
            "camp": camp_label,
            "message": sh.get("message", ""),
            "nearest_source": sh.get("nearest_source"),
        })

    # Format surplus
    surplus_out = []

    for sp in raw_plan.get("surplus", []):
        surplus_out.append({
            "item": sp.get("item_name") or item_names.get(
                sp.get("item_id"), sp.get("item_id")
            ),
            "item_id": sp.get("item_id"),
            "qty": sp.get("leftover_qty", 0.0),
            "depot": location_names.get(
                sp.get("location_id")
            ) or sp.get("location_id"),
            "stock_id": sp.get("stock_id"),
            "no_demand": bool(sp.get("no_demand")),
            "message": sp.get("message", ""),
        })

    # Final plan response
    plan_output = {
        "recommendations": recommendations_out,
        "shortages": shortages_out,
        "surplus": surplus_out,
        "algorithm": raw_plan.get("algorithm", "greedy"),
        "distance_sources": raw_plan.get(
            "distance_sources", ["haversine"]
        ),
        "conflicts": conflicts,
        "warnings": warnings,
    }

    # Save plan run
    db.add(PlanRun(
        id=gen_uuid(),
        created_at=now_iso(),
        payload_json=json.dumps(plan_output)
    ))

    db.commit()

    return plan_output

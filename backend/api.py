"""ReliefOS API blueprint implementing the complete FE-contract."""
from __future__ import annotations

import csv
import io
import json
import re
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

from flask import Blueprint, request, jsonify, g
from .models import (
    Demand, Stock, Vehicle, Location, Item, Move, Audit, PlanRun, gen_uuid, now_iso
)
from .config import Config
from .extraction.chain import extract
from .extraction.dedupe import find_parent_cluster, max_urgency
from .api_adapters import draft_to_demand_dict
from .matching import engine
from .matching.explain import (
    build_explain_string, compute_conflicts, compute_stock_warnings, SPHERE_RATES
)

api_bp = Blueprint("api", __name__, url_prefix="/api")

# In-memory simple rate limiter for public reports: ip -> list of timestamps
_rate_limits: Dict[str, List[float]] = {}


def check_rate_limit(ip: str, max_calls: int = 5, window_s: float = 60.0) -> bool:
    now = time.monotonic()
    timestamps = _rate_limits.setdefault(ip, [])
    # purge old
    _rate_limits[ip] = [t for t in timestamps if now - t < window_s]
    if len(_rate_limits[ip]) >= max_calls:
        return False
    _rate_limits[ip].append(now)
    return True


def get_db():
    return g.db_session


# 1. Health
@api_bp.route("/health", methods=["GET"])
def health():
    mode = "offline" if Config.OFFLINE_MODE else "online"
    providers = ["rules"]
    if not Config.OFFLINE_MODE and (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        providers = ["gemini", "rules"]
    
    db_type = "sqlite" if "sqlite" in Config.DATABASE_URL else "mysql"
    return jsonify({
        "status": "ok",
        "mode": mode,
        "providers": providers,
        "db": db_type,
        "scenario": Config.SCENARIO,
    })


# 2. Locations
@api_bp.route("/locations", methods=["GET"])
def get_locations():
    db = get_db()
    locs = db.query(Location).all()
    return jsonify([l.to_dict() for l in locs])


# 3. Canonical Items
@api_bp.route("/items", methods=["GET"])
def get_items():
    db = get_db()
    items = db.query(Item).all()
    return jsonify([i.to_dict() for i in items])


# 4. Vehicles
@api_bp.route("/vehicles", methods=["GET"])
def get_vehicles():
    db = get_db()
    vehs = db.query(Vehicle).all()
    return jsonify([v.to_dict() for v in vehs])


# 5. Demands
@api_bp.route("/demands", methods=["GET"])
def get_demands():
    db = get_db()
    items_map = {i.id: i.name for i in db.query(Item).all()}
    # Fetch all demands
    demands = db.query(Demand).order_by(Demand.created_at.desc()).all()
    return jsonify([d.to_dict(items_map) for d in demands])


# 6. Intake (Coordinator)
@api_bp.route("/intake", methods=["POST"])
def intake():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Message text is required"}), 400
    if len(text) > 2000:
        return jsonify({"error": "Message text exceeds 2000 characters limit"}), 400

    client_uuid = data.get("client_uuid")
    client_created_at = data.get("client_created_at") or now_iso()

    db = get_db()

    # Idempotency check
    if client_uuid:
        existing = db.query(Demand).filter_by(client_uuid=client_uuid).first()
        if existing:
            items_map = {i.id: i.name for i in db.query(Item).all()}
            return jsonify(existing.to_dict(items_map)), 200

    # Parse message with extraction chain
    draft = extract(text)

    # Convert to demand dict
    items_meta = {i.id: i for i in db.query(Item).all()}
    known_camps = {l.id for l in db.query(Location).filter_by(type="camp").all()}

    demand_dict = draft_to_demand_dict(
        draft,
        source="coordinator",
        verified=True,
        client_uuid=client_uuid,
        client_created_at=client_created_at,
        items_map=items_meta,
        known_camp_ids=known_camps,
        lat=data.get("lat"),
        lng=data.get("lng"),
        phone=data.get("phone"),
    )

    # Location lookup for camp coordinates if resolved
    if demand_dict["camp_id"]:
        camp_loc = db.query(Location).filter_by(id=demand_dict["camp_id"]).first()
        if camp_loc:
            demand_dict["lat"] = camp_loc.lat
            demand_dict["lng"] = camp_loc.lng

    # Deduplication and clustering
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    existing_demands = db.query(Demand).all()
    parent = find_parent_cluster(
        new_item_id=demand_dict["item_id"],
        new_camp_id=demand_dict["camp_id"],
        new_location_text=demand_dict["location_text"],
        new_time=now_dt,
        existing_demands=existing_demands,
        window_hours=Config.STALE_HOURS,
    )

    if parent:
        demand_dict["duplicate_of"] = parent.id
        parent.report_count = (parent.report_count or 1) + 1
        parent.urgency = max_urgency(parent.urgency or "medium", demand_dict["urgency"] or "medium")

    new_demand = Demand(**demand_dict)
    db.add(new_demand)
    db.commit()

    items_map = {i.id: i.name for i in db.query(Item).all()}
    return jsonify(new_demand.to_dict(items_map)), 201


# 7. Public Report
@api_bp.route("/public/report", methods=["POST"])
def public_report():
    ip = request.remote_addr or "127.0.0.1"
    if not check_rate_limit(ip, max_calls=5, window_s=60.0):
        return jsonify({"error": "Too many reports, please wait a minute."}), 429

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Please provide a report description"}), 400
    if len(text) > 4000:
        return jsonify({"error": "Report text exceeds size limit"}), 400

    client_uuid = data.get("client_uuid")
    client_created_at = data.get("client_created_at") or now_iso()

    db = get_db()

    # Idempotency check
    if client_uuid:
        existing = db.query(Demand).filter_by(client_uuid=client_uuid).first()
        if existing:
            return jsonify({"id": existing.id, "status": "received"}), 200

    # Parse message with extraction chain
    draft = extract(text)

    items_meta = {i.id: i for i in db.query(Item).all()}
    known_camps = {l.id for l in db.query(Location).filter_by(type="camp").all()}

    demand_dict = draft_to_demand_dict(
        draft,
        source="public",
        verified=False,
        client_uuid=client_uuid,
        client_created_at=client_created_at,
        items_map=items_meta,
        known_camp_ids=known_camps,
        lat=data.get("lat"),
        lng=data.get("lng"),
        phone=data.get("phone"),
    )

    if data.get("location_text"):
        demand_dict["location_text"] = data.get("location_text")

    # If coordinates given directly in payload
    if data.get("lat") is not None and data.get("lng") is not None:
        try:
            demand_dict["lat"] = float(data.get("lat"))
            demand_dict["lng"] = float(data.get("lng"))
        except (ValueError, TypeError):
            pass
    elif demand_dict["camp_id"]:
        camp_loc = db.query(Location).filter_by(id=demand_dict["camp_id"]).first()
        if camp_loc:
            demand_dict["lat"] = camp_loc.lat
            demand_dict["lng"] = camp_loc.lng

    # Deduplication and clustering
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    existing_demands = db.query(Demand).all()
    parent = find_parent_cluster(
        new_item_id=demand_dict["item_id"],
        new_camp_id=demand_dict["camp_id"],
        new_location_text=demand_dict["location_text"],
        new_time=now_dt,
        existing_demands=existing_demands,
        window_hours=Config.STALE_HOURS,
    )

    if parent:
        demand_dict["duplicate_of"] = parent.id
        parent.report_count = (parent.report_count or 1) + 1
        parent.urgency = max_urgency(parent.urgency or "medium", demand_dict["urgency"] or "medium")

    new_demand = Demand(**demand_dict)
    db.add(new_demand)
    db.commit()

    return jsonify({"id": new_demand.id, "status": "received"}), 201


# 8. Correct Demand
@api_bp.route("/demands/<demand_id>/correct", methods=["POST"])
def correct_demand(demand_id):
    db = get_db()
    demand = db.query(Demand).filter_by(id=demand_id).first()
    if not demand:
        return jsonify({"error": f"Demand {demand_id} not found"}), 404

    data = request.get_json(silent=True) or {}
    notes = data.get("notes") or "Coordinator corrected demand fields"

    if "item_id" in data and data["item_id"]:
        demand.item_id = data["item_id"]
    if "qty" in data:
        demand.qty = float(data["qty"]) if data["qty"] is not None else None
    if "unit" in data and data["unit"]:
        demand.unit = data["unit"]
    if "beneficiaries" in data:
        demand.beneficiaries = int(data["beneficiaries"]) if data["beneficiaries"] is not None else None
    if "urgency" in data and data["urgency"]:
        demand.urgency = data["urgency"].lower()
    if "location_text" in data:
        demand.location_text = data["location_text"]
    if "camp_id" in data:
        demand.camp_id = data["camp_id"]
        if demand.camp_id:
            camp_loc = db.query(Location).filter_by(id=demand.camp_id).first()
            if camp_loc:
                demand.lat = camp_loc.lat
                demand.lng = camp_loc.lng

    # Audit entry
    db.add(Audit(
        user="Aastha Jha (Coordinator)",
        action="edited",
        target_id=demand.id,
        timestamp=now_iso(),
        notes=notes
    ))
    db.commit()

    items_map = {i.id: i.name for i in db.query(Item).all()}
    return jsonify(demand.to_dict(items_map)), 200


# 9. Verify Demand
@api_bp.route("/demands/<demand_id>/verify", methods=["POST"])
def verify_demand(demand_id):
    db = get_db()
    demand = db.query(Demand).filter_by(id=demand_id).first()
    if not demand:
        return jsonify({"error": f"Demand {demand_id} not found"}), 404

    demand.verified = True
    demand.needs_review = False
    demand.rejected = False

    db.add(Audit(
        user="Aastha Jha (Coordinator)",
        action="verified",
        target_id=demand.id,
        timestamp=now_iso(),
        notes="Verified demand"
    ))
    db.commit()

    return jsonify({"verified": True}), 200


# 10. Reject Demand
@api_bp.route("/demands/<demand_id>/reject", methods=["POST"])
def reject_demand(demand_id):
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400

    db = get_db()
    demand = db.query(Demand).filter_by(id=demand_id).first()
    if not demand:
        return jsonify({"error": f"Demand {demand_id} not found"}), 404

    demand.rejected = True
    demand.verified = False

    action = "rejected-public" if demand.source == "public" else "rejected"
    db.add(Audit(
        user="Aastha Jha (Coordinator)",
        action=action,
        target_id=demand.id,
        timestamp=now_iso(),
        notes=reason
    ))
    db.commit()

    return jsonify({"verified": False, "rejected": True}), 200


# 11. Stock list
@api_bp.route("/stock", methods=["GET"])
def get_stock():
    db = get_db()
    stocks = db.query(Stock).all()
    items_map = {i.id: i.name for i in db.query(Item).all()}
    locs_map = {l.id: l for l in db.query(Location).all()}

    res = []
    for s in stocks:
        d = s.to_dict(items_map, {k: v.name for k, v in locs_map.items()})
        loc = locs_map.get(s.location_id)
        if loc:
            d["lat"] = loc.lat
            d["lng"] = loc.lng
        res.append(d)
    return jsonify(res)


# 12. Supply Paste
@api_bp.route("/supply/paste", methods=["POST"])
def supply_paste():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Please provide supply text"}), 400

    db = get_db()
    locations = db.query(Location).filter_by(type="depot").all()
    items = db.query(Item).all()
    items_map = {i.id: i for i in items}

    # Free text parsing: e.g. "Ludhiana Depot: 5000 litres drinking water available immediately"
    # Or "Warehouse A: 2000 water bottles, 500 blankets, 1 truck free"
    depot = None
    body_text = text
    if ":" in text:
        header, body_text = text.split(":", 1)
        # Search for depot in header
        norm_header = header.lower().strip()
        for loc in locations:
            if loc.id.lower() in norm_header or loc.name.lower() in norm_header or loc.district.lower() in norm_header:
                depot = loc
                break
    else:
        # Search text for depot name
        for loc in locations:
            if loc.name.lower() in text.lower() or loc.id.lower() in text.lower() or loc.district.lower() in text.lower():
                depot = loc
                break

    if not depot:
        known = ", ".join([l.name for l in locations])
        return jsonify({"error": f"Depot not recognised from text. Known depots: {known}"}), 422

    # Check for vehicles: e.g. "1 truck free", "2 trucks"
    veh_match = re.search(r"(\d+)\s*truck", body_text, re.I)
    if veh_match:
        count = int(veh_match.group(1))
        for idx in range(count):
            veh_id = f"truck-{depot.id[:4]}-{idx+1}"
            if not db.query(Vehicle).filter_by(id=veh_id).first():
                db.add(Vehicle(
                    id=veh_id,
                    type="Truck",
                    capacity_kg=2500.0,
                    current_location_id=depot.id,
                    speed_kmph=40.0,
                    available=True
                ))

    # Parse items and quantities
    from .extraction.providers.rules import ALIASES
    updated_lots = []
    # Split on commas, 'and', newlines
    clauses = re.split(r"[,;\n]|\band\b", body_text, flags=re.I)
    for clause in clauses:
        c = clause.strip()
        if not c:
            continue
        # Find item alias
        matched_item_id = None
        for item_id, aliases in ALIASES.items():
            for alias in aliases:
                if re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", c, re.I):
                    matched_item_id = item_id
                    break
            if matched_item_id:
                break

        if not matched_item_id:
            continue

        # Find quantity
        qty_m = re.search(r"\b(\d+(?:\.\d+)?)\b", c)
        if not qty_m:
            continue
        qty_val = float(qty_m.group(1))

        # Upsert stock
        stock_row = db.query(Stock).filter_by(location_id=depot.id, item_id=matched_item_id).first()
        now_str = now_iso()
        unit_str = items_map[matched_item_id].unit if matched_item_id in items_map else "unit"
        if stock_row:
            stock_row.quantity = qty_val
            stock_row.updated_at = now_str
        else:
            stock_row = Stock(
                location_id=depot.id,
                item_id=matched_item_id,
                quantity=qty_val,
                reserved=0.0,
                unit=unit_str,
                updated_at=now_str
            )
            db.add(stock_row)
        db.commit()
        updated_lots.append(stock_row)

    if not updated_lots:
        return jsonify({"error": "No matching supply items/quantities recognized in text"}), 422

    locs_names = {l.id: l.name for l in db.query(Location).all()}
    item_names = {i.id: i.name for i in items}
    res = []
    for s in updated_lots:
        d = s.to_dict(item_names, locs_names)
        d["lat"] = depot.lat
        d["lng"] = depot.lng
        res.append(d)
    return jsonify(res), 200


# 13. Supply CSV
@api_bp.route("/supply/csv", methods=["POST"])
def supply_csv():
    # Supports multipart "file" or raw CSV text
    csv_text = ""
    if "file" in request.files:
        file = request.files["file"]
        csv_text = file.read().decode("utf-8", errors="replace")
    else:
        csv_text = request.get_data(as_text=True)

    if not csv_text.strip():
        return jsonify({"error": "CSV file or text is required"}), 400

    db = get_db()
    items_by_id = {i.id: i for i in db.query(Item).all()}
    locations_by_id = {l.id: l for l in db.query(Location).all()}

    reader = csv.DictReader(io.StringIO(csv_text))
    updated_lots = []

    from .extraction.providers.rules import ALIASES
    for idx, row in enumerate(reader, start=2):
        item_raw = (row.get("item") or "").strip().lower()
        qty_str = (row.get("qty") or "0").strip()
        depot_id = (row.get("depot_id") or "").strip()
        unit = (row.get("unit") or "unit").strip()

        # Match item against aliases
        matched_item_id = None
        if item_raw in items_by_id:
            matched_item_id = item_raw
        else:
            for item_id, aliases in ALIASES.items():
                if any(alias in item_raw for alias in aliases):
                    matched_item_id = item_id
                    break

        if not matched_item_id:
            return jsonify({"error": f"Row {idx}: Unknown item '{item_raw}'. Allowed: {', '.join(items_by_id.keys())}"}), 400

        try:
            qty_val = float(qty_str)
        except ValueError:
            return jsonify({"error": f"Row {idx}: Invalid quantity '{qty_str}'"}), 400

        # Upsert stock
        stock_row = db.query(Stock).filter_by(location_id=depot_id, item_id=matched_item_id).first()
        now_str = now_iso()
        if stock_row:
            stock_row.quantity = qty_val
            stock_row.updated_at = now_str
        else:
            stock_row = Stock(
                location_id=depot_id,
                item_id=matched_item_id,
                quantity=qty_val,
                reserved=0.0,
                unit=unit,
                updated_at=now_str
            )
            db.add(stock_row)
        db.commit()
        updated_lots.append(stock_row)

    item_names = {i.id: i.name for i in items_by_id.values()}
    locs_names = {l.id: l.name for l in locations_by_id.values()}
    res = []
    for s in updated_lots:
        d = s.to_dict(item_names, locs_names)
        loc = locations_by_id.get(s.location_id)
        if loc:
            d["lat"] = loc.lat
            d["lng"] = loc.lng
        res.append(d)
    return jsonify(res), 200


# 14. Match / Plan runner
def execute_plan(weights=None, algorithm="greedy"):
    db = get_db()
    return build_plan(
        db,
        weights=weights,
        algorithm=algorithm
    )
@api_bp.route("/match/run", methods=["POST"])
def run_match():
    data = request.get_json(silent=True) or {}
    weights = data.get("weights")
    algorithm = data.get("algorithm", "greedy")
    plan = execute_plan(weights=weights, algorithm=algorithm)
    return jsonify(plan), 200


@api_bp.route("/plan/latest", methods=["GET"])
def get_latest_plan():
    db = get_db()
    latest_run = db.query(PlanRun).order_by(PlanRun.created_at.desc()).first()
    if latest_run:
        try:
            return jsonify(json.loads(latest_run.payload_json)), 200
        except Exception:
            pass
    # If no plan exists, run one now
    plan = execute_plan()
    return jsonify(plan), 200


# 15. Move State Actions
@api_bp.route("/moves/<move_id>/approve", methods=["POST"])
def approve_move(move_id):
    db = get_db()
    move = db.query(Move).filter_by(id=move_id).first()
    if not move:
        return jsonify({"error": f"Move {move_id} not found"}), 404

    delta = (move.edited_qty if move.edited_qty is not None else move.qty)

    if move.state != "approved":
        move.state = "approved"
        # Reserve stock and fulfill demand
        stock = db.query(Stock).filter_by(id=move.stock_id).first()
        demand = db.query(Demand).filter_by(id=move.demand_id).first()
        if stock:
            stock.reserved = (stock.reserved or 0.0) + delta
        if demand:
            demand.fulfilled = (demand.fulfilled or 0.0) + delta

        db.add(Audit(
            user="Aastha Jha (Coordinator)",
            action="approved",
            target_id=move.id,
            timestamp=now_iso(),
            notes=f"Approved dispatch of {delta} {move.item_id}"
        ))
        db.commit()

    return jsonify({"state": "approved"}), 200


@api_bp.route("/moves/<move_id>/edit", methods=["POST"])
def edit_move(move_id):
    data = request.get_json(silent=True) or {}
    new_qty = data.get("qty")
    notes = data.get("notes") or "Edited by coordinator"

    db = get_db()
    move = db.query(Move).filter_by(id=move_id).first()
    if not move:
        return jsonify({"error": f"Move {move_id} not found"}), 404

    if new_qty is not None:
        try:
            qty_val = float(new_qty)
            if qty_val <= 0:
                return jsonify({"error": "Quantity must be greater than 0"}), 400
            
            # If already approved, adjust reserved stock delta
            if move.state == "approved":
                stock = db.query(Stock).filter_by(id=move.stock_id).first()
                demand = db.query(Demand).filter_by(id=move.demand_id).first()
                old_qty = move.edited_qty if move.edited_qty is not None else move.qty
                diff = qty_val - old_qty
                if stock:
                    stock.reserved = max(0.0, (stock.reserved or 0.0) + diff)
                if demand:
                    demand.fulfilled = max(0.0, (demand.fulfilled or 0.0) + diff)

            move.edited_qty = qty_val
        except ValueError:
            return jsonify({"error": "Invalid quantity"}), 400

    move.state = "edited"
    move.notes = notes

    db.add(Audit(
        user="Aastha Jha (Coordinator)",
        action="edited",
        target_id=move.id,
        timestamp=now_iso(),
        notes=f"Edited proposal to {move.edited_qty or move.qty} units. Notes: {notes}"
    ))
    db.commit()

    return jsonify({"state": "edited"}), 200


@api_bp.route("/moves/<move_id>/reject", methods=["POST"])
def reject_move(move_id):
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400

    db = get_db()
    move = db.query(Move).filter_by(id=move_id).first()
    if not move:
        return jsonify({"error": f"Move {move_id} not found"}), 404

    # If was approved, rollback reserved stock and demand fulfillment
    if move.state == "approved":
        released_qty = move.edited_qty if move.edited_qty is not None else move.qty
        stock = db.query(Stock).filter_by(id=move.stock_id).first()
        demand = db.query(Demand).filter_by(id=move.demand_id).first()
        if stock:
            stock.reserved = max(0.0, (stock.reserved or 0.0) - released_qty)
        if demand:
            demand.fulfilled = max(0.0, (demand.fulfilled or 0.0) - released_qty)

    move.state = "rejected"
    move.notes = reason

    db.add(Audit(
        user="Aastha Jha (Coordinator)",
        action="rejected",
        target_id=move.id,
        timestamp=now_iso(),
        notes=reason
    ))
    db.commit()

    return jsonify({"state": "rejected"}), 200


# 16. Audit Log
@api_bp.route("/audit", methods=["GET"])
def get_audit():
    db = get_db()
    audits = db.query(Audit).order_by(Audit.timestamp.desc()).all()
    return jsonify([a.to_dict() for a in audits])


# 17. Shortages
@api_bp.route("/shortages", methods=["GET"])
def get_shortages():
    plan = execute_plan()
    return jsonify(plan.get("shortages", []))


# 18. Admin seed reset
@api_bp.route("/admin/seed/reset", methods=["POST"])
def seed_reset():
    from .seed.seed import seed_database
    db = get_db()
    seed_database(db, if_empty=False)
    return jsonify({"status": "ok", "message": "Database reset to Punjab flood scenario"}), 200

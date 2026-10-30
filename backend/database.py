import json
import uuid
import os
import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATABASE_PATH = Path(
    os.getenv(
        "DATABASE_PATH",
        str(PROJECT_ROOT / "instance" / "reliefos.db")
    )
)


SCHEMA = """
CREATE TABLE IF NOT EXISTS demands (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    item TEXT,
    quantity_needed REAL,
    unit TEXT,
    fulfilled REAL NOT NULL DEFAULT 0,
    urgency TEXT NOT NULL DEFAULT 'medium',
    location_id TEXT,
    camp_id TEXT,
    district TEXT,
    location_text TEXT,
    lat REAL,
    lng REAL,
    beneficiaries INTEGER,
    source TEXT DEFAULT 'coordinator',
    verified INTEGER NOT NULL DEFAULT 0,
    needs_review INTEGER NOT NULL DEFAULT 1,
    trust REAL DEFAULT 0,
    trust_reasons TEXT DEFAULT '[]',
    sender_key TEXT,
    raw_text TEXT,
    language TEXT DEFAULT 'en',
    duplicate_of TEXT,
    report_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supply_lots (
    id TEXT PRIMARY KEY,
    location_id TEXT,
    item_id TEXT NOT NULL,
    item TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    reserved REAL NOT NULL DEFAULT 0,
    unit TEXT,
    lat REAL,
    lng REAL,
    name TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moves (
    id TEXT PRIMARY KEY,
    demand_id TEXT,
    stock_id TEXT,
    vehicle_id TEXT,
    item_id TEXT,
    qty REAL NOT NULL DEFAULT 0,
    km REAL,
    eta_h REAL,
    score REAL,
    trips INTEGER DEFAULT 1,
    reason TEXT,
    notes TEXT,
    state TEXT NOT NULL DEFAULT 'proposed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (demand_id) REFERENCES demands(id),
    FOREIGN KEY (stock_id) REFERENCES supply_lots(id)
);

CREATE TABLE IF NOT EXISTS audit_entries (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor TEXT,
    details TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demands_urgency
ON demands(urgency);

CREATE INDEX IF NOT EXISTS idx_demands_verified
ON demands(verified);

CREATE INDEX IF NOT EXISTS idx_supply_item
ON supply_lots(item_id);

CREATE INDEX IF NOT EXISTS idx_moves_state
ON moves(state);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON audit_entries(created_at);
"""


def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


def init_db():
    connection = get_connection()

    try:
        connection.executescript(SCHEMA)
        connection.commit()
    finally:
        connection.close()


def save_demand(
    draft,
    lat=None,
    lng=None,
    trust=0.0,
    trust_reasons=None,
    sender_key=None
):
    """Save an extracted DemandDraft into SQLite."""

    demand_id = str(uuid.uuid4())

    connection = get_connection()

    try:
        connection.execute(
            """
            INSERT INTO demands (
                id, item_id, item, quantity_needed, unit,
                urgency, camp_id, location_id, location_text,
                lat, lng, beneficiaries, source, verified,
                needs_review, trust, trust_reasons, sender_key,
                raw_text, language, duplicate_of, report_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                demand_id,
                draft.item,
                draft.item,
                draft.qty,
                draft.unit,
                draft.urgency,
                draft.camp_id,
                draft.camp_id,
                draft.location_text,
                lat,
                lng,
                draft.beneficiaries,
                draft.source,
                int(draft.verified),
                int(draft.needs_review),
                trust,
                json.dumps(trust_reasons or []),
                sender_key,
                draft.raw_text,
                draft.language,
                draft.duplicate_of,
                draft.report_count
            )
        )

        connection.commit()
        return demand_id

    finally:
        connection.close()

def get_demands():
    """Retrieve all saved demands from SQLite."""

    connection = get_connection()

    try:
        rows = connection.execute(
            """
            SELECT *
            FROM demands
            ORDER BY created_at DESC
            """
        ).fetchall()

        demands = []

        for row in rows:
            demand = dict(row)

            # Convert JSON text into a Python list
            demand["trust_reasons"] = json.loads(
                demand["trust_reasons"] or "[]"
            )

            # Convert database integers into booleans
            demand["verified"] = bool(demand["verified"])
            demand["needs_review"] = bool(demand["needs_review"])

            demands.append(demand)

        return demands

    finally:
        connection.close()


def verify_demand(demand_id, actor="coordinator"):
    """Verify a demand and record the action in the audit log."""

    connection = get_connection()

    try:
        row = connection.execute(
            "SELECT id FROM demands WHERE id = ?",
            (demand_id,)
        ).fetchone()

        if row is None:
            return False

        connection.execute(
            """
            UPDATE demands
            SET verified = 1,
                needs_review = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (demand_id,)
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "demand_verified",
                "demand",
                demand_id,
                actor,
                json.dumps({"verified": True})
            )
        )

        connection.commit()
        return True

    finally:
        connection.close()


def reject_demand(demand_id, reason, actor="coordinator"):
    """Reject a demand and record the action in the audit log."""

    connection = get_connection()

    try:
        row = connection.execute(
            "SELECT id FROM demands WHERE id = ?",
            (demand_id,)
        ).fetchone()

        if row is None:
            return False

        connection.execute(
            """
            UPDATE demands
            SET verified = 0,
                needs_review = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (demand_id,)
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "demand_rejected",
                "demand",
                demand_id,
                actor,
                json.dumps({"reason": reason})
            )
        )

        connection.commit()
        return True

    finally:
        connection.close()


def correct_demand(demand_id, corrections, actor="coordinator"):
    """Correct demand details and record the changes."""

    allowed_fields = {
        "item", "qty", "unit", "urgency", "camp_id"
    }

    if not corrections or not isinstance(corrections, dict):
        return None

    if not set(corrections).issubset(allowed_fields):
        return None

    connection = get_connection()

    try:
        row = connection.execute(
            "SELECT * FROM demands WHERE id = ?",
            (demand_id,)
        ).fetchone()

        if row is None:
            return None

        updates = {}

        if "item" in corrections:
            item = corrections["item"]

            if not isinstance(item, str) or not item.strip():
                return None

            item = item.strip().lower()

            if item not in {"water", "food", "tent", "blanket", "medkit"}:
                return None

            updates["item"] = item
            updates["item_id"] = item

        if "qty" in corrections:
            try:
                qty = float(corrections["qty"])
            except (TypeError, ValueError):
                return None

            if qty <= 0:
                return None

            updates["quantity_needed"] = qty

        if "unit" in corrections:
            unit = corrections["unit"]

            if not isinstance(unit, str) or not unit.strip():
                return None

            updates["unit"] = unit.strip()

        if "urgency" in corrections:
            urgency = corrections["urgency"]

            if urgency not in {"low", "medium", "high", "critical"}:
                return None

            updates["urgency"] = urgency

        if "camp_id" in corrections:
            camp_id = corrections["camp_id"]

            if not isinstance(camp_id, str) or not camp_id.strip():
                return None

            camp_id = camp_id.strip().lower()

            updates["camp_id"] = camp_id
            updates["location_id"] = camp_id
            updates["location_text"] = camp_id.replace("camp", "camp ")

        if not updates:
            return None

        fields = ", ".join(
            f"{field} = ?" for field in updates
        )

        values = list(updates.values())
        values.append(demand_id)

        connection.execute(
            f"""
            UPDATE demands
            SET {fields},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            values
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "demand_corrected",
                "demand",
                demand_id,
                actor,
                json.dumps(updates)
            )
        )

        connection.commit()

        updated = connection.execute(
            "SELECT * FROM demands WHERE id = ?",
            (demand_id,)
        ).fetchone()

        result = dict(updated)
        result["trust_reasons"] = json.loads(
            result["trust_reasons"] or "[]"
        )
        result["verified"] = bool(result["verified"])
        result["needs_review"] = bool(result["needs_review"])

        return result

    finally:
        connection.close()

def get_stock():
    """Retrieve all supply inventory records from SQLite."""

    connection = get_connection()

    try:
        rows = connection.execute(
            """
            SELECT *
            FROM supply_lots
            ORDER BY name, item_id
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


def save_supply(item, quantity, unit, depot_name):
    """Save a supply lot after validating its depot."""

    import uuid

    gazetteer_path = (
        PROJECT_ROOT / "backend" / "seed" / "gazetteer.json"
    )

    with open(gazetteer_path, "r", encoding="utf-8") as file:
        gazetteer = json.load(file)

    depot_key = depot_name.strip().lower()

    if depot_key not in gazetteer:
        return None

    depot = gazetteer[depot_key]

    item = item.strip().lower()

    if item not in {"water", "food", "tent", "blanket", "medkit"}:
        return None

    try:
        quantity = float(quantity)
    except (TypeError, ValueError):
        return None

    if quantity <= 0:
        return None

    if not isinstance(unit, str) or not unit.strip():
        return None

    supply_id = str(uuid.uuid4())

    connection = get_connection()

    try:
        connection.execute(
            """
            INSERT INTO supply_lots (
                id, location_id, item_id, item,
                quantity, reserved, unit,
                lat, lng, name
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                supply_id,
                depot_key,
                item,
                item,
                quantity,
                unit.strip(),
                depot["lat"],
                depot["lng"],
                depot["district"]
            )
        )

        connection.commit()

        row = connection.execute(
            "SELECT * FROM supply_lots WHERE id = ?",
            (supply_id,)
        ).fetchone()

        return dict(row)

    finally:
        connection.close()

def save_supplies(entries):
    """Save multiple supply entries in one database transaction."""

    gazetteer_path = (
        PROJECT_ROOT / "backend" / "seed" / "gazetteer.json"
    )

    with open(gazetteer_path, "r", encoding="utf-8") as file:
        gazetteer = json.load(file)

    allowed_items = {
        "water", "food", "tent", "blanket", "medkit"
    }

    validated = []

    # Validate every entry before saving anything.
    for entry in entries:
        depot_name = entry["depot"].strip().lower()
        item = entry["item"].strip().lower()
        unit = entry["unit"].strip()

        if depot_name not in gazetteer:
            raise ValueError(f"Unknown depot: {depot_name}")

        if item not in allowed_items:
            raise ValueError(f"Unknown supply item: {item}")

        quantity = float(entry["quantity"])

        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")

        if not unit:
            raise ValueError("Unit cannot be empty.")

        depot = gazetteer[depot_name]

        validated.append((
            str(uuid.uuid4()),
            depot_name,
            item,
            item,
            quantity,
            unit,
            depot["lat"],
            depot["lng"],
            depot["district"]
        ))

    if not validated:
        raise ValueError("No valid supply entries provided.")

    connection = get_connection()

    try:
        connection.executemany(
            """
            INSERT INTO supply_lots (
                id, location_id, item_id, item,
                quantity, reserved, unit,
                lat, lng, name
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            validated
        )

        connection.commit()

        return [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM supply_lots ORDER BY updated_at DESC"
            ).fetchall()
        ]

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def save_moves(recommendations):
    """Save matching recommendations as proposed moves."""
    connection = get_connection()

    try:
        saved_ids = []

        for rec in recommendations:
            move_id = str(uuid.uuid4())

            connection.execute(
                """
                INSERT INTO moves (
                    id, demand_id, stock_id, vehicle_id,
                    item_id, qty, km, eta_h, score,
                    trips, reason, notes, state
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed')
                """,
                (
                    move_id,
                    rec.get("demand_id"),
                    rec.get("stock_id"),
                    rec.get("vehicle_id"),
                    rec.get("item_id"),
                    rec.get("qty", 0),
                    rec.get("km"),
                    rec.get("eta_h"),
                    rec.get("score"),
                    rec.get("trips", 1),
                    rec.get("reason"),
                    rec.get("notes")
                )
            )

            saved_ids.append(move_id)

        connection.commit()
        return saved_ids

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def get_move(move_id):
    """Fetch one move by its ID."""
    connection = get_connection()

    try:
        row = connection.execute(
            "SELECT * FROM moves WHERE id = ?",
            (move_id,)
        ).fetchone()

        return dict(row) if row else None

    finally:
        connection.close()


def get_moves():
    """Fetch all moves, newest first."""
    connection = get_connection()

    try:
        rows = connection.execute(
            "SELECT * FROM moves ORDER BY created_at DESC"
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


def add_audit_entry(action, entity_type, entity_id,
                    actor="system", details=None):
    """Record an action in the audit log."""
    connection = get_connection()

    try:
        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id,
                actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                action,
                entity_type,
                entity_id,
                actor,
                json.dumps(details or {})
            )
        )

        connection.commit()

    finally:
        connection.close()


def get_audit_entries(limit=100):
    """Fetch recent audit entries."""
    connection = get_connection()

    try:
        rows = connection.execute(
            """
            SELECT * FROM audit_entries
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()

        entries = []

        for row in rows:
            entry = dict(row)
            entry["details"] = json.loads(entry["details"] or "{}")
            entries.append(entry)

        return entries

    finally:
        connection.close()


def approve_move(move_id, actor="system"):
    """Approve a proposed move and reserve stock atomically."""
    connection = get_connection()

    try:
        connection.execute("BEGIN IMMEDIATE")

        move = connection.execute(
            "SELECT * FROM moves WHERE id = ?",
            (move_id,)
        ).fetchone()

        if not move:
            raise ValueError("Move not found.")

        if move["state"] not in ("proposed", "edited"):
            raise ValueError("Only proposed or edited moves can be approved.")

        stock = connection.execute(
            "SELECT * FROM supply_lots WHERE id = ?",
            (move["stock_id"],)
        ).fetchone()

        if not stock:
            raise ValueError("Associated stock lot not found.")

        available = float(stock["quantity"]) - float(stock["reserved"])

        if float(move["qty"]) <= 0:
            raise ValueError("Move quantity must be greater than zero.")

        if float(move["qty"]) > available:
            raise ValueError("Insufficient available stock.")

        connection.execute(
            """
            UPDATE supply_lots
            SET reserved = reserved + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (move["qty"], move["stock_id"])
        )

        connection.execute(
            """
            UPDATE moves
            SET state = 'approved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (move_id,)
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "move_approved",
                "move",
                move_id,
                actor,
                json.dumps({"reserved_quantity": move["qty"]})
            )
        )

        connection.commit()

        return get_move(move_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def edit_move(move_id, qty=None, notes=None, actor="system"):
    """Edit a proposed move without changing reserved stock."""
    connection = get_connection()

    try:
        connection.execute("BEGIN IMMEDIATE")

        move = connection.execute(
            "SELECT * FROM moves WHERE id = ?",
            (move_id,)
        ).fetchone()

        if not move:
            raise ValueError("Move not found.")

        if move["state"] not in ("proposed", "edited"):
            raise ValueError("Only proposed or edited moves can be edited.")

        new_qty = float(move["qty"]) if qty is None else float(qty)

        if new_qty <= 0:
            raise ValueError("Move quantity must be greater than zero.")

        stock = connection.execute(
            "SELECT * FROM supply_lots WHERE id = ?",
            (move["stock_id"],)
        ).fetchone()

        if not stock:
            raise ValueError("Associated stock lot not found.")

        available = float(stock["quantity"]) - float(stock["reserved"])

        if new_qty > available:
            raise ValueError("Insufficient available stock.")

        new_notes = move["notes"] if notes is None else notes

        connection.execute(
            """
            UPDATE moves
            SET qty = ?,
                notes = ?,
                state = 'edited',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_qty, new_notes, move_id)
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "move_edited",
                "move",
                move_id,
                actor,
                json.dumps({"qty": new_qty, "notes": new_notes})
            )
        )

        connection.commit()

        return get_move(move_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def reject_move(move_id, reason, actor="system"):
    """Reject a proposed move and record the reason."""
    connection = get_connection()

    try:
        connection.execute("BEGIN IMMEDIATE")

        move = connection.execute(
            "SELECT * FROM moves WHERE id = ?",
            (move_id,)
        ).fetchone()

        if not move:
            raise ValueError("Move not found.")

        if move["state"] not in ("proposed", "edited"):
            raise ValueError("Only proposed or edited moves can be rejected.")

        if not reason or not reason.strip():
            raise ValueError("A rejection reason is required.")

        connection.execute(
            """
            UPDATE moves
            SET state = 'rejected',
                reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (reason.strip(), move_id)
        )

        connection.execute(
            """
            INSERT INTO audit_entries (
                id, action, entity_type, entity_id, actor, details
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                "move_rejected",
                "move",
                move_id,
                actor,
                json.dumps({"reason": reason.strip()})
            )
        )

        connection.commit()

        return get_move(move_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

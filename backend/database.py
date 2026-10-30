
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

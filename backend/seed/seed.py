"""Seed script for ReliefOS (Punjab flood scenario)."""
from __future__ import annotations
import sys
import json
import os
from datetime import datetime, timezone, timedelta
from backend.models import (
    init_db, Location, Item, Demand, Stock, Vehicle, Move, Audit, PlanRun
)
from backend.config import Config

CAMPS = [
    {"id": "camp17", "name": "Camp 17", "type": "camp", "lat": 32.04, "lng": 75.40, "district": "Gurdaspur", "population": 600},
    {"id": "camp4",  "name": "Camp 4",  "type": "camp", "lat": 30.92, "lng": 74.61, "district": "Firozpur",   "population": 450},
    {"id": "camp8",  "name": "Camp 8",  "type": "camp", "lat": 31.51, "lng": 75.91, "district": "Hoshiarpur", "population": 300},
    {"id": "camp12", "name": "Camp 12", "type": "camp", "lat": 30.90, "lng": 75.85, "district": "Ludhiana",   "population": 800},
    {"id": "camp21", "name": "Camp 21", "type": "camp", "lat": 30.34, "lng": 76.39, "district": "Patiala",    "population": 500},
    {"id": "camp3",  "name": "Camp 3",  "type": "camp", "lat": 31.63, "lng": 74.87, "district": "Amritsar",   "population": 350},
    {"id": "camp9",  "name": "Camp 9",  "type": "camp", "lat": 30.24, "lng": 75.84, "district": "Sangrur",    "population": 250},
    {"id": "camp6",  "name": "Camp 6",  "type": "camp", "lat": 31.33, "lng": 75.58, "district": "Jalandhar",  "population": 450},
]

DEPOTS = [
    {"id": "ludhiana-depot",  "name": "Ludhiana Central Depot", "type": "depot", "lat": 30.9010, "lng": 75.8573, "district": "Ludhiana"},
    {"id": "amritsar-depot",  "name": "Amritsar Relief Hub",    "type": "depot", "lat": 31.6340, "lng": 74.8723, "district": "Amritsar"},
    {"id": "jalandhar-depot", "name": "Jalandhar Sector Depot", "type": "depot", "lat": 31.3260, "lng": 75.5762, "district": "Jalandhar"},
    {"id": "firozpur-depot",  "name": "Firozpur Border Depot",  "type": "depot", "lat": 30.9254, "lng": 74.6136, "district": "Firozpur"},
    {"id": "patiala-depot",   "name": "Patiala Regional Depot", "type": "depot", "lat": 30.3398, "lng": 76.3869, "district": "Patiala"},
]

ITEMS = [
    {"id": "water",   "name": "Drinking Water", "unit": "litre",  "category": "water",   "sphere_rate": 15.0},
    {"id": "food",    "name": "Food Packet",    "unit": "packet", "category": "food",    "sphere_rate": 1.0},
    {"id": "tent",    "name": "Tent",           "unit": "unit",   "category": "shelter", "sphere_rate": None},
    {"id": "medkit",  "name": "Medical Kit",    "unit": "kit",    "category": "medical", "sphere_rate": None},
    {"id": "blanket", "name": "Blanket",        "unit": "unit",   "category": "shelter", "sphere_rate": None},
]

VEHICLES = [
    {"id": "truck-1", "type": "Heavy Truck", "capacity_kg": 3500.0, "current_location_id": "ludhiana-depot", "speed_kmph": 40.0, "available": True},
    {"id": "truck-2", "type": "Medium Truck", "capacity_kg": 2000.0, "current_location_id": "jalandhar-depot", "speed_kmph": 45.0, "available": True},
    {"id": "van-1",   "type": "Light Van",   "capacity_kg": 800.0,  "current_location_id": "amritsar-depot", "speed_kmph": 50.0, "available": True},
]


def seed_database(session, if_empty: bool = False):
    if if_empty:
        existing_demands = session.query(Demand).count()
        existing_stock = session.query(Stock).count()
        if existing_demands > 0 or existing_stock > 0:
            return False

    # Clear existing data for fresh seed
    session.query(Move).delete()
    session.query(Demand).delete()
    session.query(Stock).delete()
    session.query(Vehicle).delete()
    session.query(Item).delete()
    session.query(Location).delete()
    session.query(Audit).delete()
    session.query(PlanRun).delete()

    # Insert locations
    for c in CAMPS:
        session.add(Location(**c))
    for d in DEPOTS:
        session.add(Location(**d))

    # Insert items
    for it in ITEMS:
        session.add(Item(**it))

    # Insert vehicles
    for v in VEHICLES:
        session.add(Vehicle(**v))

    now = datetime.now(timezone.utc)
    fresh_time = now.isoformat()
    # One stale stock lot: updated 14 hours ago
    stale_time = (now - timedelta(hours=14)).isoformat()

    # Stock lots
    stock_rows = [
        # Scarce water at Ludhiana (800 L) - competing across 3 camps
        Stock(id="stock-water-ludhiana", location_id="ludhiana-depot", item_id="water", quantity=800.0, reserved=0.0, unit="litre", updated_at=fresh_time),
        Stock(id="stock-food-ludhiana",  location_id="ludhiana-depot", item_id="food",  quantity=3000.0, reserved=0.0, unit="packet", updated_at=fresh_time),
        Stock(id="stock-blanket-ludhiana", location_id="ludhiana-depot", item_id="blanket", quantity=400.0, reserved=0.0, unit="unit", updated_at=stale_time),
        Stock(id="stock-medkit-ludhiana", location_id="ludhiana-depot", item_id="medkit", quantity=150.0, reserved=0.0, unit="kit", updated_at=fresh_time),

        Stock(id="stock-water-amritsar", location_id="amritsar-depot", item_id="water", quantity=2500.0, reserved=0.0, unit="litre", updated_at=fresh_time),
        Stock(id="stock-tent-amritsar",  location_id="amritsar-depot", item_id="tent",  quantity=150.0, reserved=0.0, unit="unit", updated_at=fresh_time),

        Stock(id="stock-food-jalandhar", location_id="jalandhar-depot", item_id="food", quantity=2000.0, reserved=0.0, unit="packet", updated_at=fresh_time),
        Stock(id="stock-medkit-jalandhar", location_id="jalandhar-depot", item_id="medkit", quantity=250.0, reserved=0.0, unit="kit", updated_at=fresh_time),
    ]
    for s in stock_rows:
        session.add(s)

    # Demands
    # "Three camps, one truck" conflict fixture:
    # Camp 17: Water, 600, CRITICAL, 3h ago
    # Camp 21: Water, 500, CRITICAL, 1h ago
    # Camp 6:  Water, 450, HIGH, 5h ago
    d17_time = (now - timedelta(hours=3)).isoformat()
    d21_time = (now - timedelta(hours=1)).isoformat()
    d06_time = (now - timedelta(hours=5)).isoformat()

    demands = [
        Demand(
            id="dem-camp17-water",
            client_uuid="uuid-dem-17",
            client_created_at=d17_time,
            created_at=d17_time,
            raw_text="Camp 17 needs drinking water for approx 600 people, urgent",
            item_id="water",
            qty=600.0,
            unit="litre",
            beneficiaries=600,
            urgency="critical",
            confidence=0.92,
            provider="gemini",
            needs_review=False,
            location_text="Camp 17",
            camp_id="camp17",
            source="coordinator",
            verified=True,
            rejected=False,
            kind="demand",
            language="en",
            report_count=1,
            lat=32.04,
            lng=75.40,
        ),
        Demand(
            id="dem-camp21-water",
            client_uuid="uuid-dem-21",
            client_created_at=d21_time,
            created_at=d21_time,
            raw_text="Camp 21 paani bilkul khatam ho chuka hai 500 log hain urgent",
            item_id="water",
            qty=500.0,
            unit="litre",
            beneficiaries=500,
            urgency="critical",
            confidence=0.88,
            provider="gemini",
            needs_review=False,
            location_text="Camp 21",
            camp_id="camp21",
            source="coordinator",
            verified=True,
            rejected=False,
            kind="demand",
            language="hinglish",
            report_count=1,
            lat=30.34,
            lng=76.39,
        ),
        Demand(
            id="dem-camp06-water",
            client_uuid="uuid-dem-06",
            client_created_at=d06_time,
            created_at=d06_time,
            raw_text="Camp 6 needs 450 water urgently for families",
            item_id="water",
            qty=450.0,
            unit="litre",
            beneficiaries=450,
            urgency="high",
            confidence=0.85,
            provider="gemini",
            needs_review=False,
            location_text="Camp 6",
            camp_id="camp6",
            source="coordinator",
            verified=True,
            rejected=False,
            kind="demand",
            language="en",
            report_count=1,
            lat=31.33,
            lng=75.58,
        ),
        Demand(
            id="dem-camp04-tents",
            client_uuid="uuid-dem-04",
            client_created_at=fresh_time,
            created_at=fresh_time,
            raw_text="Camp 4 needs 200 waterproof tents immediately for newly displaced families",
            item_id="tent",
            qty=200.0,
            unit="unit",
            beneficiaries=200,
            urgency="high",
            confidence=0.65,
            provider="rules",
            needs_review=True,
            location_text="Camp 4",
            camp_id="camp4",
            source="coordinator",
            verified=True,
            rejected=False,
            kind="demand",
            language="en",
            report_count=1,
            lat=30.92,
            lng=74.61,
        ),
        # Unverified public report
        Demand(
            id="dem-pub-camp08-medkit",
            client_uuid="uuid-dem-pub-08",
            client_created_at=fresh_time,
            created_at=fresh_time,
            raw_text="Camp 8 ke paas log beemar hain please medical kits bhejo turant",
            item_id="medkit",
            qty=100.0,
            unit="kit",
            beneficiaries=100,
            urgency="high",
            confidence=0.60,
            provider="rules",
            needs_review=True,
            location_text="Camp 8",
            camp_id="camp8",
            source="public",
            verified=False,
            rejected=False,
            kind="demand",
            language="hinglish",
            report_count=3,
            lat=31.51,
            lng=75.91,
            phone="+91 98765 43210",
        ),
    ]
    for d in demands:
        session.add(d)

    # Initial Audit Entry
    session.add(Audit(
        user="System (Seed)",
        action="verified",
        target_id="dem-camp17-water",
        timestamp=fresh_time,
        notes="Seeded Punjab Flood scenario"
    ))

    session.commit()

    # Also save messages and supply sample json
    save_seed_files(demands, stock_rows)
    return True


def save_seed_files(demands, stock_rows):
    base_dir = os.path.dirname(__file__)
    msgs_path = os.path.join(base_dir, "messages.json")
    supply_path = os.path.join(base_dir, "supply.json")

    msgs = [{"raw_text": d.raw_text, "source": d.source, "camp_id": d.camp_id} for d in demands]
    with open(msgs_path, "w", encoding="utf-8") as f:
        json.dump(msgs, f, indent=2, ensure_ascii=False)

    stock_data = [
        {"location_id": s.location_id, "item_id": s.item_id, "quantity": s.quantity, "unit": s.unit}
        for s in stock_rows
    ]
    with open(supply_path, "w", encoding="utf-8") as f:
        json.dump(stock_data, f, indent=2, ensure_ascii=False)


def main():
    if_empty = "--if-empty" in sys.argv
    session = init_db(Config.DATABASE_URL)
    seeded = seed_database(session, if_empty=if_empty)
    if seeded:
        print("[OK] ReliefOS Punjab Flood scenario successfully seeded.")
    else:
        print("[SKIP] Database already contains records (--if-empty specified).")


if __name__ == "__main__":
    main()

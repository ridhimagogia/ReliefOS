"""SQLAlchemy models for ReliefOS."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Text, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session

Base = declarative_base()


def gen_uuid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Location(Base):
    __tablename__ = "locations"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    type = Column(String(32), nullable=False)  # 'camp' | 'depot' | 'hospital' | 'hub'
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    district = Column(String(64), nullable=False)
    population = Column(Integer, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "lat": self.lat,
            "lng": self.lng,
            "district": self.district,
            "population": self.population,
        }


class Item(Base):
    __tablename__ = "items"

    id = Column(String(64), primary_key=True)  # water, food, tent, etc.
    name = Column(String(128), nullable=False)
    unit = Column(String(32), nullable=False)
    category = Column(String(64), nullable=False)
    sphere_rate = Column(Float, nullable=True)  # e.g. 15.0 L for water

    def to_dict(self):
        return {
            "item_id": self.id,
            "name": self.name,
            "unit": self.unit,
            "category": self.category,
        }


class Demand(Base):
    __tablename__ = "demands"

    id = Column(String(64), primary_key=True, default=gen_uuid)
    client_uuid = Column(String(128), unique=True, nullable=True, index=True)
    client_created_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=now_iso)
    raw_text = Column(Text, nullable=False)
    item = Column(String(128), nullable=True)
    item_id = Column(String(64), nullable=True)
    qty = Column(Float, nullable=True)
    unit = Column(String(32), nullable=True)
    beneficiaries = Column(Integer, nullable=True)
    urgency = Column(String(32), default="medium")  # lowercase: critical, high, medium, low
    confidence = Column(Float, default=0.0)
    provider = Column(String(32), default="unknown")
    needs_review = Column(Boolean, default=True)
    location_text = Column(String(256), nullable=True)
    camp_id = Column(String(64), nullable=True, index=True)
    source = Column(String(32), default="coordinator")  # 'coordinator' | 'public'
    verified = Column(Boolean, default=True)
    rejected = Column(Boolean, default=False)
    kind = Column(String(32), default="demand")
    language = Column(String(32), default="en")
    duplicate_of = Column(String(64), nullable=True, index=True)
    report_count = Column(Integer, default=1)
    phone = Column(String(64), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    fulfilled = Column(Float, default=0.0)

    def to_dict(self, item_names: dict | None = None):
        item_name = self.item
        if not item_name and self.item_id:
            if item_names and self.item_id in item_names:
                item_name = item_names[self.item_id]
            else:
                item_name = self.item_id.title()
        return {
            "id": self.id,
            "item": item_name,
            "item_id": self.item_id,
            "qty": self.qty,
            "unit": self.unit,
            "location_text": self.location_text,
            "camp_id": self.camp_id,
            "beneficiaries": self.beneficiaries,
            "urgency": self.urgency.lower() if self.urgency else "medium",
            "confidence": self.confidence,
            "provider": self.provider,
            "needs_review": bool(self.needs_review),
            "raw_text": self.raw_text,
            "source": self.source,
            "verified": bool(self.verified),
            "rejected": bool(self.rejected),
            "kind": self.kind,
            "language": self.language,
            "duplicate_of": self.duplicate_of,
            "report_count": self.report_count,
            "client_uuid": self.client_uuid,
            "client_created_at": self.client_created_at,
            "created_at": self.created_at,
            "phone": self.phone,
            "lat": self.lat,
            "lng": self.lng,
        }


class Stock(Base):
    __tablename__ = "stock"

    id = Column(String(64), primary_key=True, default=gen_uuid)
    location_id = Column(String(64), nullable=False, index=True)  # depot id
    item_id = Column(String(64), nullable=False, index=True)
    quantity = Column(Float, default=0.0)
    reserved = Column(Float, default=0.0)
    unit = Column(String(32), default="unit")
    updated_at = Column(String(64), default=now_iso)

    def to_dict(self, item_names: dict | None = None, location_names: dict | None = None):
        item_name = (item_names.get(self.item_id) if item_names else None) or self.item_id.title()
        depot_name = (location_names.get(self.location_id) if location_names else None) or self.location_id
        return {
            "id": self.id,
            "item": item_name,
            "item_id": self.item_id,
            "qty": self.quantity,
            "unit": self.unit,
            "depot_id": self.location_id,
            "depot_name": depot_name,
            "reserved": self.reserved,
            "lat": 0.0,
            "lng": 0.0,
            "updated_at": self.updated_at,
        }


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(64), primary_key=True)
    type = Column(String(64), default="truck")
    capacity_kg = Column(Float, default=2000.0)
    current_location_id = Column(String(64), nullable=True)
    speed_kmph = Column(Float, default=40.0)
    available = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "capacity_kg": self.capacity_kg,
            "current_location_id": self.current_location_id,
            "speed_kmph": self.speed_kmph,
            "available": bool(self.available),
        }


class Move(Base):
    __tablename__ = "moves"

    id = Column(String(128), primary_key=True)  # mv-{demand_id}-{stock_id}
    demand_id = Column(String(64), nullable=False)
    stock_id = Column(String(64), nullable=False)
    vehicle_id = Column(String(64), nullable=True)
    origin_location_id = Column(String(64), nullable=True)
    dest_location_id = Column(String(64), nullable=True)
    qty = Column(Float, default=0.0)
    edited_qty = Column(Float, nullable=True)
    km = Column(Float, default=0.0)
    eta_h = Column(Float, default=0.0)
    score = Column(Float, default=0.0)
    item_id = Column(String(64), nullable=False)
    distance_source = Column(String(32), default="haversine")
    trips = Column(Integer, default=1)
    reason_json = Column(Text, default="{}")
    explain = Column(Text, default="")
    state = Column(String(32), default="pending")  # 'pending'|'approved'|'edited'|'rejected'
    notes = Column(Text, nullable=True)
    plan_run_id = Column(String(64), nullable=True)
    updated_at = Column(String(64), default=now_iso)

    def to_dict(self):
        import json
        try:
            reason = json.loads(self.reason_json) if self.reason_json else {}
        except Exception:
            reason = {}
        return {
            "id": self.id,
            "demand_id": self.demand_id,
            "stock_id": self.stock_id,
            "vehicle_id": self.vehicle_id,
            "origin_location_id": self.origin_location_id,
            "dest_location_id": self.dest_location_id,
            "qty": self.qty,
            "edited_qty": self.edited_qty,
            "km": self.km,
            "eta_h": self.eta_h,
            "score": self.score,
            "item_id": self.item_id,
            "distance_source": self.distance_source,
            "trips": self.trips,
            "reason": reason,
            "explain": self.explain,
            "state": self.state,
            "notes": self.notes,
        }


class Audit(Base):
    __tablename__ = "audit"

    id = Column(String(64), primary_key=True, default=gen_uuid)
    user = Column(String(128), default="Aastha Jha (Coordinator)")
    action = Column(String(32), nullable=False)
    target_id = Column(String(128), nullable=False)
    timestamp = Column(String(64), default=now_iso)
    notes = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user,
            "action": self.action,
            "target_id": self.target_id,
            "timestamp": self.timestamp,
            "notes": self.notes,
        }


class PlanRun(Base):
    __tablename__ = "plan_runs"

    id = Column(String(64), primary_key=True, default=gen_uuid)
    created_at = Column(String(64), default=now_iso)
    payload_json = Column(Text, nullable=False)


def init_db(database_url: str):
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    engine = create_engine(database_url, connect_args=connect_args)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    return scoped_session(session_factory)

"""Scoring for a (stock, demand) pair.

    score = feasible * (w_u*urg + w_f*fill + w_p*prox)

urg  : urgency level + a capped waiting bonus (uses client_created_at, so a report
       written offline at 10:00 and synced at 14:00 keeps its real waiting time)
fill : share of the remaining need this stock can cover (0..1)
prox : 1 - km / MAX_KM (nearer is better)
"""
from __future__ import annotations

from datetime import datetime, timezone

URGENCY_BASE = {"CRITICAL": 1.0, "HIGH": 0.75, "MEDIUM": 0.5, "LOW": 0.25}
DEFAULT_WEIGHTS = {"urgency": 0.5, "fill": 0.25, "proximity": 0.25}
MAX_KM = 400.0
MAX_ETA_H = 12.0
WAIT_BONUS_PER_HOUR = 0.01
WAIT_BONUS_CAP = 0.25


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_time(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def urgency_rank(demand) -> float:
    return URGENCY_BASE.get(str(demand.get("urgency", "MEDIUM")).upper(), 0.5)


def waiting_hours(demand, now=None) -> float:
    now = now or utcnow()
    t = parse_time(demand.get("client_created_at")) or parse_time(demand.get("created_at"))
    if t is None:
        return 0.0
    return max(0.0, (now - t).total_seconds() / 3600.0)


def urgency_value(demand, now=None) -> float:
    bonus = min(WAIT_BONUS_CAP, WAIT_BONUS_PER_HOUR * waiting_hours(demand, now))
    return min(1.0, urgency_rank(demand) + bonus)


def score_pair(available, remaining, urgency, km, feasible=True, weights=None, max_km=MAX_KM):
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    fill = min(available, remaining) / remaining if remaining > 0 else 0.0
    prox = 1.0 - min(km / max_km, 1.0)
    raw = w["urgency"] * urgency + w["fill"] * fill + w["proximity"] * prox
    score = raw if feasible else 0.0
    parts = {
        "urgency": round(urgency, 3),
        "fill": round(fill, 3),
        "proximity": round(prox, 3),
        "weights": w,
        "feasible": bool(feasible),
    }
    return round(score, 4), parts

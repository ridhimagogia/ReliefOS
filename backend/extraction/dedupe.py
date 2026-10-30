"""Deduplication and clustering rule for ReliefOS demands."""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

URGENCY_RANKS = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def parse_iso(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        s = ts_str.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def max_urgency(u1: str, u2: str) -> str:
    r1 = URGENCY_RANKS.get(u1.lower(), 1)
    r2 = URGENCY_RANKS.get(u2.lower(), 1)
    return u1 if r1 >= r2 else u2


def find_parent_cluster(new_item_id: Optional[str],
                        new_camp_id: Optional[str],
                        new_location_text: Optional[str],
                        new_time: datetime,
                        existing_demands: List[Any],
                        window_hours: float = 6.0) -> Optional[Any]:
    """Find the root parent demand if this matches an existing demand within window_hours."""
    if not new_item_id:
        return None

    # Normalize new_time to naive UTC
    if new_time.tzinfo is not None:
        new_time = new_time.astimezone(timezone.utc).replace(tzinfo=None)

    cutoff = new_time - timedelta(hours=window_hours)
    norm_loc = (new_location_text or "").lower().strip()

    # Search existing demands for a parent (must not be rejected, duplicate_of is None)
    candidates = []
    for d in existing_demands:
        if getattr(d, "rejected", False):
            continue
        # Root demands only
        if getattr(d, "duplicate_of", None):
            continue
        if getattr(d, "item_id", None) != new_item_id:
            continue

        # Match either camp_id or normalised location_text
        d_camp = getattr(d, "camp_id", None)
        d_loc = (getattr(d, "location_text", "") or "").lower().strip()

        location_match = False
        if new_camp_id and d_camp and new_camp_id == d_camp:
            location_match = True
        elif norm_loc and d_loc and norm_loc == d_loc:
            location_match = True

        if not location_match:
            continue

        d_created = getattr(d, "created_at_dt", None)
        if not d_created:
            d_created = parse_iso(getattr(d, "created_at", None))
        if d_created:
            if d_created.tzinfo is not None:
                d_created = d_created.astimezone(timezone.utc).replace(tzinfo=None)
            if d_created >= cutoff:
                candidates.append((d_created, d))

    if not candidates:
        return None

    # Return oldest candidate as root parent
    candidates.sort(key=lambda c: c[0])
    return candidates[0][1]

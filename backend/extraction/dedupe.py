
from datetime import datetime, timedelta, timezone


URGENCY_RANK = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def _parse_time(value):
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, str):
        try:
            result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)

    return result


def _quantity_matches(first, second):
    if first is None or second is None:
        return first is None and second is None

    try:
        first = float(first)
        second = float(second)
    except (TypeError, ValueError):
        return False

    if first == second:
        return True

    if first <= 0 or second <= 0:
        return False

    return abs(first - second) / max(abs(first), abs(second)) <= 0.20


def find_parent(demand, existing_demands, now=None):
    """Find a matching demand reported within the previous 6 hours."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    for existing in existing_demands:
        if not demand.get("item") or not demand.get("camp_id"):
            return None
        if existing.get("id") == demand.get("id"):
            continue

        if existing.get("rejected") or existing.get("duplicate_of"):
            continue

        if existing.get("item") != demand.get("item"):
            continue

        if existing.get("camp_id") != demand.get("camp_id"):
            continue

        old_time = _parse_time(existing.get("created_at"))
        if old_time is None:
            continue

        age = now - old_time
        if age < timedelta(0) or age > timedelta(hours=6):
            continue

        if not _quantity_matches(existing.get("qty"), demand.get("qty")):
            continue

        return existing

    return None


def apply_duplicate(demand, parent):
    """Update the parent and mark the incoming report as its duplicate."""
    if parent is None:
        return demand

    parent["report_count"] = int(parent.get("report_count", 1)) + 1

    old_urgency = parent.get("urgency", "medium")
    new_urgency = demand.get("urgency", "medium")

    if URGENCY_RANK.get(new_urgency, 0) > URGENCY_RANK.get(old_urgency, 0):
        parent["urgency"] = new_urgency

    demand["duplicate_of"] = parent.get("id")
    return demand


def draft_to_demand(draft, source="coordinator"):
    """Convert a DemandDraft into a dictionary for backend use."""
    if isinstance(draft, dict):
        result = dict(draft)
    else:
        result = {
            "item": draft.item,
            "qty": draft.qty,
            "unit": draft.unit,
            "location_text": draft.location_text,
            "camp_id": draft.camp_id,
            "beneficiaries": draft.beneficiaries,
            "urgency": draft.urgency,
            "confidence": draft.confidence,
            "provider": draft.provider,
            "raw_text": draft.raw_text,
            "language": draft.language,
            "kind": draft.kind,
            "items": draft.items,
        }

    result["source"] = source
    result["needs_review"] = (
        True if source == "public" else
        bool(result.get("needs_review", True))
    )

    return result

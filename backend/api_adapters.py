"""Adapters between internal models/drafts and the frontend API JSON contract."""
from __future__ import annotations
import re
from typing import Optional, Dict, Any
from .models import Demand, Item, Location

HINGLISH_WORDS = {
    "paani", "pani", "khana", "khaana", "kambal", "dawai", "dawa",
    "turant", "jaldi", "log", "chahiye", "bhejo", "hain", "hai",
    "beemar", "bimar", "peena", "peene", "khatam", "madad", "madat"
}


def detect_language(text: str) -> str:
    # Check for Devanagari block (\u0900-\u097F)
    if any("\u0900" <= ch <= "\u097F" for ch in text):
        return "hi"
    
    # Check for Hinglish keywords
    tokens = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
    if tokens & HINGLISH_WORDS:
        return "hinglish"
    
    return "en"


def draft_to_demand_dict(
    draft,
    *,
    source: str = "coordinator",
    verified: bool = True,
    client_uuid: Optional[str] = None,
    client_created_at: Optional[str] = None,
    items_map: Optional[Dict[str, Any]] = None,
    known_camp_ids: Optional[set] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Convert an extraction DemandDraft to an API Demand dictionary."""
    item_id = draft.item
    item_name = None
    default_unit = "unit"

    if item_id:
        if items_map and item_id in items_map:
            meta = items_map[item_id]
            item_name = meta.name if hasattr(meta, "name") else meta.get("name")
            default_unit = meta.unit if hasattr(meta, "unit") else meta.get("unit", "unit")
        else:
            item_name = item_id.title()

    unit = draft.unit or default_unit

    # Check camp_id validity against known camps
    camp_id = draft.camp_id
    needs_review = bool(draft.needs_review)

    if camp_id and known_camp_ids is not None:
        if camp_id not in known_camp_ids:
            # Unresolved camp
            camp_id = None
            needs_review = True

    # If public, unverified and always needs review
    if source == "public":
        verified = False
        needs_review = True

    # Urgency lowercase
    urgency = (draft.urgency or "medium").lower()

    lang = detect_language(draft.raw_text)

    return {
        "item": item_name,
        "item_id": item_id,
        "qty": draft.qty,
        "unit": unit,
        "location_text": draft.location_text,
        "camp_id": camp_id,
        "beneficiaries": draft.beneficiaries,
        "urgency": urgency,
        "confidence": draft.confidence,
        "provider": draft.provider,
        "needs_review": needs_review,
        "raw_text": draft.raw_text,
        "source": source,
        "verified": verified,
        "rejected": False,
        "kind": "demand",
        "language": lang,
        "duplicate_of": None,
        "report_count": 1,
        "client_uuid": client_uuid,
        "client_created_at": client_created_at,
        "lat": lat,
        "lng": lng,
        "phone": phone,
    }

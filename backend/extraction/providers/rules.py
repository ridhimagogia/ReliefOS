import re
import json
import os
from .base import ExtractionProvider, DemandDraft

# Aliases sorted longest-first within each item
ALIASES = {
    "water": [
        "drinking water", "water bottles", "water bottle", "peena ka pani",
        "peene ka pani", "paani", "peena", "pani", "water", "पानी", "जल"
    ],
    "food": [
        "food packets", "food packet", "food kits", "food kit",
        "khana", "khaana", "ration", "packet", "food", "खाना", "राशन"
    ],
    "tent": [
        "waterproof tents", "waterproof tent", "tents", "tabu", "tambu", "tent", "टेंट", "तंबू"
    ],
    "blanket": [
        "blankets", "blanket", "kambal", "razai", "कंबल", "रजाई"
    ],
    "medkit": [
        "medical kits", "medical kit", "medicine", "medkit", "medical",
        "dawai", "dawa", "ors", "beemar", "bimar", "दवा", "दवाई", "बीमार"
    ],
}

DEFAULT_UNITS = {
    "water": "litre",
    "food": "packet",
    "tent": "unit",
    "blanket": "unit",
    "medkit": "kit",
}

URGENCY_MAP = {
    "critical": ["critical", "bahut urgent", "emergency", "sos", "bilkul khatam"],
    "high":     ["urgently", "urgent", "turant", "jaldi", "asap", "immediately"],
    "low":      ["later", "baad mein", "low"],
}


class RulesProvider(ExtractionProvider):
    def available(self):
        return True

    def extract(self, text: str) -> DemandDraft:
        t = text.lower().strip()
        draft = DemandDraft(raw_text=text, provider="rules")

        # Camp extraction (e.g. camp 17)
        camp = re.search(r"\bcamp\s*(\d+)\b", t, re.I)
        if camp:
            draft.camp_id = f"camp{camp.group(1)}"
            draft.location_text = camp.group(0)
        
        # Remove camp reference from search text so camp number is not picked up as qty
        search_text = re.sub(r"\bcamp\s*\d+\b", "", t, flags=re.I).strip()

        # Find beneficiaries first: e.g. "600 people", "300 log", "800 persons", "100 families"
        # Also handle "approx 600 people", "about 600 people"
        b_match = re.search(
            r"(?:approx\s*|about\s*|around\s*)?(\d+)\s*(?:log|people|persons|families|person|family)\b",
            search_text,
            re.I
        )
        b_span = b_match.span() if b_match else None
        if b_match:
            draft.beneficiaries = int(b_match.group(1))

        # Item alias matching: find all matches with word boundaries and pick the longest match
        best_match = None  # (length, item_id, alias, start, end)
        for item_id, aliases in ALIASES.items():
            for alias in aliases:
                # Use word boundaries; for non-ascii / Devanagari regex \b may not work, so use pattern:
                pattern = r"(?<!\w)" + re.escape(alias) + r"(?!\w)"
                for m in re.finditer(pattern, search_text, re.I):
                    m_len = len(alias)
                    if best_match is None or m_len > best_match[0]:
                        best_match = (m_len, item_id, alias, m.start(), m.end())

        if best_match:
            _, item_id, matched_alias, item_start, item_end = best_match
            draft.item = item_id

            # Quantity extraction:
            # 1. Look for a number adjacent to the matched item alias
            # Look immediately before or after the item
            before_text = search_text[:item_start].rstrip()
            after_text = search_text[item_end:].lstrip()

            num_before = re.search(r"(\d+)\s*$", before_text)
            num_after = re.search(r"^(\d+)", after_text)

            chosen_qty = None
            if num_before:
                val = float(num_before.group(1))
                # Check if this number is part of the beneficiaries span
                num_start = before_text.rfind(num_before.group(1))
                if not (b_span and b_span[0] <= num_start < b_span[1]):
                    # Make sure not followed immediately before by "camp" or part of something else
                    chosen_qty = val
            elif num_after:
                val = float(num_after.group(1))
                # Check if this number is part of the beneficiaries span
                num_offset = item_end + (len(search_text[item_end:]) - len(after_text))
                if not (b_span and b_span[0] <= num_offset < b_span[1]):
                    chosen_qty = val

            # If no adjacent number found, check if there's any number in search_text that isn't beneficiaries
            if chosen_qty is None:
                for num_m in re.finditer(r"\b(\d+)\b", search_text):
                    if b_span and b_span[0] <= num_m.start() < b_span[1]:
                        continue
                    chosen_qty = float(num_m.group(1))
                    break

            if chosen_qty is not None:
                draft.qty = chosen_qty

        # Assign default unit from item
        if draft.item and draft.item in DEFAULT_UNITS:
            draft.unit = DEFAULT_UNITS[draft.item]

        # Urgency detection
        draft.urgency = "medium"
        for level, keywords in URGENCY_MAP.items():
            if any(re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", t, re.I) for k in keywords):
                draft.urgency = level
                break

        # Urgency promotion rule:
        # If item in {water, medkit} AND urgency keyword present (high or critical) AND beneficiaries >= 500 -> critical
        has_urgency_keyword = any(
            re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", t, re.I)
            for k in (URGENCY_MAP["critical"] + URGENCY_MAP["high"])
        )
        if draft.item in {"water", "medkit"} and has_urgency_keyword and draft.beneficiaries and draft.beneficiaries >= 500:
            draft.urgency = "critical"

        # Confidence:
        # Rules provider confidence is capped at 0.65 so offline records always land in review
        filled = sum([
            draft.item is not None,
            draft.qty is not None or draft.beneficiaries is not None,
            draft.camp_id is not None,
        ])
        raw_conf = round(filled / 3, 2)
        draft.confidence = min(raw_conf, 0.65)
        draft.needs_review = True

        return draft

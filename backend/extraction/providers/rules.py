
import json
import re
from pathlib import Path

from .base import ExtractionProvider, DemandDraft

DICTIONARY = Path(__file__).resolve().parents[1] / "dictionary"

with open(DICTIONARY / "items.json", encoding="utf-8") as f:
    ITEMS = json.load(f)

with open(DICTIONARY / "units.json", encoding="utf-8") as f:
    UNITS = json.load(f)

ALIASES = {
    item_id: data.get("aliases", [item_id])
    for item_id, data in ITEMS.items()
}

URGENCY_MAP = {
    "critical": ["critical", "emergency", "sos", "आपातकाल", "गंभीर"],
    "high": ["urgently", "urgent", "turant", "jaldi", "asap", "तुरंत", "जल्दी"],
    "low": ["later", "baad mein", "low", "बाद में"],
}

PEOPLE = [
    "people", "persons", "families", "log", "logon",
    "लोग", "लोगों", "परिवार", "व्यक्ति"
]

SUPPLY_WORDS = ["warehouse", "stock", "available", "supply", "free", "godown"]


def matches(text, phrase):
    pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
    return re.search(pattern, text, re.IGNORECASE)


class RulesProvider(ExtractionProvider):

    def available(self):
        return True

    def extract(self, text: str) -> DemandDraft:
        t = text.lower().strip()
        draft = DemandDraft(raw_text=text, provider="rules")

        # Camp detection
        camp = re.search(r"\bcamp\s*(\d+)\b", t, re.IGNORECASE)
        if camp:
            draft.camp_id = f"camp{camp.group(1)}"
            draft.location_text = camp.group(0)

        # Remove camp number before quantity extraction
        cleaned = re.sub(r"\bcamp\s*\d+\b", " ", t, flags=re.IGNORECASE)

        # Beneficiary detection
        beneficiary_pattern = (
            r"\b(\d+)\s+(?:" + "|".join(map(re.escape, PEOPLE)) + r")\b"
        )
        beneficiary = re.search(beneficiary_pattern, cleaned, re.IGNORECASE)

        if beneficiary:
            draft.beneficiaries = int(beneficiary.group(1))
            cleaned = (
                cleaned[:beneficiary.start()]
                + " "
                + cleaned[beneficiary.end():]
            )

        # Extract multiple items
        extracted = []

        for item_id, aliases in ALIASES.items():
            if item_id not in ITEMS:
                continue

            found = []

            for alias in sorted(aliases, key=len, reverse=True):
                match = matches(cleaned, alias)
                if match:
                    found.append(match)

            if not found:
                continue

            match = min(found, key=lambda m: m.start())
            before = cleaned[:match.start()]
            after = cleaned[match.end():]

            number = re.search(r"(\d+(?:\.\d+)?)\s*$", before)

            if not number:
                number = re.match(r"\s*(\d+(?:\.\d+)?)", after)

            qty = float(number.group(1)) if number else None

            # Validate unit against units.json
            unit = ITEMS[item_id].get("unit")
            if unit not in UNITS:
                unit = None

            extracted.append({
                "item": item_id,
                "qty": qty,
                "unit": unit,
            })

        # Preserve legacy primary-item fields
        if extracted:
            draft.item = extracted[0]["item"]
            draft.qty = extracted[0]["qty"]
            draft.unit = extracted[0]["unit"]

        draft.items = extracted

        # Urgency
        draft.urgency = "medium"

        for level, keywords in URGENCY_MAP.items():
            if any(matches(t, word) for word in keywords):
                draft.urgency = level
                break

        # Critical urgency upgrade
        if (
            draft.item in {"water", "medkit"}
            and draft.urgency == "high"
            and draft.beneficiaries
            and draft.beneficiaries >= 500
        ):
            draft.urgency = "critical"

        # Supply detection
        if any(matches(t, word) for word in SUPPLY_WORDS):
            draft.kind = "supply"
            draft.source = "warehouse"

        # Confidence capped at 0.65
        fields_found = sum([
            bool(extracted),
            draft.qty is not None or draft.beneficiaries is not None,
            draft.camp_id is not None,
        ])

        draft.confidence = round(min(fields_found / 3, 0.65), 2)
        draft.needs_review = True

        return draft

import re, json, os
from .base import ExtractionProvider, DemandDraft

ALIASES = {
    "water":   ["water bottles", "peena", "paani", "pani", "water"],
    "food":    ["food packets", "khana", "khaana", "packet", "food"],
    "tent":    ["tents", "tabu", "tent"],
    "blanket": ["blankets", "kambal", "razai", "blanket"],
    "medkit":  ["medical kits", "medicine", "medkit", "medical", "dawai", "dawa", "ors"],
}

URGENCY_MAP = {
    "critical": ["critical", "bahut urgent", "emergency", "sos"],
    "high":     ["urgently", "urgent", "turant", "jaldi", "asap"],
    "low":      ["later", "baad mein", "low"],
}

class RulesProvider(ExtractionProvider):
    def available(self):
        return True

    def extract(self, text: str) -> DemandDraft:
        t = text.lower().strip()
        draft = DemandDraft(raw_text=text, provider="rules")

        # camp id — extract and then blank it out so camp number
        # does not get picked up as a quantity
        camp = re.search(r"\bcamp\s*(\d+)\b", t, re.I)
        if camp:
            draft.camp_id = f"camp{camp.group(1)}"
            draft.location_text = camp.group(0)
        # remove camp reference from search text
        search_text = re.sub(r"\bcamp\s*\d+\b", "", t, flags=re.I).strip()

        # item + qty
        for item_id, aliases in ALIASES.items():
            for alias in aliases:  # already sorted longest-first
                m = re.search(
                    r"(\d+)\s+" + re.escape(alias) +
                    r"|" + re.escape(alias) + r"\s+(\d+)",
                    search_text
                )
                if m:
                    draft.item = item_id
                    draft.qty = float(m.group(1) or m.group(2))
                    break
            if draft.item:
                break

        # beneficiaries
        b = re.search(r"(\d+)\s*(log|people|persons|families)", search_text)
        if b:
            draft.beneficiaries = int(b.group(1))

        # urgency
        draft.urgency = "medium"
        for level, keywords in URGENCY_MAP.items():
            if any(k in t for k in keywords):
                draft.urgency = level
                break

        # confidence
        filled = sum([
            draft.item is not None,
            draft.qty is not None,
            draft.camp_id is not None,
        ])
        draft.confidence = round(filled / 3, 2)
        draft.needs_review = draft.confidence < 1.0
        return draft

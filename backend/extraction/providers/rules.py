import re
from .base import ExtractionProvider, DemandDraft
_RAW_ALIASES = {
    "water":   ["water bottles","drinking water","peena","paani","pani","water"],
    "food":    ["food packets","food packet","khaana","khana","packet","food"],
    "tent":    ["tents","tabu","tent"],
    "blanket": ["blankets","kambal","razai","blanket"],
    "medkit":  ["medical kits","medical kit","medicine","medkit","medical","dawai","dawa","ors","beemar"],
}
ALIASES = {k: sorted(v, key=len, reverse=True) for k, v in _RAW_ALIASES.items()}
URGENCY_MAP = {"critical":["critical","bahut urgent","emergency","sos"],"high":["urgently","urgent","turant","jaldi","asap"],"low":["later","baad mein","low"]}
ITEM_UNITS = {"water":"litres","food":"packets","tent":"units","blanket":"units","medkit":"kits"}
_CRITICAL_UPGRADE_ITEMS = {"water","medkit"}
_CRITICAL_BENEF_THRESHOLD = 500
_PEOPLE = r"(?:log|people|persons|families)"
class RulesProvider(ExtractionProvider):
    def available(self): return True
    def extract(self, text):
        import re as _re
        t = text.lower().strip()
        from .base import DemandDraft as DD
        draft = DD(raw_text=text, provider="rules")
        camp = _re.search(r"\bcamp\s*(\d+)\b", t, _re.I)
        if camp:
            draft.camp_id = f"camp{camp.group(1)}"
            draft.location_text = camp.group(0)
        st = _re.sub(r"\bcamp\s*\d+\b", "", t, flags=_re.I).strip()
        b = _re.search(r"\b(?:approx\.?\s+)?(\d+)\s+" + _PEOPLE + r"\b", st)
        if b: draft.beneficiaries = int(b.group(1))
        best = 0
        for iid, als in ALIASES.items():
            for a in als:
                if len(a) <= best: break
                if _re.search(r"\b" + _re.escape(a) + r"\b", st):
                    draft.item = iid; best = len(a); break
        qt = _re.sub(r"\b(?:approx\.?\s+)?\d+\s+" + _PEOPLE + r"\b", "", st)
        m = _re.search(r"\b(\d+)\b", qt)
        if m: draft.qty = float(m.group(1))
        if draft.item: draft.unit = ITEM_UNITS.get(draft.item)
        draft.urgency = "medium"
        for lvl, kws in URGENCY_MAP.items():
            if any(k in t for k in kws): draft.urgency = lvl; break
        if draft.item in _CRITICAL_UPGRADE_ITEMS and draft.urgency == "high" and draft.beneficiaries and draft.beneficiaries >= _CRITICAL_BENEF_THRESHOLD:
            draft.urgency = "critical"
        f = sum([draft.item is not None, draft.qty is not None or draft.beneficiaries is not None, draft.camp_id is not None])
        draft.confidence = round(min(f/3, 0.65), 2); draft.needs_review = True
        return draft

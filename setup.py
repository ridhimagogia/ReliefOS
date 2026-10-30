"""
ReliefOS setup script — run from the repo root (ReliefOS/).
Does A-02 (frontend swap) + writes fixed rules.py + test_extraction.py.
Usage:  python setup.py
"""
import os, re, sys, json, shutil, zipfile, pathlib, textwrap

ROOT = pathlib.Path(__file__).parent
FE   = ROOT / "frontend"
SRC  = FE / "src"

# ── helpers ───────────────────────────────────────────────────────────────────
def write(path, content):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")
    print(f"  WROTE  {p.relative_to(ROOT)}")

def patch_tsconfig():
    ts = FE / "tsconfig.json"
    if not ts.exists():
        print("  SKIP tsconfig.json (not found)"); return
    txt = ts.read_text(encoding="utf-8")
    if "ES2021" in txt:
        print("  OK     tsconfig.json already has ES2021"); return
    txt = re.sub(r'"lib"\s*:\s*\[[^\]]*\]',
                 '"lib": ["ES2021","DOM","DOM.Iterable"]', txt)
    if '"lib"' not in txt:            # no existing key — inject after "target"
        txt = re.sub(r'("target"\s*:\s*"[^"]+"),',
                     r'\1,"lib":["ES2021","DOM","DOM.Iterable"],', txt)
    ts.write_text(txt, encoding="utf-8")
    print("  PATCHED tsconfig.json (added ES2021 lib)")

def extract_zip():
    # look for the zip on Desktop or Downloads
    candidates = [
        pathlib.Path.home() / "OneDrive" / "Desktop" / "ReliefOS_Frontend_Export.zip",
        pathlib.Path.home() / "Desktop" / "ReliefOS_Frontend_Export.zip",
        pathlib.Path.home() / "Downloads" / "ReliefOS_Frontend_Export.zip",
    ]
    zpath = next((p for p in candidates if p.exists()), None)
    if zpath is None:
        print("  SKIP  zip not found on Desktop/Downloads — skipping frontend src swap")
        print("        Save ReliefOS_Frontend_Export.zip to your Desktop and re-run.")
        return False
    print(f"  ZIP   {zpath}")
    tmp = ROOT / "_fe_extract"
    if tmp.exists(): shutil.rmtree(tmp)
    with zipfile.ZipFile(zpath) as zf:
        for entry in zf.infolist():
            rel = entry.filename.replace("\\", "/")
            dest = tmp / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not rel.endswith("/"):
                dest.write_bytes(zf.read(entry.filename))
    REPLACE = [
        "src/App.tsx", "src/components/ReliefMap.tsx",
        "src/components/PublicReport.tsx", "src/types.ts",
        "src/services/api.ts", "src/offline/reportQueue.ts",
        "src/data/mockData.ts", "src/index.css",
        "vite.config.ts", "tsconfig.json", ".env.example",
        "public/basemap/punjab_districts.geojson",
    ]
    for rel in REPLACE:
        s = tmp / rel;  d = FE / rel
        if s.exists():
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, d)
            print(f"  REPLACED {rel}")
        else:
            print(f"  SKIP (not in zip): {rel}")
    shutil.rmtree(tmp)
    return True

# ── 1. Write fixed rules.py ───────────────────────────────────────────────────
print("\n[1] Writing backend/extraction/providers/rules.py ...")
write(ROOT / "backend/extraction/providers/rules.py", r'''
import re
from .base import ExtractionProvider, DemandDraft

_RAW_ALIASES = {
    "water":   ["water bottles", "drinking water", "peena", "paani", "pani",
                "पानी", "water"],
    "food":    ["food packets", "food packet", "khaana", "khana", "packet",
                "खाना", "food"],
    "tent":    ["tents", "tabu", "टेंट", "tent"],
    "blanket": ["blankets", "kambal", "razai", "कंबल", "blanket"],
    "medkit":  ["medical kits", "medical kit", "medicine", "medkit", "medical",
                "dawai", "dawa", "ors", "दवा", "beemar"],
}
ALIASES = {k: sorted(v, key=len, reverse=True) for k, v in _RAW_ALIASES.items()}

URGENCY_MAP = {
    "critical": ["critical", "bahut urgent", "emergency", "sos"],
    "high":     ["urgently", "urgent", "turant", "jaldi", "asap"],
    "low":      ["later", "baad mein", "low"],
}

ITEM_UNITS = {
    "water": "litres", "food": "packets",
    "tent": "units", "blanket": "units", "medkit": "kits",
}

_CRITICAL_UPGRADE_ITEMS   = {"water", "medkit"}
_CRITICAL_BENEF_THRESHOLD = 500
_PEOPLE = r"(?:log|people|persons|families)"


class RulesProvider(ExtractionProvider):
    def available(self) -> bool:
        return True

    def extract(self, text: str) -> DemandDraft:
        t = text.lower().strip()
        draft = DemandDraft(raw_text=text, provider="rules")

        # 1. Camp id — blank out so the number is never mistaken for qty
        camp = re.search(r"\bcamp\s*(\d+)\b", t, re.I)
        if camp:
            draft.camp_id = f"camp{camp.group(1)}"
            draft.location_text = camp.group(0)
        search_text = re.sub(r"\bcamp\s*\d+\b", "", t, flags=re.I).strip()

        # 2. Beneficiaries — "approx 600 people", "300 log", etc.
        b = re.search(r"\b(?:approx\.?\s+)?(\d+)\s+" + _PEOPLE + r"\b", search_text)
        if b:
            draft.beneficiaries = int(b.group(1))

        # 3. Item — \b on both sides; longest alias across all items wins
        best_len = 0
        for item_id, aliases in ALIASES.items():
            for alias in aliases:
                if len(alias) <= best_len:
                    break
                if re.search(r"\b" + re.escape(alias) + r"\b", search_text):
                    draft.item = item_id
                    best_len = len(alias)
                    break

        # 4. Qty — first number NOT part of a beneficiary phrase
        qty_text = re.sub(r"\b(?:approx\.?\s+)?\d+\s+" + _PEOPLE + r"\b", "", search_text)
        qty_m = re.search(r"\b(\d+)\b", qty_text)
        if qty_m:
            draft.qty = float(qty_m.group(1))

        # 5. Default unit
        if draft.item:
            draft.unit = ITEM_UNITS.get(draft.item)

        # 6. Urgency
        draft.urgency = "medium"
        for level, keywords in URGENCY_MAP.items():
            if any(k in t for k in keywords):
                draft.urgency = level
                break
        # Upgrade rule: water/medkit + high + beneficiaries >= 500 -> critical
        if (draft.item in _CRITICAL_UPGRADE_ITEMS
                and draft.urgency == "high"
                and draft.beneficiaries is not None
                and draft.beneficiaries >= _CRITICAL_BENEF_THRESHOLD):
            draft.urgency = "critical"

        # 7. Confidence capped at 0.65 — rules always go to human review
        filled = sum([
            draft.item is not None,
            (draft.qty is not None or draft.beneficiaries is not None),
            draft.camp_id is not None,
        ])
        draft.confidence = round(min(filled / 3, 0.65), 2)
        draft.needs_review = True
        return draft
''')

# ── 2. Write updated test_extraction.py ──────────────────────────────────────
print("\n[2] Writing backend/tests/test_extraction.py ...")
write(ROOT / "backend/tests/test_extraction.py", r'''
import os, pytest
os.environ["OFFLINE_MODE"] = "1"

from backend.extraction.chain import extract
from backend.extraction.providers.rules import RulesProvider

CASES = [
    ("Camp 17 needs 600 water urgently",        "water",   600,  "camp17", "high"),
    ("camp 4 ko 200 kambal chahiye",            "blanket", 200,  "camp4",  "medium"),
    ("Camp 9 needs 75 blankets emergency",      "blanket",  75,  "camp9",  "critical"),
    ("300 food packets for camp 12",            "food",    300,  "camp12", "medium"),
    ("Camp 8 medical kits 150 urgent",          "medkit",  150,  "camp8",  "high"),
    ("paani 500 camp 3",                        "water",   500,  "camp3",  "medium"),
    ("Camp 21 dawai 100 jaldi",                 "medkit",  100,  "camp21", "high"),
    ("tent 50 camp 6 critical",                 "tent",     50,  "camp6",  "critical"),
    ("Camp 2 needs 400 pani for 800 people",    "water",   400,  "camp2",  "medium"),
    ("khana 1000 camp 15 turant",               "food",   1000,  "camp15", "high"),
]

@pytest.mark.parametrize("text,item,qty,camp,urgency", CASES)
def test_rules_extraction(text, item, qty, camp, urgency):
    r = RulesProvider().extract(text)
    assert r.item == item,       f"item: {r.item!r} != {item!r} | {text}"
    assert r.qty == qty,         f"qty: {r.qty} != {qty} | {text}"
    assert r.camp_id == camp,    f"camp: {r.camp_id!r} != {camp!r} | {text}"
    assert r.urgency == urgency, f"urgency: {r.urgency!r} != {urgency!r} | {text}"

def test_drinking_water_for_600_people():
    r = RulesProvider().extract(
        "Camp 17 needs drinking water for approx 600 people, urgent")
    assert r.item == "water"
    assert r.qty is None
    assert r.beneficiaries == 600
    assert r.camp_id == "camp17"
    assert r.urgency == "critical"   # water + high + 600 >= 500 -> critical

def test_waterproof_tents_not_water():
    r = RulesProvider().extract(
        "Camp 4 needs 200 waterproof tents immediately for newly displaced families")
    assert r.item == "tent",  f"got {r.item!r} — waterproof should NOT match water"
    assert r.qty == 200

def test_hinglish_beemar_medkit():
    r = RulesProvider().extract(
        "Camp 8 ke paas log beemar hain please medical kits bhejo turant")
    assert r.item == "medkit"
    assert r.camp_id == "camp8"
    assert r.urgency == "high"

def test_paani_khatam_beneficiaries():
    r = RulesProvider().extract(
        "Camp 21 paani bilkul khatam ho chuka hai 300 log hain urgent")
    assert r.item == "water"
    assert r.beneficiaries == 300
    assert r.qty is None
    assert r.urgency == "high"   # 300 < 500 -> no upgrade

def test_pani_600_log_not_qty():
    r = RulesProvider().extract("pani 600 log camp 17")
    assert r.item == "water"
    assert r.qty is None
    assert r.beneficiaries == 600
    assert r.camp_id == "camp17"

def test_rules_always_needs_review():
    r = RulesProvider().extract("Camp 17 needs 600 water urgently")
    assert r.needs_review is True
    assert r.confidence <= 0.65

def test_chain_offline():
    os.environ["OFFLINE_MODE"] = "1"
    r = extract("Camp 5 needs 300 water urgently")
    assert r.provider in ("rules", "gemini_failed")
    assert r.item == "water"
''')

# ── 3. Patch tsconfig.json ────────────────────────────────────────────────────
print("\n[3] Patching frontend/tsconfig.json ...")
patch_tsconfig()

# ── 4. Extract frontend zip ───────────────────────────────────────────────────
print("\n[4] Swapping frontend src files (A-02) ...")
ok = extract_zip()

# ── 5. Patch tsconfig AGAIN if zip replaced it ───────────────────────────────
if ok:
    print("\n[5] Re-patching tsconfig.json after zip replacement ...")
    patch_tsconfig()
    # move pnpm-lock to _to_delete
    pnpm = FE / "pnpm-lock.yaml"
    if pnpm.exists():
        d = FE / "_to_delete"
        d.mkdir(exist_ok=True)
        shutil.move(str(pnpm), str(d / "pnpm-lock.yaml"))
        print("  MOVED  pnpm-lock.yaml -> frontend/_to_delete/")
    # patch .gitignore
    gi = FE / ".gitignore"
    if gi.exists():
        txt = gi.read_text(encoding="utf-8")
        if "!.env.example" not in txt:
            gi.write_text(txt + "\n!.env.example\n", encoding="utf-8")
            print("  PATCHED .gitignore")

print("\nDone! Now run:")
print("  python -m pytest backend/tests/ -q")
print("  cd frontend && npm install && npx tsc --noEmit && npm run build && cd ..")

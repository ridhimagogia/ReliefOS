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
    ("Camp 17 needs drinking water for approx 600 people, urgent", "water", None, "camp17", "critical"),
    ("Camp 4 needs 200 waterproof tents immediately for newly displaced families", "tent", 200, "camp4", "high"),
    ("Camp 8 ke paas log beemar hain please medical kits bhejo turant", "medkit", None, "camp8", "high"),
    ("Camp 21 paani bilkul khatam ho chuka hai 300 log hain urgent", "water", None, "camp21", "critical"),
    ("pani 600 log camp 17",                    "water",   None, "camp17", "medium"),
]

@pytest.mark.parametrize("text,item,qty,camp,urgency", CASES)
def test_rules_extraction(text, item, qty, camp, urgency):
    r = RulesProvider().extract(text)
    assert r.item == item,    f"item mismatch: {r.item!r} != {item!r} for: {text}"
    assert r.qty == qty,      f"qty mismatch: {r.qty} != {qty} for: {text}"
    assert r.camp_id == camp, f"camp mismatch: {r.camp_id!r} != {camp!r} for: {text}"
    assert r.urgency == urgency, f"urgency mismatch for: {text}"

def test_chain_offline():
    os.environ["OFFLINE_MODE"] = "1"
    r = extract("Camp 5 needs 300 water urgently")
    assert r.provider in ("rules", "gemini_failed")
    assert r.item == "water"

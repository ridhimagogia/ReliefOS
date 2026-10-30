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
    assert r.item == item,    f"item mismatch: {r.item!r} != {item!r} for: {text}"
    assert r.qty == qty,      f"qty mismatch: {r.qty} != {qty} for: {text}"
    assert r.camp_id == camp, f"camp mismatch: {r.camp_id!r} != {camp!r} for: {text}"
    assert r.urgency == urgency, f"urgency mismatch for: {text}"

def test_chain_offline():
    os.environ["OFFLINE_MODE"] = "1"
    r = extract("Camp 5 needs 300 water urgently")
    assert r.provider in ("rules", "gemini_failed")
    assert r.item == "water"

def test_gemini_rejects_unknown_item(monkeypatch):
    import sys
    import types
    import json
    from backend.extraction.providers.gemini import GeminiProvider

    fake_response = types.SimpleNamespace(
        text=json.dumps({
            "item": "helicopter",
            "qty": 10,
            "camp_id": "camp17",
            "urgency": "high",
            "confidence": 0.9,
            "needs_review": False
        })
    )

    class FakeModels:
        def generate_content(self, **kwargs):
            return fake_response

    class FakeClient:
        models = FakeModels()

    google = types.ModuleType("google")
    genai = types.ModuleType("google.genai")
    genai_types = types.ModuleType("google.genai.types")

    genai.Client = lambda: FakeClient()
    genai_types.GenerateContentConfig = lambda **kwargs: kwargs
    genai_types.HttpOptions = lambda **kwargs: kwargs
    genai.types = genai_types
    google.genai = genai

    monkeypatch.setitem(sys.modules, "google", google)
    monkeypatch.setitem(sys.modules, "google.genai", genai)
    monkeypatch.setitem(sys.modules, "google.genai.types", genai_types)

    result = GeminiProvider().extract("Camp 17 needs helicopters")

    assert result.item is None
    assert result.needs_review is True

import pytest

from backend.extraction.providers.rules import RulesProvider


SEED_MESSAGES = [
    # English
    ("Camp 17 needs 250 drinking water urgently", "water", 250, "camp17", "high"),
    ("Camp 8 requires 100 food packets emergency", "food", 100, "camp8", "critical"),
    ("50 tents for camp 6 critical", "tent", 50, "camp6", "critical"),
    ("Camp 12 needs 75 medical kits urgently", "medkit", 75, "camp12", "high"),
    ("Camp 3 needs 200 blankets", "blanket", 200, "camp3", "medium"),

    # Hinglish
    ("camp 9 ko 120 kambal chahiye", "blanket", 120, "camp9", "medium"),
    ("camp 4 mein 300 paani urgent", "water", 300, "camp4", "high"),
    ("camp 15 ko 80 dawai turant", "medkit", 80, "camp15", "high"),
    ("camp 2 ke liye 150 khana chahiye", "food", 150, "camp2", "medium"),
    ("camp 7 ko 40 tent emergency", "tent", 40, "camp7", "critical"),
]


@pytest.mark.parametrize("text,item,qty,camp,urgency", SEED_MESSAGES)
def test_seed_message_extraction(text, item, qty, camp, urgency, monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "1")

    result = RulesProvider().extract(text)

    assert result.item == item, f"Wrong item for: {text}"
    assert result.qty == qty, f"Wrong quantity for: {text}"
    assert result.camp_id == camp, f"Wrong camp for: {text}"
    assert result.urgency == urgency, f"Wrong urgency for: {text}"


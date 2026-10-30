import pytest

from backend.extraction.providers.rules import RulesProvider, ITEMS, UNITS


@pytest.mark.parametrize(
    "keyword",
    ["warehouse", "stock", "available", "supply", "free", "godown"],
)
def test_supply_keyword_detection(keyword):
    text = f"500 water {keyword} at camp 17"

    result = RulesProvider().extract(text)

    assert result.kind == "supply"
    assert result.source == "warehouse"
    assert result.item == "water"
    assert result.qty == 500
    assert result.camp_id == "camp17"


def test_supply_item_has_valid_unit():
    result = RulesProvider().extract("500 water available at camp 17")

    assert result.unit == ITEMS["water"]["unit"]
    assert result.unit in UNITS


def test_multiple_supply_items_are_extracted():
    result = RulesProvider().extract(
        "warehouse 500 water and 200 blankets at camp 17"
    )

    extracted = {item["item"]: item for item in result.items}

    assert result.kind == "supply"
    assert result.source == "warehouse"
    assert extracted["water"]["qty"] == 500
    assert extracted["blanket"]["qty"] == 200

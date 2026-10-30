
from datetime import datetime, timedelta, timezone

from backend.extraction.dedupe import (
    find_parent,
    apply_duplicate,
    draft_to_demand,
)
from backend.extraction.providers.base import DemandDraft


NOW = datetime.now(timezone.utc)


def make_demand(**overrides):
    demand = {
        "id": "d1",
        "item": "water",
        "qty": 100,
        "camp_id": "camp17",
        "urgency": "medium",
        "created_at": NOW.isoformat(),
        "report_count": 1,
    }
    demand.update(overrides)
    return demand


def test_find_parent_matches_same_item_camp_and_quantity():
    parent = make_demand()
    incoming = make_demand(id="d2", qty=110)

    assert find_parent(incoming, [parent], NOW) is parent


def test_find_parent_rejects_different_item_or_camp():
    parent = make_demand()

    assert find_parent(
        make_demand(id="d2", item="food"), [parent], NOW
    ) is None

    assert find_parent(
        make_demand(id="d2", camp_id="camp9"), [parent], NOW
    ) is None


def test_find_parent_rejects_quantity_difference_over_20_percent():
    parent = make_demand(qty=100)
    incoming = make_demand(id="d2", qty=130)

    assert find_parent(incoming, [parent], NOW) is None


def test_find_parent_rejects_reports_older_than_six_hours():
    parent = make_demand(
        created_at=(NOW - timedelta(hours=7)).isoformat()
    )

    assert find_parent(make_demand(id="d2"), [parent], NOW) is None


def test_find_parent_accepts_report_within_six_hours():
    parent = make_demand(
        created_at=(NOW - timedelta(hours=5)).isoformat()
    )

    assert find_parent(make_demand(id="d2"), [parent], NOW) is parent


def test_apply_duplicate_updates_parent():
    parent = make_demand()
    incoming = make_demand(id="d2", urgency="critical")

    apply_duplicate(incoming, parent)

    assert parent["report_count"] == 2
    assert parent["urgency"] == "critical"
    assert incoming["duplicate_of"] == "d1"


def test_draft_to_demand_preserves_language():
    draft = DemandDraft(language="hi", item="water")

    result = draft_to_demand(draft)

    assert result["language"] == "hi"


def test_public_draft_always_needs_review():
    draft = DemandDraft(needs_review=False)

    result = draft_to_demand(draft, source="public")

    assert result["needs_review"] is True

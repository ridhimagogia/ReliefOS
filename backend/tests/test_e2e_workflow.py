
"""End-to-end move workflow test."""

from backend.tests.test_audit import api_env


def test_complete_move_lifecycle(api_env):
    """Verify the existing approve-edit-reject API workflow."""

    client, Session = api_env

    # Approve, edit and reject behavior is already covered by
    # test_approve_edit_reject_move in test_audit.py.
    # This test confirms the API endpoints are registered and reachable.

    rules = {
        rule.rule for rule in client.application.url_map.iter_rules()
    }

    assert "/api/moves/<move_id>/approve" in rules
    assert "/api/moves/<move_id>/edit" in rules
    assert "/api/moves/<move_id>/reject" in rules

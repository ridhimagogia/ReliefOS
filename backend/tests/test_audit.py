
import pytest

from backend.app import create_app
from backend.models import init_db, Demand, Stock, Move


@pytest.fixture
def api_env(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'test_reliefos.db'}"

    app = create_app({
        "TESTING": True,
        "DATABASE_URL": db_url,
    })

    Session = init_db(db_url)
    db = Session()

    try:
        demand = Demand(
            id="test-demand-1",
            raw_text="Need 100 food packets",
            item_id="food",
            qty=100,
            fulfilled=0,
            urgency="high",
            source="coordinator",
        )

        stock = Stock(
            id="test-stock-1",
            location_id="test-depot",
            item_id="food",
            quantity=100,
            reserved=0,
        )

        move = Move(
            id="test-move-1",
            demand_id="test-demand-1",
            stock_id="test-stock-1",
            qty=30,
            item_id="food",
            state="pending",
        )

        db.add_all([demand, stock, move])
        db.commit()
    finally:
        db.close()

    yield app.test_client(), Session
    Session.remove()


def test_approve_edit_reject_move(api_env):
    client, Session = api_env

    # Approve
    response = client.post("/api/moves/test-move-1/approve")
    assert response.status_code == 200
    assert response.json["state"] == "approved"

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    demand = db.query(Demand).filter_by(id="test-demand-1").first()
    assert stock.reserved == 30
    assert demand.fulfilled == 30
    db.close()

    # Duplicate approval must not reserve twice
    response = client.post("/api/moves/test-move-1/approve")
    assert response.status_code == 200

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    assert stock.reserved == 30
    db.close()

    # Edit approved quantity from 30 to 40
    response = client.post(
        "/api/moves/test-move-1/edit",
        json={"qty": 40, "notes": "Increased food allocation"},
    )
    assert response.status_code == 200
    assert response.json["state"] == "approved"
    assert response.json["quantity"] == 40

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    demand = db.query(Demand).filter_by(id="test-demand-1").first()
    assert stock.reserved == 40
    assert demand.fulfilled == 40
    db.close()

    # Reject and release reservation
    response = client.post(
        "/api/moves/test-move-1/reject",
        json={"reason": "Transport unavailable"},
    )
    assert response.status_code == 200
    assert response.json["state"] == "rejected"

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    demand = db.query(Demand).filter_by(id="test-demand-1").first()
    assert stock.reserved == 0
    assert demand.fulfilled == 0
    db.close()

    # Duplicate rejection must not release twice
    response = client.post(
        "/api/moves/test-move-1/reject",
        json={"reason": "Duplicate rejection"},
    )
    assert response.status_code == 200

    # Check audit history
    response = client.get("/api/audit")
    assert response.status_code == 200

    actions = [
        entry["action"]
        for entry in response.json
        if entry["target_id"] == "test-move-1"
    ]

    assert actions.count("approved") == 1
    assert actions.count("edited") == 1
    assert actions.count("rejected") == 1


def test_reject_requires_reason(api_env):
    client, _ = api_env

    response = client.post(
        "/api/moves/test-move-1/reject",
        json={"reason": ""},
    )

    assert response.status_code == 400
    assert "reason" in response.json["error"].lower()


def test_approve_insufficient_stock(api_env):
    client, Session = api_env

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    stock.quantity = 20
    db.commit()
    db.close()

    response = client.post("/api/moves/test-move-1/approve")

    assert response.status_code == 400
    assert "Insufficient" in response.json["error"]

    db = Session()
    stock = db.query(Stock).filter_by(id="test-stock-1").first()
    demand = db.query(Demand).filter_by(id="test-demand-1").first()

    assert stock.reserved == 0
    assert demand.fulfilled == 0
    db.close()

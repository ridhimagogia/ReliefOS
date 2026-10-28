import pytest

from backend import routing

LUDHIANA = {"lat": 30.9010, "lng": 75.8573}
FEROZEPUR = {"lat": 30.9331, "lng": 74.6225}


def test_haversine_ludhiana_ferozepur():
    km = routing.haversine_km(30.9010, 75.8573, 30.9331, 74.6225)
    assert 110 < km < 125


def test_distance_contract_offline(no_network):
    r = routing.distance(LUDHIANA, FEROZEPUR)
    assert set(r) == {"km", "eta_h", "source"}
    assert r["source"] == "haversine"
    assert 140 < r["km"] < 165          # straight line x 1.3
    assert r["eta_h"] == pytest.approx(r["km"] / 40, abs=0.01)


def test_zero_and_symmetry():
    assert routing.distance(LUDHIANA, LUDHIANA)["km"] == 0
    assert routing.distance(LUDHIANA, FEROZEPUR)["km"] == routing.distance(FEROZEPUR, LUDHIANA)["km"]


def test_accepts_tuples_and_speed():
    r = routing.distance((30.9, 75.85), (30.93, 74.62), speed_kmph=60)
    assert r["eta_h"] == pytest.approx(r["km"] / 60, abs=0.01)


def test_offline_never_touches_public_osrm(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("urlopen must not be called offline")
    monkeypatch.setattr(routing.urllib.request, "urlopen", boom)
    assert routing.distance(LUDHIANA, FEROZEPUR)["source"] == "haversine"


def test_online_falls_back_to_haversine(monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "0")
    routing.clear_cache()

    def fail(*a, **k):
        raise OSError("down")
    monkeypatch.setattr(routing.urllib.request, "urlopen", fail)
    assert routing.distance(LUDHIANA, FEROZEPUR)["source"] == "haversine"

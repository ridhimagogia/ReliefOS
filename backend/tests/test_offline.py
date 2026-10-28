import json

from backend.matching.simulate import run_simulation
from backend.offline import join
from backend.offline.basemap import build_placeholder, validate_geojson


def test_basemap_placeholder_is_valid(tmp_path):
    p = build_placeholder(tmp_path / "punjab.geojson")
    ok, msg = validate_geojson(p)
    assert ok and "placeholder" in msg
    assert json.loads(p.read_text())["features"][0]["geometry"]["type"] == "Polygon"


def test_validate_rejects_bad_files(tmp_path):
    bad = tmp_path / "bad.geojson"
    bad.write_text("not json")
    assert validate_geojson(bad)[0] is False
    assert validate_geojson(tmp_path / "missing.geojson")[0] is False


def test_lan_ip_works_with_no_network(no_network):
    ip = join.lan_ip()
    assert isinstance(ip, str) and ip.count(".") == 3


def test_lan_ip_override(monkeypatch):
    monkeypatch.setenv("RELIEFOS_HOST_IP", "192.168.137.1")
    info = join.join_info(port=5000)
    assert info["url"] == "http://192.168.137.1:5000"


def test_simulation_reproducible_and_reliefos_not_worse_on_critical(no_network):
    a, b = run_simulation(42), run_simulation(42)
    assert a == b
    assert a["reliefos"]["critical_coverage_pct"] >= a["naive"]["critical_coverage_pct"]

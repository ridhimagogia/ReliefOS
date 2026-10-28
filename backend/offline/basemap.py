"""Offline basemap helpers.

`build_placeholder` writes a COARSE, hand-approximated Punjab outline plus real
town points so the map is never blank in airplane mode. It is a placeholder, not
survey-accurate. Replace it with a licence-checked district GeoJSON (keep the
same file name) before the pitch, and keep the file small (< ~1 MB).
"""
from __future__ import annotations

import json
from pathlib import Path

OUTLINE = [
    [73.88, 29.95], [74.40, 29.75], [75.20, 29.50], [76.00, 29.60], [76.55, 30.10],
    [76.85, 30.55], [76.70, 31.10], [76.10, 31.80], [75.60, 32.50], [75.00, 32.45],
    [74.60, 31.90], [74.50, 31.30], [74.20, 30.90], [73.88, 30.30], [73.88, 29.95],
]
TOWNS = {
    "Ludhiana": (30.9010, 75.8573), "Patiala": (30.3398, 76.3869), "Jalandhar": (31.3260, 75.5762),
    "Amritsar": (31.6340, 74.8723), "Bathinda": (30.2110, 74.9455), "Sangrur": (30.2458, 75.8421),
    "Moga": (30.8167, 75.1667), "Hoshiarpur": (31.5320, 75.9170), "Ferozepur": (30.9331, 74.6225),
    "Fazilka": (30.4036, 74.0286), "Tarn Taran": (31.4519, 74.9286), "Kapurthala": (31.3800, 75.3800),
    "Gurdaspur": (32.0414, 75.4031), "Mansa": (29.9988, 75.3937),
}
DEFAULT_PATH = Path(__file__).resolve().parents[2] / "frontend" / "public" / "basemap" / "punjab_districts.geojson"


def build_placeholder(path=DEFAULT_PATH) -> Path:
    features = [{
        "type": "Feature",
        "properties": {"name": "Punjab (coarse placeholder outline)", "placeholder": True},
        "geometry": {"type": "Polygon", "coordinates": [OUTLINE]},
    }]
    for name, (lat, lng) in TOWNS.items():
        features.append({"type": "Feature", "properties": {"name": name, "kind": "town"},
                         "geometry": {"type": "Point", "coordinates": [lng, lat]}})
    fc = {"type": "FeatureCollection",
          "note": "PLACEHOLDER: replace with licence-checked district boundaries.",
          "features": features}
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(fc), encoding="utf-8")
    return p


def validate_geojson(path):
    """Return (ok, message)."""
    p = Path(path)
    if not p.exists():
        return False, f"missing: {p}"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return False, f"not valid JSON: {e}"
    if data.get("type") != "FeatureCollection" or not data.get("features"):
        return False, "must be a non-empty FeatureCollection"
    size_kb = p.stat().st_size / 1024
    note = " (placeholder outline)" if data.get("note", "").startswith("PLACEHOLDER") else ""
    warn = " [large: simplify it]" if size_kb > 1024 else ""
    return True, f"{len(data['features'])} features, {size_kb:.0f} KB{note}{warn}"

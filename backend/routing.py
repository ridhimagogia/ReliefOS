"""Distance contract for ReliefOS (owner: Person 4).

    distance(a, b) -> {"km": float, "eta_h": float, "source": "osrm" | "haversine"}

`a` and `b` can be dicts with lat/lng, (lat, lng) tuples, or objects with .lat/.lng.

Rules
-----
* OFFLINE_MODE=1  -> public OSRM is never contacted (no timeouts to wait for).
  A *local* OSRM is used only if OSRM_URL is set explicitly (for example
  http://localhost:5001 with a regional extract). Otherwise: haversine x 1.3.
* Online          -> OSRM (OSRM_URL, or the public demo server) with a 3 s timeout,
  then haversine x 1.3. After one failure OSRM is skipped for 60 s so the
  matcher does not pay a 3 s timeout for every pair.
* `source` is always returned so the UI can label straight-line estimates.
"""
from __future__ import annotations

import json
import math
import os
import time
import urllib.request

EARTH_RADIUS_KM = 6371.0088
ROAD_FACTOR = 1.3                 # straight-line -> rough road distance
DEFAULT_SPEED_KMPH = 40.0
OSRM_TIMEOUT_S = 3.0
OSRM_COOLDOWN_S = 60.0
PUBLIC_OSRM = "https://router.project-osrm.org"

_cache: dict = {}
_osrm_down_until = 0.0


def offline_mode() -> bool:
    return os.getenv("OFFLINE_MODE", "0") == "1"


def clear_cache() -> None:
    global _osrm_down_until
    _cache.clear()
    _osrm_down_until = 0.0


def _pt(p):
    if isinstance(p, dict):
        return float(p["lat"]), float(p["lng"])
    if isinstance(p, (tuple, list)):
        return float(p[0]), float(p[1])
    return float(p.lat), float(p.lng)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _osrm_base_url():
    url = os.getenv("OSRM_URL", "").strip()
    if url:
        return url.rstrip("/")
    return None if offline_mode() else PUBLIC_OSRM


def _osrm_route(la1, ln1, la2, ln2):
    """Return (km, hours) from OSRM or None on any failure."""
    global _osrm_down_until
    base = _osrm_base_url()
    if base is None or time.monotonic() < _osrm_down_until:
        return None
    url = f"{base}/route/v1/driving/{ln1},{la1};{ln2},{la2}?overview=false"
    try:
        with urllib.request.urlopen(url, timeout=OSRM_TIMEOUT_S) as resp:
            data = json.load(resp)
        route = data["routes"][0]
        return route["distance"] / 1000.0, route["duration"] / 3600.0
    except Exception:
        _osrm_down_until = time.monotonic() + OSRM_COOLDOWN_S
        return None


def distance(a, b, speed_kmph=None, use_osrm=True) -> dict:
    la1, ln1 = _pt(a)
    la2, ln2 = _pt(b)
    key = (round(la1, 5), round(ln1, 5), round(la2, 5), round(ln2, 5), bool(use_osrm))
    if key in _cache:
        km, hours, source = _cache[key]
    else:
        km = hours = None
        source = "haversine"
        if use_osrm:
            res = _osrm_route(la1, ln1, la2, ln2)
            if res:
                km, hours = res
                source = "osrm"
        if km is None:
            km = haversine_km(la1, ln1, la2, ln2) * ROAD_FACTOR
        _cache[key] = (km, hours, source)
    if speed_kmph:
        eta = km / speed_kmph
    elif hours is not None:
        eta = hours
    else:
        eta = km / DEFAULT_SPEED_KMPH
    return {"km": round(km, 2), "eta_h": round(eta, 2), "source": source}


from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/api/health")
def health():
    return {"status": "ok"}

@app.route("/api/public/report", methods=["POST"])
def public_report():
    return {"status": "queued", "id": "stub-001"}

if __name__ == "__main__":
    app.run(debug=True, port=5000)

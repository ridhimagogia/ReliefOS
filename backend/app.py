
from __future__ import annotations

try:
    from extraction.dedupe import find_parent, apply_duplicate
except ImportError:
    from backend.extraction.dedupe import find_parent, apply_duplicate

"""
ReliefOS Flask API - backend/app.py
Run: python app.py (port 5000)
"""

import os
import uuid
import time
import re

from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


# ── In-memory store ──────────────────────────────────────────────

_demands: list[dict] = []
_moves: list[dict] = []
_stock: list[dict] = []
_audit: list[dict] = []

_rate: dict[str, list[float]] = {}  # IP -> timestamps
_sender_rep: dict[str, int] = {}    # sender_key -> reject_count


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())[:8]


def _log(action: str, target_id: str, detail: str = "") -> None:
    _audit.insert(0, {
        "id": _uid(),
        "action": action,
        "target_id": target_id,
        "detail": detail,
        "created_at": _now()
    })


# ── Extraction ───────────────────────────────────────────────────

def _extract(text: str) -> dict:
    try:
        from extraction.chain import extract

        d = extract(text)

        return {
            "item": d.item,
            "qty": d.qty,
            "unit": d.unit,
            "location_text": d.location_text,
            "camp_id": d.camp_id,
            "district": getattr(d, "district", None),
            "lat": getattr(d, "lat", None),
            "lng": getattr(d, "lng", None),
            "beneficiaries": getattr(d, "beneficiaries", None),
            "urgency": d.urgency or "medium",
            "confidence": d.confidence,
            "provider": d.provider,
            "language": getattr(d, "language", "en"),
        }

    except Exception:
        # Fallback parser if the extraction chain fails.

        text_l = text.lower()

        items = {
            "water": r"\bwater\b|\bpaani\b|\bpani\b",
            "food": r"\bfood\b|\bkhana\b|\bration\b",
            "blanket": r"\bblankets?\b|\bkambal\b",
            "tent": r"\btents?\b",
            "medicine": r"\bmedicines?\b|\bdawa\b"
        }

        item = next(
            (k for k, pattern in items.items()
             if re.search(pattern, text_l)),
            None
        )

        camp = re.search(r"camp\s*(\d+)", text_l)

        cleaned_text = text.replace(
            camp.group() if camp else "", ""
        )

        qty_match = re.search(r"(\d[\d,]*)", cleaned_text)

        qty = (
            int(qty_match.group(1).replace(",", ""))
            if qty_match else None
        )

        urgency = (
            "critical" if re.search(r"critical|emergency", text_l)
            else "high" if re.search(r"urgent|jaldi", text_l)
            else "medium"
        )

        return {
            "item": item,
            "qty": qty,
            "unit": None,
            "location_text": (
                f"Camp {camp.group(1)}" if camp else None
            ),
            "camp_id": (
                f"camp-{camp.group(1)}" if camp else None
            ),
            "district": None,
            "lat": None,
            "lng": None,
            "beneficiaries": None,
            "urgency": urgency,
            "confidence": 0.55,
            "provider": "rules",
            "language": "en",
        }


# ── Demand creation ──────────────────────────────────────────────
def _normalize_camp_id(camp_id):
    if not camp_id:
        return None

    import re
    match = re.search(r"camp[\s_-]*(\d+)", str(camp_id), re.IGNORECASE)

    if not match:
        return None

    return f"camp-{match.group(1)}"

def _verify_camp(camp_id):
    normalized_id = _normalize_camp_id(camp_id)

    if not normalized_id:
        return False

    known_camps = {
        camp["id"]
        for camp in [
            {"id": "camp-17"},
            {"id": "camp-22"},
            {"id": "camp-9"},
        ]
    }

    return normalized_id in known_camps


def _make_demand(
    parsed: dict,
    raw_text: str,
    source: str = "coordinator",
    verified: bool = True,
    channel: str = "text",
    sender_key: str | None = None
) -> dict:

    conf = parsed["confidence"]

    normalized_camp = _normalize_camp_id(parsed.get("camp_id"))
    camp_verified = _verify_camp(normalized_camp)

    needs_review = (
        conf < 0.8
        or source == "public"
        or not camp_verified
    )

    rep = _sender_rep.get(sender_key or "", 0)

    trust = max(
        0.1,
        min(1.0, 0.7 - rep * 0.15 + (0.2 if conf >= 0.65 else 0))
    )

    trust_reasons = []

    if not parsed.get("item"):
        trust_reasons.append("Unknown item")

    if not parsed.get("location_text"):
        trust_reasons.append("Unknown location")

    if not camp_verified:
        trust_reasons.append("Camp not verified")

    if rep:
        trust_reasons.append(
            f"Sender had {rep} rejected report{'s' if rep > 1 else ''}"
        )

    return {
        "id": _uid(),
        "item": parsed["item"],
        "qty": parsed["qty"],
        "unit": parsed["unit"],
        "location_text": parsed["location_text"],
        "camp_id": normalized_camp,
        "district": parsed["district"],
        "lat": parsed["lat"],
        "lng": parsed["lng"],
        "beneficiaries": parsed["beneficiaries"],
        "urgency": parsed["urgency"],
        "confidence": parsed["confidence"],
        "provider": parsed["provider"],
        "needs_review": needs_review,
        "raw_text": raw_text,
        "source": source,
        "verified": verified and camp_verified,
        "kind": "demand",
        "language": parsed["language"],
        "duplicate_of": None,
        "report_count": 1,
        "channel": channel,
        "attachment_url": None,
        "created_at": _now(),
        "trust": round(trust, 2),
        "trust_reasons": trust_reasons,
        "sender_key": sender_key,
    }



# ── Rate limiter ─────────────────────────────────────────────────

def _rate_ok(ip: str, limit: int = 5, window: int = 60) -> bool:

    now = time.time()

    hits = [
        t for t in _rate.get(ip, [])
        if now - t < window
    ]

    if len(hits) >= limit:
        return False

    _rate[ip] = hits + [now]

    return True


# ── API endpoints ────────────────────────────────────────────────

@app.get("/api/health")
def health():

    gemini_ok = (
        bool(os.environ.get("GEMINI_API_KEY"))
        and os.environ.get("OFFLINE_MODE") != "1"
    )

    return jsonify({
        "status": "ok",
        "offline_mode": os.environ.get("OFFLINE_MODE") == "1",
        "gemini": gemini_ok,
        "ocr": False,
        "stt": False,
        "time": _now(),
    })


@app.get("/api/config")
def config():

    return jsonify({
        "stale_hours": 48,
        "helpline_number": None,
        "emergency_numbers": [
            {
                "label": "National Disaster Helpline",
                "number": "1078"
            },
            {
                "label": "Emergency",
                "number": "112"
            }
        ],
        "languages": ["en", "hi", "hinglish"],
    })


@app.get("/api/gazetteer")
def gazetteer():

    return jsonify([
        {
            "id": "camp-17",
            "name": "Camp 17",
            "lat": 30.90,
            "lng": 75.86
        },
        {
            "id": "camp-22",
            "name": "Camp 22",
            "lat": 30.85,
            "lng": 75.80
        },
        {
            "id": "camp-9",
            "name": "Camp 9",
            "lat": 30.95,
            "lng": 75.90
        },
    ])


# ── Coordinator intake ───────────────────────────────────────────

@app.post("/api/intake")
def intake():

    body = request.get_json(force=True, silent=True) or {}

    text = str(body.get("text", "")).strip()

    if not text:
        return jsonify({"error": "text is required"}), 400

    parsed = _extract(text)

    demand = _make_demand(parsed, text)

    parent = find_parent(demand, _demands)

    if parent:
        apply_duplicate(demand, parent)

        _log(
            "duplicate_intake",
            demand["id"],
            f"duplicate of {parent['id']}"
        )

    else:
        _log("intake", demand["id"], text[:80])

    _demands.insert(0, demand)

    return jsonify({"demands": [demand]})


# ── Demand endpoints ─────────────────────────────────────────────

@app.get("/api/demands")
def demands():

    return jsonify(_demands)


@app.post("/api/demands/<did>/verify")
def verify(did):

    d = next(
        (x for x in _demands if x["id"] == did),
        None
    )

    if not d:
        return jsonify({"error": "not found"}), 404

    d["verified"] = True
    d["needs_review"] = False

    _log("verified", did)

    return jsonify({"verified": True})


@app.post("/api/demands/<did>/reject")
def reject_demand(did):

    body = request.get_json(force=True, silent=True) or {}

    reason = str(body.get("reason", "")).strip()

    if not reason:
        return jsonify({"error": "reason required"}), 400

    d = next(
        (x for x in _demands if x["id"] == did),
        None
    )

    if not d:
        return jsonify({"error": "not found"}), 404

    d["verified"] = False
    d["rejected"] = True
    d["reject_reason"] = reason
    d["needs_review"] = False

    if d.get("sender_key"):
        key = d["sender_key"]
        _sender_rep[key] = _sender_rep.get(key, 0) + 1

    _log("rejected", did, reason)

    return jsonify({
        "verified": False,
        "rejected": True
    })


@app.post("/api/demands/<did>/correct")
def correct(did):

    body = request.get_json(force=True, silent=True) or {}

    d = next(
        (x for x in _demands if x["id"] == did),
        None
    )

    if not d:
        return jsonify({"error": "not found"}), 404

    for field in ("item", "qty", "unit", "urgency", "camp_id"):
        if field in body:
            d[field] = body[field]

    _log("corrected", did, str(body))

    return jsonify(d)


# ── Public report ────────────────────────────────────────────────

@app.post("/api/public/report")
def public_report():

    ip = request.remote_addr or "unknown"

    if not _rate_ok(ip):
        return jsonify({
            "error": "Too many reports. Please wait a minute."
        }), 429

    body = request.get_json(force=True, silent=True) or {}

    text = str(body.get("text", "")).strip()

    client_uuid = body.get("client_uuid")

    # Idempotency check
    if client_uuid:

        existing = next(
            (
                d for d in _demands
                if d.get("client_uuid") == client_uuid
            ),
            None
        )

        if existing:
            return jsonify({
                "id": existing["id"],
                "status": "queued"
            })

    if text:
        parsed = _extract(text)

    else:
        parsed = {
            "item": None,
            "qty": None,
            "unit": None,
            "location_text": body.get("location_text"),
            "camp_id": None,
            "district": None,
            "lat": body.get("lat"),
            "lng": body.get("lng"),
            "beneficiaries": None,
            "urgency": "medium",
            "confidence": 0.3,
            "provider": "rules",
            "language": "en"
        }

    demand = _make_demand(
        parsed,
        text,
        source="public",
        verified=False,
        sender_key=ip[:16] if ip else None
    )

    demand["client_uuid"] = client_uuid
    demand["needs_review"] = True

    parent = find_parent(demand, _demands)

    if parent:

        apply_duplicate(demand, parent)

        _log(
            "duplicate_public_report",
            demand["id"],
            f"duplicate of {parent['id']}"
        )

    else:
        _log("public_report", demand["id"], text[:80])

    _demands.insert(0, demand)

    return jsonify({
        "id": demand["id"],
        "status": "queued"
    })


# ── Stock endpoints ──────────────────────────────────────────────

@app.get("/api/stock")
def stock():

    return jsonify(_stock)


@app.post("/api/supply/paste")
def supply_paste():

    body = request.get_json(force=True, silent=True) or {}

    text = str(body.get("text", ""))

    lots = []

    for line in text.splitlines():

        match = re.search(
            r"(\d[\d,]*)\s*(unit|bottle|packet|kg|litre|liter|piece)?s?\s+(?:of\s+)?(\w+)",
            line,
            re.I
        )

        if match:

            lot = {
                "id": _uid(),
                "item": match.group(3).lower(),
                "qty": int(match.group(1).replace(",", "")),
                "unit": match.group(2) or "unit",
                "depot_id": "depot-1",
                "updated_at": _now()
            }

            _stock.append(lot)
            lots.append(lot)

    return jsonify(lots)


# ── Matching endpoint ────────────────────────────────────────────

@app.post("/api/match/run")
def match_run():

    # Simple stub: proposal for critical, non-rejected demands.
    proposals = []

    for d in _demands:

        if d.get("duplicate_of"):
            continue

        if (
            d.get("urgency") == "critical"
            and not d.get("rejected")
        ):

            proposals.append({
                "id": _uid(),
                "demand_id": d["id"],
                "item": d["item"],
                "qty": d["qty"],
                "depot_id": "depot-1",
                "camp_id": d["camp_id"],
                "score": 0.90,
                "state": "proposed",
                "explain": (
                    f"Critical demand at "
                    f"{d['location_text'] or 'unknown'}, "
                    "no stock on site."
                ),
                "km": 3.2,
                "eta_h": 0.1,
                "distance_source": "haversine",
            })

    plan = {
        "id": _uid(),
        "proposals": proposals,
        "conflicts": [],
        "warnings": [],
        "created_at": _now()
    }

    _moves.extend(proposals)

    _log(
        "match_run",
        plan["id"],
        f"{len(proposals)} proposals"
    )

    return jsonify(plan)


@app.get("/api/plan/latest")
def plan_latest():

    if not _moves:
        return jsonify({
            "proposals": [],
            "conflicts": [],
            "warnings": [],
            "created_at": _now()
        })

    return jsonify({
        "proposals": _moves,
        "conflicts": [],
        "warnings": [],
        "created_at": _now()
    })


# ── Move management ──────────────────────────────────────────────

@app.post("/api/moves/<mid>/approve")
def approve_move(mid):

    m = next(
        (x for x in _moves if x["id"] == mid),
        None
    )

    if not m:
        return jsonify({"error": "not found"}), 404

    m["state"] = "approved"

    _log("approved_move", mid)

    return jsonify({"state": "approved"})


@app.post("/api/moves/<mid>/edit")
def edit_move(mid):

    body = request.get_json(force=True, silent=True) or {}

    m = next(
        (x for x in _moves if x["id"] == mid),
        None
    )

    if not m:
        return jsonify({"error": "not found"}), 404

    for field in ("qty", "notes"):
        if field in body:
            m[field] = body[field]

    m["state"] = "edited"

    _log("edited_move", mid, str(body))

    return jsonify({"state": "edited"})


@app.post("/api/moves/<mid>/reject")
def reject_move(mid):

    body = request.get_json(force=True, silent=True) or {}

    reason = str(body.get("reason", "")).strip()

    if not reason:
        return jsonify({"error": "reason required"}), 400

    m = next(
        (x for x in _moves if x["id"] == mid),
        None
    )

    if not m:
        return jsonify({"error": "not found"}), 404

    m["state"] = "rejected"
    m["reject_reason"] = reason

    _log("rejected_move", mid, reason)

    return jsonify({"state": "rejected"})


# ── Audit and shortages ──────────────────────────────────────────

@app.get("/api/audit")
def audit():

    return jsonify(_audit)


@app.get("/api/shortages")
def shortages():

    return jsonify([])


# ── SPA fallback ─────────────────────────────────────────────────

@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path):

    dist = os.path.join(
        os.path.dirname(__file__),
        "..",
        "frontend",
        "dist"
    )

    idx = os.path.join(dist, "index.html")

    if os.path.exists(idx):

        from flask import send_from_directory

        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)

        return send_from_directory(dist, "index.html")

    return jsonify({
        "error": "frontend not built yet"
    }), 404


if __name__ == "__main__":
    app.run(debug=True, port=5000)

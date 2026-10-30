import json
from pathlib import Path
from backend.matching.engine import plan
import os
import re
import csv
import io

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from backend.database import (
    init_db,
    get_demands,
    get_stock,
    save_demand,
    verify_demand,
    reject_demand,
    correct_demand,
    save_supplies,
    save_moves,
    get_move,
    get_moves,
    add_audit_entry,
    get_audit_entries,
    approve_move,
    edit_move,
    reject_move
)

from backend.extraction.chain import extract
from backend.offline.join import create_blueprint


def create_app():
    app = Flask(__name__)
    frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    app.config["FRONTEND_DIST"] = str(frontend_dist)

    init_db()
    CORS(app)

    app.register_blueprint(create_blueprint())

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "offline_mode": os.getenv("OFFLINE_MODE", "0") == "1"
        })

    @app.get("/api/gazetteer")
    def gazetteer():
        gazetteer_path = (
            Path(__file__).parent / "seed" / "gazetteer.json"
        )

        try:
            with open(gazetteer_path, "r", encoding="utf-8") as file:
                places = json.load(file)
        except (OSError, json.JSONDecodeError):
            return jsonify({"error": "Gazetteer data unavailable"}), 500

        return jsonify(places), 200

    @app.get("/api/config")
    def config():
        return jsonify({
            "stale_hours": 24,
            "helpline_number": "112",
            "emergency_numbers": [
                {
                    "name": "Emergency Response",
                    "number": "112"
                },
                {
                    "name": "Ambulance",
                    "number": "108"
                },
                {
                    "name": "Fire",
                    "number": "101"
                },
                {
                    "name": "Police",
                    "number": "100"
                }
            ],
            "languages": [
                "English",
                "Hindi",
                "Punjabi"
            ]
        }), 200

    @app.get("/api/demands")
    def demands():
        return jsonify(get_demands())

    
    @app.post("/api/intake")
    def intake():
        data = request.get_json(silent=True) or {}
        text = data.get("text", "")

        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": "Please provide a valid text report."}), 400

        lat = data.get("lat")
        lng = data.get("lng")

        if (lat is None) != (lng is None):
            return jsonify({
                "error": "Both latitude and longitude must be provided together."
            }), 400

        if lat is not None:
            try:
                lat = float(lat)
                lng = float(lng)
            except (TypeError, ValueError):
                return jsonify({"error": "Coordinates must be numeric."}), 400

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                return jsonify({"error": "Coordinates are outside valid ranges."}), 400

        draft = extract(text.strip())
        draft.source = "coordinator"
        draft.verified = True
        draft.needs_review = True

        demand_id = save_demand(draft, lat=lat, lng=lng)

        demand = next(
            (item for item in get_demands() if item["id"] == demand_id),
            None
        )

        return jsonify({
            "id": demand_id,
            "status": "saved",
            "demand": demand
        }), 201



    @app.post("/api/demands/<demand_id>/verify")
    def verify(demand_id):
        if not verify_demand(demand_id):
            return jsonify({"error": "Demand not found"}), 404

        return jsonify({"verified": True, "id": demand_id}), 200

    @app.post("/api/demands/<demand_id>/reject")
    def reject(demand_id):
        data = request.get_json(silent=True) or {}
        reason = data.get("reason", "")

        if not isinstance(reason, str) or not reason.strip():
            return jsonify({"error": "A rejection reason is required."}), 400

        if not reject_demand(demand_id, reason.strip()):
            return jsonify({"error": "Demand not found"}), 404

        return jsonify({
            "verified": False,
            "rejected": True,
            "id": demand_id
        }), 200

    @app.post("/api/demands/<demand_id>/correct")
    def correct(demand_id):
        data = request.get_json(silent=True) or {}
        result = correct_demand(demand_id, data)

        if result is None:
            return jsonify({
                "error": "Demand not found or invalid correction."
            }), 400

        return jsonify(result), 200

    @app.get("/api/stock")
    def stock():
        return jsonify(get_stock())

    @app.post("/api/supply/paste")
    def supply_paste():
        data = request.get_json(silent=True) or {}
        text = data.get("text", "")

        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": "Please provide supply text."}), 400

        entries = []

        pattern = re.compile(
            r"^\s*([A-Za-z ]+?)\s*:\s*"
            r"(\d+(?:\.\d+)?)\s+"
            r"(litres?|packets?|units?|kits?)\s+"
            r"(water|food|tent|blankets?|medkits?)\s*$",
            re.IGNORECASE
        )

        for line_number, line in enumerate(text.splitlines(), start=1):
            if not line.strip():
                continue

            match = pattern.match(line)

            if not match:
                return jsonify({
                    "error": f"Invalid supply format on line {line_number}."
                }), 422

            depot, quantity, unit, item = match.groups()
            item = item.lower().rstrip("s")

            entries.append({
                "depot": depot.strip(),
                "quantity": float(quantity),
                "unit": unit.lower(),
                "item": item
            })

        try:
            saved = save_supplies(entries)
        except ValueError as error:
            return jsonify({"error": str(error)}), 422

        return jsonify(saved), 201

    # CSV SUPPLY UPLOAD
    @app.post("/api/supply/csv")
    def supply_csv():
        uploaded_file = request.files.get("file")

        if uploaded_file is None or not uploaded_file.filename:
            return jsonify({"error": "Please upload a CSV file."}), 400

        if not uploaded_file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only CSV files are accepted."}), 400

        try:
            content = uploaded_file.stream.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))

            required_columns = {"depot", "item", "quantity", "unit"}

            if not reader.fieldnames:
                return jsonify({"error": "CSV file is empty."}), 422

            reader.fieldnames = [
                name.strip().lower() for name in reader.fieldnames
            ]

            if not required_columns.issubset(set(reader.fieldnames)):
                return jsonify({
                    "error": "CSV must contain depot, item, quantity and unit columns."
                }), 422

            entries = []

            for line_number, row in enumerate(reader, start=2):
                try:
                    entries.append({
                        "depot": row["depot"].strip(),
                        "item": row["item"].strip().lower(),
                        "quantity": float(row["quantity"]),
                        "unit": row["unit"].strip()
                    })
                except (TypeError, ValueError, AttributeError):
                    return jsonify({
                        "error": f"Invalid data on CSV line {line_number}."
                    }), 422

            saved = save_supplies(entries)

        except UnicodeDecodeError:
            return jsonify({"error": "CSV must use UTF-8 encoding."}), 422
        except ValueError as error:
            return jsonify({"error": str(error)}), 422

        return jsonify(saved), 201

    @app.post("/api/match/run")
    def run_matching():
        demands_data = get_demands()
        stock_data = get_stock()

        eligible_demands = []
        location_required = []
        excluded_demands = []

        for demand in demands_data:

            # Exclude unverified or rejected demands.
            if not demand.get("verified") or demand.get("needs_review"):
                excluded_demands.append({
                    "demand_id": demand["id"],
                    "reason": "verification_required"
                })
                continue

            # Coordinates are mandatory for distance calculation.
            try:
                lat = float(demand["lat"])
                lng = float(demand["lng"])
            except (TypeError, ValueError):
                location_required.append({
                    "demand_id": demand["id"],
                    "location_id": demand.get("location_id"),
                    "reason": "missing_coordinates"
                })
                continue

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                location_required.append({
                    "demand_id": demand["id"],
                    "location_id": demand.get("location_id"),
                    "reason": "invalid_coordinates"
                })
                continue

            eligible_demands.append({
                **demand,
                "quantity_needed": demand["quantity_needed"],
                "fulfilled": demand.get("fulfilled", 0),
                "lat": lat,
                "lng": lng
            })

        # Only stock with usable coordinates can be used.
        eligible_stock = []

        for supply in stock_data:
            try:
                lat = float(supply["lat"])
                lng = float(supply["lng"])
            except (TypeError, ValueError):
                continue

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue

            eligible_stock.append({
                **supply,
                "lat": lat,
                "lng": lng
            })

        result = plan(
            eligible_demands,
            eligible_stock
        )

        # Save generated recommendations as proposed moves.
        saved_move_ids = save_moves(
            result.get("recommendations", [])
        )

        result["saved_move_ids"] = saved_move_ids

        result["location_required"] = location_required
        result["excluded_demands"] = excluded_demands

        # Avoid falsely reporting stock as surplus when some demands
        # are still awaiting verification or location information.
        if location_required or excluded_demands:
            result["surplus"] = []
            result["surplus_deferred_reason"] = (
                "Surplus assessment is incomplete because some demands "
                "are awaiting verification or location information."
            )

        return jsonify(result), 200


    @app.post("/api/moves/<move_id>/approve")
    def approve_move_route(move_id):
        try:
            move = approve_move(move_id)
            return jsonify({"move": move, "state": "approved"}), 200
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.post("/api/moves/<move_id>/edit")
    def edit_move_route(move_id):
        data = request.get_json(silent=True) or {}

        try:
            move = edit_move(
                move_id,
                qty=data.get("qty"),
                notes=data.get("notes")
            )
            return jsonify({"move": move, "state": "edited"}), 200
        except (ValueError, TypeError) as error:
            return jsonify({"error": str(error)}), 400

    @app.post("/api/moves/<move_id>/reject")
    def reject_move_route(move_id):
        data = request.get_json(silent=True) or {}

        try:
            move = reject_move(
                move_id,
                reason=data.get("reason", "")
            )
            return jsonify({"move": move, "state": "rejected"}), 200
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    @app.get("/api/audit")
    def audit_route():
        entries = get_audit_entries()
        return jsonify(entries), 200

    @app.get("/api/plan/latest")
    def latest_plan_route():
        return jsonify({"moves": get_moves()}), 200

    
    @app.get("/api/shortages")
    def shortages_route():
        demands_data = get_demands()
        stock_data = get_stock()

        eligible_demands = []

        for demand in demands_data:
            if not demand.get("verified") or demand.get("needs_review"):
                continue

            try:
                lat = float(demand["lat"])
                lng = float(demand["lng"])
            except (TypeError, ValueError):
                continue

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue

            eligible_demands.append({
                **demand,
                "lat": lat,
                "lng": lng
            })

        eligible_stock = []

        for supply in stock_data:
            try:
                lat = float(supply["lat"])
                lng = float(supply["lng"])
            except (TypeError, ValueError):
                continue

            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue

            eligible_stock.append({
                **supply,
                "lat": lat,
                "lng": lng
            })

        result = plan(eligible_demands, eligible_stock)

        return jsonify({
            "shortages": result.get("shortages", [])
        }), 200

    @app.get("/")
    def frontend_index():
        return send_from_directory(app.config["FRONTEND_DIST"], "index.html")

    @app.get("/<path:path>")
    def frontend_assets(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404

        candidate = Path(app.config["FRONTEND_DIST"]) / path
        if candidate.is_file():
            return send_from_directory(app.config["FRONTEND_DIST"], path)

        return send_from_directory(app.config["FRONTEND_DIST"], "index.html")
    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=False
    )

# HANDOFF.md — what Person 4 needs from teammates

## From Person 3 (needed before offline pre-flight passes)

1. backend/extraction/dictionary/items.json
   Format: {"item_id": "rice", "name": "Rice", "unit": "kg", "category": "food"}
   
2. backend/extraction/dictionary/units.json
   Format: {"kg": {"label": "Kilogram", "base_kg": 1.0}, ...}

3. backend/seed/gazetteer.json
   Format: {"ludhiana": {"lat": 30.9, "lng": 75.85}, ...}
   This is also shared with Person 2.

## From Person 2 (needed to run the full stack)

Paste these lines into backend/app.py:

    from backend.offline.join import create_blueprint as join_bp
    from backend.matching.engine import plan

    app.register_blueprint(join_bp())

    @app.route("/api/match/run", methods=["POST"])
    def match_run():
        data = request.get_json()
        result = plan(data["demands"], data["stock"], data.get("vehicles"), data.get("weights"))
        return jsonify(result)

Also needed:
- GET /api/health  -> {"status": "ok", "mode": "offline" or "online"}
- backend/requirements.txt including flask and sqlalchemy
- backend/seed/seed.py with --if-empty flag

## From Person 1

No code changes needed. Build is clean (no CDN links).
Run `npm run build` in frontend/ after any src change before testing offline.

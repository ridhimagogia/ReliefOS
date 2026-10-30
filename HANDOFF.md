# HANDOFF.md — ReliefOS Integration & Stack Status

## 1. Current Status (30 Oct 2026)
- **Backend API Server**: Built & running via `backend/app.py` (`create_app()`). Registered with 18 endpoints matching the full FE-contract.
- **Data Models**: SQLite/MySQL SQLAlchemy models implemented in `backend/models.py` (Location, Item, Demand, Stock, Vehicle, Move, Audit, PlanRun).
- **Matching Adapter**: Implemented in `backend/matching/explain.py` and `backend/api.py`. Adds deterministic move IDs (`mv-<demand>-<stock>`), human-readable `explain` sentences, `conflicts` ("three camps, one truck"), `warnings` (stale stock >6h), FE-shaped `shortages` and `surplus`. Approvals and edits survive re-matching runs.
- **Extraction Rules**: Rewritten in `backend/extraction/providers/rules.py` with 7 major bugfixes. All 15 test cases (including headline demo sentence: `"Camp 17 needs drinking water for approx 600 people, urgent" -> water | 600 people | critical | Camp 17`) pass.
- **Frontend**: Full NEW-FE React application swapped into `frontend/` with built offline distribution in `frontend/dist/`. 0 CDN or public tile requests.

## 2. API Contract Endpoints (Canonical)
- `GET  /api/health` -> `{status: "ok", mode: "online"|"offline", providers: string[], db: "sqlite"|"mysql", scenario: string}`
- `GET  /api/join` -> `{ip, port, url, qr_svg}` (via `backend.offline.join`)
- `GET  /api/locations` -> `Location[]` (camps + depots)
- `GET  /api/items` -> `CanonicalItem[]` (water, food, tent, medkit, blanket)
- `GET  /api/vehicles` -> `Vehicle[]`
- `GET  /api/demands` -> `Demand[]` (includes clustered duplicates)
- `POST /api/intake` `{text, client_uuid?, client_created_at?}` -> `Demand` (idempotent via client_uuid)
- `POST /api/public/report` `{text, location_text?, lat?, lng?, phone?, client_uuid?, client_created_at?}` -> `{id, status: "received"}` (rate-limited 5/min/IP)
- `POST /api/demands/<id>/correct` `{item_id?, qty?, unit?, beneficiaries?, urgency?, location_text?, camp_id?, notes?}` -> `Demand` (audited "edited")
- `POST /api/demands/<id>/verify` -> `{verified: true}` (audited "verified")
- `POST /api/demands/<id>/reject` `{reason}` -> `{verified: false, rejected: true}` (audited "rejected" or "rejected-public")
- `GET  /api/stock` -> `SupplyLot[]`
- `POST /api/supply/paste` `{text}` -> `SupplyLot[]` (free-text parser)
- `POST /api/supply/csv` multipart file / text -> `SupplyLot[]`
- `POST /api/match/run` `{weights?, algorithm?}` -> `PlanOutput` (loads latest demands & stock from DB, avoids stale client data)
- `GET  /api/plan/latest` -> `PlanOutput` (retrieves latest cached plan)
- `POST /api/moves/<id>/approve` -> `{state: "approved"}` (reserves stock & fulfills demand)
- `POST /api/moves/<id>/edit` `{qty?, notes?}` -> `{state: "edited"}` (adjusts reserved stock)
- `POST /api/moves/<id>/reject` `{reason}` -> `{state: "rejected"}` (releases stock & excludes pair)
- `GET  /api/audit` -> `AuditEntry[]` (newest first)
- `GET  /api/shortages` -> `Shortage[]`
- `POST /api/admin/seed/reset` -> resets DB to Punjab flood simulation scenario

## 3. How to Run
- **Test suite**: `OFFLINE_MODE=1 py -m pytest -q` (45 tests pass)
- **API Smoke test**: `py scripts/smoke_api.py` (all 18 endpoints pass)
- **Asset pre-flight**: `py scripts/check_assets.py` (0 failures)
- **Full offline stack**: `OFFLINE_MODE=1 py -m flask --app backend.app run --host 0.0.0.0 --port 5000`

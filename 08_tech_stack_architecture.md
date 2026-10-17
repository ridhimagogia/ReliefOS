# 08. Tech Stack and Architecture

Aligned with the pitched stack (Tesseract + Gemini, Flask, MySQL, rule-based engine, OSM + Leaflet, React). Upgrades are marked **[optional]** so the pitch and build stay consistent.

## 1. System in one view

```
 FIELD INPUT                 INTAKE + AI                 CORE                      OUTPUT
 -----------                 -----------                 ----                      ------
 Web form (offline PWA) -->  Ingest API  -->  Extraction pipeline  -->  Validation  -->  MySQL
 Pasted text / SMS / chat -->                 (Gemini, Tesseract)       + human confirm   (demands, stock,
 Photo of list / note ----->                                                              depots, vehicles)
 Stock sheets (CSV) -------> Import API ------------------------------------------------>      |
                                                                                                v
                                                        Matching engine (score + greedy)  <-- Geo/Distance service (OSRM)
                                                                    |
                                                                    v
                                                  Recommendations (moves) --> React dashboard + Leaflet map
                                                                    |
                                                                    v
                                                       Dispatch log / audit trail / CSV export
```

## 2. Components and technology choices

| Layer | Choice | Why | Fallback |
|---|---|---|---|
| Frontend | React + Vite, Leaflet, Tailwind | Fast to build, matches PPT | Plain HTML + Leaflet |
| Offline | PWA (service worker) + IndexedDB queue for the field form | Answers "limited connectivity" slide | Skip; demo as "queued submit" with a toggle |
| Backend | Python Flask + Flask-CORS | Matches PPT | FastAPI is nicer (typed, auto docs) if all agree **[optional]** |
| DB | MySQL (as pitched). Use SQLite locally if setup slows you | Same SQL both ways via SQLAlchemy | SQLite file shipped in repo |
| ORM | SQLAlchemy | One model layer for both DBs | n/a |
| AI extraction | Gemini API (text + vision) with JSON schema output | Handles Hindi/Hinglish and images in one call | Rule-based regex parser with canned examples |
| OCR | Tesseract for clean printed text only | Cheap, offline | Send image to Gemini instead (handwriting) |
| Geocoding | Gazetteer table of known camps/depots first; Nominatim (OSM) second | Camp names are rarely in public geocoders | Manual pin on map |
| Routing/distance | OSRM public demo or Haversine | Road distance matters; Haversine is the safe fallback | Haversine x 1.3 factor |
| Optimisation | Rule-based score + greedy (MVP). Google OR-Tools transportation problem **[optional]** | Explainable first, optimal second | Greedy only |
| Realtime UI | Polling every 5 s (simple) or Server-Sent Events | No websockets needed | Manual refresh button |
| Auth | Simple role login (Admin / NGO / Field) with JWT | Shows role design | Skip for demo, mention roadmap |
| Deploy | Docker Compose (flask, mysql, frontend) locally; Render/Railway for a link | One command to run on judge's laptop | Run on own laptop |

## 3. Data model (MySQL)

```
organizations(id, name, type[NGO|GOV|CSR|DONOR], contact)
locations(id, name, type[CAMP|DEPOT|HOSPITAL|HUB], lat, lng, district, state, population)
items(id, name, category[WATER|FOOD|SHELTER|MEDICAL|HYGIENE|CLOTHING], unit, sphere_rate_per_person_day, perishable)
stock(id, location_id, item_id, quantity, reserved, expiry_date, updated_at, org_id)
demand(id, location_id, item_id, quantity_needed, beneficiaries, urgency[CRITICAL|HIGH|MEDIUM|LOW],
       status[PENDING_REVIEW|OPEN|PARTIAL|FULFILLED|CANCELLED], confidence, source, raw_text, created_at, confirmed_by)
vehicles(id, org_id, type, capacity_kg, capacity_units_json, current_location_id, speed_kmph, available)
recommendations(id, demand_id, stock_id, vehicle_id, quantity, distance_km, eta_hours, score, reason_json, status[PROPOSED|APPROVED|DISPATCHED|DELIVERED|REJECTED])
audit_log(id, actor, action, entity, entity_id, payload_json, created_at)
```

Key design choices:
- `reserved` on stock avoids promising the same blankets twice.
- `confidence` + `PENDING_REVIEW` implements the human confirmation step.
- `reason_json` stores the score breakdown so every recommendation is explainable.

## 4. AI extraction pipeline (the "messy to structured" layer)

Steps:
1. **Normalise input.** Text as is; image goes to Gemini vision (handwriting) or Tesseract (printed); voice notes are out of scope for MVP.
2. **LLM extraction** with a strict JSON schema and few-shot examples (English, Hindi, Hinglish):
   `{items:[{item, quantity, unit, beneficiaries, urgency}], location_text, contact, language}`
3. **Canonicalise.** Map "paani", "drinking water", "pine ka pani" to `WATER`; map units to base units (litre, piece, kit).
4. **Resolve location.** Fuzzy match against `locations` (rapidfuzz), else geocode, else flag for manual pin.
5. **Fill gaps with standards.** If only headcount is given ("water for 600 people"), compute quantity = 600 x 15 L = 9,000 L/day using Sphere rates (see 01).
6. **Urgency rules** (LLM suggests, rules decide): water or medical with no supply, children/elderly/pregnant mentioned, "since 2 days", "no food" push urgency up.
7. **Validate.** Reject or flag impossible values (negative, absurd quantity vs headcount), low confidence (<0.7), missing location.
8. **Human confirm.** Flagged records land in a review queue; one-click approve/edit.

Prompt skeleton:
```
You extract relief demand from field messages. Output ONLY JSON matching the schema.
Categories: WATER, FOOD, SHELTER, MEDICAL, HYGIENE, CLOTHING.
Urgency: CRITICAL (life-threatening, none available), HIGH, MEDIUM, LOW.
If quantity is missing, set quantity null and keep beneficiaries.
Message language may be English, Hindi or Hinglish. Examples: ...
Message: "{text}"
```

Evaluate on your 150-message gold set: report field-level accuracy (item, quantity, location, urgency) on a slide. Judges like a number.

## 5. Matching engine

### 5.1 Inputs
Supply (stock at depots), Demand (open requests), Distance (road km and ETA), Urgency (level + wait time), Transport capacity (vehicles available).

### 5.2 Score for a (stock s, demand d) pair
```
fill      = min(s.available, d.remaining) / d.remaining            # 0..1, how much of need is met
urg       = {CRITICAL:1.0, HIGH:0.75, MEDIUM:0.5, LOW:0.25}[d.urgency] + wait_bonus(d)   # capped at 1
prox      = 1 - min(distance_km / MAX_KM, 1)                         # nearer is better
feasible  = vehicle_available and within_time_limit and road_accessible
score     = feasible * ( w_u*urg + w_f*fill + w_p*prox )             # e.g. w_u=0.5, w_f=0.25, w_p=0.25
```
Tunable weights via sliders in the UI (judges love this: change weights, see moves change).

### 5.3 Algorithm (MVP, greedy, deterministic)
```
1. Sort open demands by urgency, then wait time.
2. For each demand, for each item needed:
     candidates = depots with available stock of that item
     rank by score; allocate min(available, remaining) from the best, reduce stock, repeat
     until demand is filled or no stock.
3. Group allocations by (origin depot, destination) and assign vehicles (first-fit by capacity).
4. Emit recommendations with distance, ETA and score breakdown.
```
Handles the example in the problem statement: A has 10,000 blankets, B needs 7,000 blankets and 500 medical kits, C has 4,000 ORS: blankets A to B; medical kits shortage is reported ("500 kits short, nearest source: ...").

### 5.4 Upgrade path (say it in the pitch, build only if time)
- Global optimum via transportation problem (OR-Tools / PuLP): minimise `sum(cost x qty)` subject to supply and demand limits, urgency as weights.
- Vehicle routing (CVRP) for multi-stop trucks.
- Re-plan on events: new demand, stock change, road closure.

### 5.5 Shortage and surplus intelligence (strong demo moments)
- **Shortage report:** unmet demand by item and district.
- **Surplus alert:** stock that no one needs (Kerala 2018 lesson: unsolicited goods), with suggestion to redirect.
- **Public needs board** for donors, showing what to send (what Kerala did manually in 2019).

## 6. API (REST, JSON)

| Method + path | Purpose |
|---|---|
| POST /api/reports | Submit raw text/image; returns parsed draft |
| POST /api/demands/{id}/confirm | Approve or edit a reviewed demand |
| GET /api/demands?status=&urgency= | List demands |
| POST /api/stock/import | CSV upload of stock |
| GET /api/stock, /api/locations, /api/vehicles | Reference data |
| POST /api/match/run | Run the matcher with optional weights; returns recommendations |
| POST /api/recommendations/{id}/approve | Approve a move (reserves stock) |
| GET /api/dashboard/summary | KPIs: open demand, fill rate, avg time-to-match, shortages |
| GET /api/needs-board | Public view for donors |
| GET /api/audit | Audit trail |

## 7. Frontend screens
1. **Command map:** camps (colour = urgency), depots, arrows for proposed moves, filter by item.
2. **Intake:** paste text / upload photo; shows parsed result side by side with confidence.
3. **Review queue:** low-confidence items to approve or fix.
4. **Matching:** weight sliders, Run button, ranked move list with "why" breakdown, approve.
5. **Shortages and surplus.**
6. **Donor needs board** (read-only).

## 8. Offline and low connectivity
- Field form as PWA: stores submissions in IndexedDB, shows "queued (3)", syncs when online.
- SMS/WhatsApp intake is a roadmap item (Twilio or WhatsApp Business API); for the demo, simulate with a "paste a WhatsApp message" box.
- Server stores `client_created_at` so late-synced reports keep their true timestamp for urgency.

## 9. Non-functional
- **Explainability:** score breakdown on every recommendation.
- **Auditability:** audit_log on every state change.
- **Privacy:** store camp-level data, not victim identities; role-based access; contact numbers masked for non-admins.
- **Reliability for demo:** cache LLM responses for the scripted demo inputs; cache OSRM results; seed script resets DB in one command.
- **Security basics:** env-based API keys, input size limits, parameterised queries via SQLAlchemy.

## 10. Repo layout (for the code repo, separate from this research repo)
```
reliefos/
  backend/
    app.py            # Flask app factory, blueprints
    models.py         # SQLAlchemy models
    extraction/       # llm.py, ocr.py, normalise.py, locations.py, validate.py
    matching/         # scoring.py, greedy.py, optimise.py (optional)
    routing.py        # OSRM client + haversine fallback
    seed/             # scenarios (punjab_flood.json, cyclone_coast.json), seed.py
    tests/            # gold-set evaluation + matcher unit tests
  frontend/
    src/pages/        # Map, Intake, Review, Matching, Shortages, NeedsBoard
    src/components/   # UrgencyBadge, MoveCard, WeightSliders
    src/offline/      # queue.js, sw.js
  docker-compose.yml
  README.md
```

## 11. Decisions the team must freeze now
1. MySQL (as pitched) vs SQLite for dev. Recommendation: SQLAlchemy with SQLite locally, MySQL in docker-compose.
2. Flask (as pitched) vs FastAPI. Recommendation: keep Flask unless someone already knows FastAPI.
3. Which Gemini model and who holds the API key and quota. Check the current free-tier limits before the event; have a cached fallback.
4. One primary demo scenario: recommend **Punjab flood** (matches your references and a real, recent event).
5. Demo language set: English + Hinglish minimum.

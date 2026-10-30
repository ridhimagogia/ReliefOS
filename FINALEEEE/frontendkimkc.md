# ReliefOS: Frontend Integration Handoff Plan

> **Audience:** any AI agent (or human) picking this up with zero prior context.
> **Written:** 30 Oct 2026, morning of Zinnovatio 4.0 (final is 30-31 Oct, offline, overnight). Code freeze was 29 Oct, so everything below is tagged by priority: **P0 = demo-breaking, P1 = should have, P2 = nice to have**.
> **How to use:** read Sections 0-3 fully (10 minutes), then execute Section 4 task by task in the listed order. Every task has an ID, files, exact change, and a "done when" check. Do not skip the "done when".

---

## 0. TL;DR

There are **two code bases**:

| Name | What it is | Where |
|---|---|---|
| **REPO** | The team's real project (`reliefos_slim.zip`): matching engine, routing, extraction (rules + Gemini), offline tools, docs, tests (35 pass), and an **old 330-line mock-only frontend** in `prototype/frontend/`. **It has NO Flask app, NO database, NO API server.** | `reliefos_slim.zip` |
| **NEW-FE** | The reworked frontend (`ReliefOS_Frontend_Export.zip`, built from `PROMPT_AASTHA_FRONTEND.md`): ~2,450-line `App.tsx`, `PublicReport.tsx`, `types.ts`, real API client, IndexedDB queue, SVG map. | `ReliefOS_Frontend_Export.zip` |

**Verdict:** NEW-FE is the right frontend to adopt (it matches the product idea: unstructured text in, structured result out, human approves). But it **cannot be dropped in as-is** for three reasons:

1. **NEW-FE has bugs** (3 data-loss/integrity bugs, lots of hardcoded tables). See Section 4, Part B.
2. **The REPO has no server for it to talk to.** The Flask app (Person 2's part) is missing from the zip, and NEW-FE's API contract differs from the contract in `docs/08` and from what the matcher/extractor actually return. Section 4, Part C.
3. **The REPO's extraction code fails the headline demo sentence** ("Camp 17 needs drinking water for approx 600 people, urgent" gives `item=None`). Section 4, Part C, task C-09.

So the work is: **(A) swap files, (B) fix the frontend, (C) build/adapt the backend contract layer, (D) integrate, test, package for offline.**

### Minimum path if you only have ~2 hours
`A-01..A-04` → `B-01, B-02, B-03, B-04, B-05` → `C-00, C-01, C-02, C-03, C-04` → `D-01, D-03`. Skip everything tagged P2.

---

## 0.1 VERIFIED CURRENT STATE OF THE USER'S LOCAL REPO (30 Oct 09:07, supersedes Section 2.1 where they differ)

Source: the user's own PowerShell output and attached files. Local path `...\CU\ReliefOS`, GitHub `ridhimagogia/ReliefOS` (private; the agent could not attach it). Branch `main`, last commit `2169a36 "Fix greedy import, add Flask entry point and health endpoint"`.

| Item | Verified state |
|---|---|
| `pytest -q` | **35 passed** (matching/routing/extraction/offline intact) |
| `frontend/` (src) | **Still the OLD mock-only frontend.** The 6 src files the user sent are byte-identical to `prototype/frontend/src` in the zip (330-line `App.tsx`, `MOCK_MODE = true`). `frontend/` already exists at repo root with `dist/`, `node_modules/`, `package-lock.json` AND `pnpm-lock.yaml`. So **A-01 is a no-op**; skip the move to `prototype/frontend_old`. |
| Flask | **No `backend/app.py`, `models.py`, `config.py`, `api.py`, `requirements.txt`.** `flask --app backend.app routes` fails ("Could not import"). The only Flask code is **inside `backend/routing.py`**: `flask --app backend.routing routes` shows `GET /api/health`, `POST /api/public/report`, `static`. (Distance functions still work since tests pass.) |
| `backend/extraction/dictionary/items.json`, `units.json` | **Exist now.** `items.json` is a **dict keyed by item_id** (`water, food, tent, medkit, blanket`) with fields `item_id, name, unit, category`; display names: "Drinking Water", "Food Packet", "Tent", "Medical Kit", "Blanket". `units.json` = dict keyed by unit with `label, base_kg`. Use these as the item dictionary (do NOT create new ones; C-09 item 8 is DONE). |
| `backend/extraction/dedupe.py` | **EMPTY file (placeholder).** C-02 dedupe/cluster logic still has to be written. |
| `backend/seed/messages.json`, `supply.json` | **EMPTY files (placeholders).** C-07 seed data still has to be written. `gazetteer.json` has 8 districts only (no camps). `simulation_results.json` exists (synthetic, labelled). |
| `backend/extraction/providers/rules.py` | **UNCHANGED from the zip**: same bugs (item needs an adjacent number; `waterproof` matches `water`; unsorted aliases; `urgent` -> high; confidence 1.0 / `needs_review=False` when item+qty+camp found; `qty` = people count for "pani 600 log"). C-09 stands in full. |
| `backend/extraction/chain.py` | Same as zip (Gemini then Rules, threshold 0.6). |
| Not yet received | `backend/routing.py` (current, with Flask code), `backend/providers/gemini.py` (assumed same as zip). Ask for `routing.py` before moving routes out of it. |

**Consequences for the tasks below**
- **C-00:** create `backend/app.py` with `create_app()` and **move** the existing `/api/health` and `/api/public/report` routes out of `routing.py` into `backend/api.py` (keep `routing.py` as the pure distance module the matcher imports; do not break `from ..routing import distance`). Read the existing two routes first and keep their behaviour.
- **C-02:** `dedupe.py` is empty: implement the cluster rule there (`find_parent(new, existing) -> parent|None`) and call it from the intake/public handlers.
- **C-07:** fill `messages.json` (sample field messages incl. English/Hindi/Hinglish, used by seed and by the "load examples" buttons) and `supply.json` (depot stock rows) as the seed inputs; camps with coordinates still must be added.
- **A-01:** skip. **A-02:** replace the old `frontend/src` files with the NEW-FE versions; keep the existing `package-lock.json`, delete nothing else.
- **Pitch note (from `simulation_results.json`):** ReliefOS beats naive only on **critical coverage (100% vs 68.2%)** and critical ETA (-29%). Overall coverage is **lower (70.5% vs 73.2%)** and total km is **28.8% higher**. Say "protects critical needs first", never "better coverage overall".

---

## 1. Project context (what ReliefOS is)

- **Product:** disaster-relief supply matching. "WhatsApp chaos in, dispatch plan out." Messy field messages (English / Hindi / Hinglish) become structured demand (`Water | 600 people | Critical | Camp 17`), are matched against depot stock, and produce a **proposed** dispatch plan that a **human coordinator approves, edits or rejects**. The AI proposes; the human decides.
- **Team Koshish** (VIPS-TC, Delhi): Ridhima Gogia, Khushali Kakkar, Navya Gupta, Aastha Jha. Work split in `docs/10_hackathon_plan.md`: **P1 Frontend**, **P2 Flask/DB/API**, **P3 Extraction/AI**, **P4 Matching/routing/offline** (see `CLAUDE.md`).
- **Hard product rules** (judges will test these):
  1. Input is **free text**. The user never types item/quantity/unit/urgency. Structure is **output**. Editing is allowed only as *correction* in the Review Queue.
  2. **Offline must work:** `OFFLINE_MODE=1` makes **zero network calls**. No CDN scripts, fonts, icons or tiles in the build. Offline banner wording must be exactly: **"Works with zero internet on a local network. Internet adds AI parsing and chat-app intake."** Never claim "fully offline including AI".
  3. The frontend **never calls Gemini** or any AI service. API keys live only in the backend `.env`.
  4. Every state change goes to the backend then refreshes from it. No local-only state for demands, stock or moves.
  5. Wording is "proposed / approve", never "assigned / dispatched".
  6. Critical-urgency items are pinned to the top **even if unverified**.
  7. Distance source is always labelled (`haversine` x1.3 straight-line vs `osrm` road). Never present an estimate as a road distance.
- **Agent working rules from the REPO's own `CLAUDE.md`** (respect them unless the user overrides):
  - Contracts live in `docs/08_tech_stack_architecture.md` and `docs/11_offline_infrastructure.md`.
  - **Run `pytest` after every backend change; all 35 tests must stay green.** Make small changes; do not refactor working code.
  - **Never `git push`. Never delete files without asking the user.** (Where this plan says DELETE, move the file to a `_to_delete/` folder and tell the user, unless they have said to delete.)
  - Ownership: Person 4 owns `backend/routing.py, backend/matching/, backend/offline/, scripts/, backend/tests/`. Person 1 owns `frontend/src`, Person 2 the Flask app + DB, Person 3 extraction dictionaries. If you are acting as one person and need a change in another's area, either get the user's OK or write it in `HANDOFF.md`. **The user has asked for all of this work, so treat this plan as that approval, but keep edits small and list what you touched.**

---

## 2. Verified facts about the two code bases

### 2.1 REPO (`reliefos_slim.zip`; an OLDER snapshot. See Section 0.1 for the current local state)

```
backend/
  extraction/chain.py, providers/{base,rules,gemini}.py   # DemandDraft; rules + Gemini
  matching/{engine,greedy,scoring,shortages,optimise,simulate}.py
  routing.py                                              # distance(a,b) -> {km, eta_h, source}; ROAD_FACTOR = 1.3
  offline/{join,basemap}.py                               # QR join, basemap placeholder helpers
  seed/{gazetteer.json, simulation_results.json}          # gazetteer = 8 DISTRICT coords only, no camps
  tests/                                                  # 35 passing
scripts/{run_offline.sh, check_assets.py, build_offline_pack.sh, make_basemap_placeholder.py, check_offline.md}
docs/01..11, README.md, HANDOFF.md, CLAUDE.md
prototype/frontend/   # OLD mock-only frontend (App.tsx 330 lines, api.ts 33 lines, MOCK_MODE = true)
prototype/{match.py, ai/*}
```

**Missing from the REPO (referenced by scripts/docs but not in the zip):** `backend/app.py`, `backend/config.py`, `backend/models.py`, `backend/seed/seed.py`, `backend/requirements.txt`, `backend/extraction/dictionary/{items,units}.json`, `frontend/` (the real path; it is at `prototype/frontend/`), `frontend/dist/`. Consequences:
- `scripts/run_offline.sh` runs `flask --app backend.app` and **will fail**.
- `scripts/check_assets.py` reports **[FAIL]** for the two dictionaries and for `frontend/dist/index.html`.
- `backend/offline/basemap.py DEFAULT_PATH` and `check_assets.py` look in `frontend/public/basemap/...`, **not** `prototype/frontend/...`.

**What the matcher takes and returns (verified by running it):**

```python
# INPUT (plain dicts)
demand  = {id, item_id, quantity_needed, fulfilled?, urgency: "CRITICAL|HIGH|MEDIUM|LOW" (UPPERCASE),
           lat, lng, location_id?, district?, client_created_at?, created_at?}
stock   = {id, location_id, item_id, quantity, reserved?, lat, lng, name?}
vehicle = {id, capacity_kg, current_location_id?, speed_kmph?, available?}
plan(demands, stock, vehicles=None, weights=None, item_kg=None, now=None, dist_fn=None,
     algorithm="greedy"|"lp", item_names=None, location_names=None) 

# OUTPUT
{"recommendations": [{demand_id, stock_id, vehicle_id|None, item_id, qty, km, eta_h,
                      distance_source, score, trips, reason:{urgency,fill,proximity,weights,feasible,wait_h,vehicle,group_load_kg}}],
 "shortages": [{item_id, item_name, district, short_qty, demand_ids[], nearest_source{location_id,name,km,distance_source,source_exhausted}|None, message}],
 "surplus":   [{stock_id, location_id, item_id, item_name, leftover_qty, no_demand, message}],
 "algorithm": "greedy", "distance_sources": ["haversine"]}
```
Recommendations have **no `id`, no `explain`, no `state`**. The output has **no `conflicts` and no `warnings`**.

**What extraction returns** (`DemandDraft`): `item, qty, unit, location_text, camp_id, beneficiaries, urgency (lowercase), confidence, provider, needs_review, raw_text`. Item ids are `water|food|tent|blanket|medkit`. Camp ids look like `camp17` (not `c17`). Provider can be `rules | gemini | gemini_failed`. There is **no** `id, source, verified, kind, language, duplicate_of, report_count`.

### 2.2 NEW-FE (`ReliefOS_Frontend_Export.zip`)

```
src/App.tsx (2451)     all pages: Dashboard, Intake, ReviewQueue, Matching, Stock, Needs, OfflineStatus + shell
src/components/ReliefMap.tsx (424)   SVG map + local GeoJSON basemap
src/components/PublicReport.tsx (406)   /public page
src/services/api.ts (514)   typed client for 14 endpoints + mock fallback + toast event bus
src/offline/reportQueue.ts (163)   IndexedDB queue
src/types.ts (128)   Demand, SupplyLot, Move, PlanOutput, AuditEntry, ...
src/data/mockData.ts (533), src/index.css (418), src/main.tsx, src/vite-env.d.ts
public/basemap/punjab_districts.geojson   (9 district POLYGONS, properties.district)
package.json (no leaflet/maplibre), vite.config.ts (proxy /api -> localhost:5000), .env.example, README.md
.figma/, AGENTS.md, CLAUDE.md, .mise.toml, .gitattributes   (Figma Make scaffolding, harmless)
```
`vite build` passes (313 kB JS). `tsc --noEmit` fails on 1 error (`replaceAll` needs `lib: ES2021`). Built bundle contains one external URL: `https://tile.openstreetmap.org/8/182/107.png`.

**NEW-FE API contract ("FE-contract"), as implemented in `api.ts`:**

```
GET  /api/demands              -> Demand[]
POST /api/intake               {text}                                   -> Demand
POST /api/public/report        {text, location_text?, lat?, lng?, phone?} -> {id, status:"queued"|"received"}
POST /api/demands/<id>/verify  -> {verified:true}
POST /api/demands/<id>/reject  {reason}                                 -> {verified:false, rejected:true}
GET  /api/stock                -> SupplyLot[]
POST /api/supply/paste         {text}                                   -> SupplyLot[]
POST /api/supply/csv           multipart "file"                          -> SupplyLot[]
POST /api/match/run            {demands?, stock?, vehicles?}             -> PlanOutput
POST /api/moves/<id>/approve   -> {state:"approved"}
POST /api/moves/<id>/edit      {qty?, notes?}                            -> {state:"edited"}
POST /api/moves/<id>/reject    {reason}                                  -> {state:"rejected"}
GET  /api/audit                -> AuditEntry[] (newest first)
GET  /api/shortages            -> Shortage[]
```
Types are in `src/types.ts` (copy of the prompt's Section 4). 429 on `/public/report` is handled.

### 2.3 The contract mismatch (this is the core integration problem)

| Concern | docs/08 (REPO contract) | NEW-FE | Matcher / extractor reality |
|---|---|---|---|
| Submit a report | `POST /api/reports {client_uuid, client_created_at, text, source}` idempotent | `POST /api/intake {text}`, no uuid | n/a |
| Confirm demand | `POST /api/demands/{id}/confirm` | `/verify` and `/reject` | n/a |
| Approve move | `POST /api/recommendations/{id}/approve` | `/api/moves/<id>/approve` | recs have no id |
| Stock CSV | `POST /api/stock/import` | `/api/supply/csv`, `/api/supply/paste` | n/a |
| Locations | `GET /api/locations` | **not used (mock `locations` is imported directly)** | needed for map |
| Health / mode | `GET /api/health` -> `{mode, providers, db}` | **not used** | needed for mode badge |
| QR join | `GET /api/join` | **no page** | exists in `backend/offline/join.py` |
| Item naming | `item_id` | display string | `water/food/tent/blanket/medkit` |
| Urgency | `CRITICAL..` | `critical..` | matcher UPPER, extractor lower |
| Camp id | `locations.id` | `c17` in mock | extractor gives `camp17` |
| Shortage shape | by item + district | `{item, requested, available, shortage, camp}` | `{item_id, item_name, district, short_qty, nearest_source, message}` |
| `conflicts`, `warnings`, `explain`, move `id`/`state` | n/a | **required by UI** | **do not exist** |

---

## 3. Decisions already made (so you don't have to ask)

| # | Decision | Why |
|---|---|---|
| D1 | **FE-contract (Section 2.2) is canonical**, plus the additions listed in 4.C-01. docs/08 section 6 gets updated; optionally also expose the docs/08 paths as aliases (one-line `add_url_rule`). | The UI is already built to it, and the owner's prompt says "do not invent different endpoint names". |
| D2 | **Backend adapts to the frontend's JSON shapes**, not the reverse. All translation lives in **one new module**: `backend/api_adapters.py` + `backend/matching/explain.py`. | Keeps the tested matcher/extractor untouched (tests stay green). |
| D3 | `POST /api/match/run` **loads demands/stock/vehicles from the DB** when the body omits them. Body may carry only `{weights?, algorithm?}`. | Avoids stale client state. The `HANDOFF.md` snippet (`data["demands"]`) would KeyError on the FE's empty `{}`; replace it. |
| D4 | Move IDs are **deterministic**: `mv-{demand_id}-{stock_id}`. State (`pending/approved/edited/rejected`) is stored in DB and re-applied after every re-run. | The FE re-runs matching after each action. Without this, approvals vanish. |
| D5 | **Do NOT add a structured intake form** to the coordinator Intake page (docs/08 section 7 lists a "field form"; the product owner's brief explicitly removed it). The Review Queue correction panel is the no-AI fallback. | Product idea: unstructured in, structured out. |
| D6 | Map: **Phase 1 keep the SVG + local GeoJSON map** (works offline today). **Phase 2 (P2) swap to bundled Leaflet** with GeoJSON layer + optional online tiles. | Time. Leaflet is the pitched stack, so do it if time allows. |
| D7 | Frontend lives at **`frontend/`** (not `prototype/frontend/`) because scripts/docs/`basemap.py` expect that path. Do this with a move, keep the old one as `prototype/frontend_old/` (do not delete). | `run_offline.sh`, `check_assets.py`, `build_offline_pack.sh` all use `frontend/`. |
| D8 | Mock data stays only as a fallback, enabled **only** by `VITE_MOCK_MODE=1`. In real mode, a failed network call shows an error/empty state, never silently falls back to mock. | Silent mock fallback makes a dead backend look alive during the demo. |
| D9 | Item display names come from the backend dictionary (`items.json`), API returns both `item` (display name) and `item_id`. Camp/depot ids are the backend's (`camp17`, `ludhiana-depot`...). Frontend never hardcodes ids. | Removes the `c17`/`camp17` mismatch. |

---

## 4. TASK LIST

Legend: **[FE]** frontend, **[BE]** backend, **[OPS]** build/package. Owner in brackets = whose area per `CLAUDE.md`.

---

### PART A: File moves, swaps and deletions (do these first, ~20 minutes)

Work on a branch / copy. Frontend path after D7 is `frontend/`.

#### A-01 [OPS] Move the frontend to the path the scripts expect (P0)
```bash
git mv prototype/frontend prototype/frontend_old      # keep the old one, do not delete
mkdir frontend                                         # then copy NEW-FE into it (A-02)
```
Fix path references: `backend/offline/basemap.py` `DEFAULT_PATH` already points to `frontend/public/basemap/...` (correct after the move). `scripts/*` already use `frontend/`.
**Done when:** `ls frontend/package.json frontend/public/basemap` works and `prototype/frontend_old/` exists.

#### A-02 [FE] Copy NEW-FE in, file by file (P0)
Extract `ReliefOS_Frontend_Export.zip` (**note: its zip entries use backslashes; use Python `zipfile` and replace `\` with `/`, or `unzip` will warn but usually still work**). Then:

| File | Action | Notes |
|---|---|---|
| `src/App.tsx` | **REPLACE** old (330 lines) with NEW-FE (2451) | then apply Part B fixes |
| `src/components/ReliefMap.tsx` | **REPLACE** | then B-09 fixes (polygon guard, remove OSM URL) |
| `src/components/PublicReport.tsx` | **ADD** | new `/public` page |
| `src/types.ts` | **ADD** | extend per B-01 |
| `src/services/api.ts` | **REPLACE** | then B-02 fixes |
| `src/offline/reportQueue.ts` | **REPLACE** | then B-03/B-04 fixes |
| `src/data/mockData.ts` | **REPLACE** | now fallback only; must not be imported by `App.tsx` (B-08) |
| `src/index.css` | **REPLACE** | NEW-FE css (418 lines) has the classes the new pages use (`result-card`, `chip`, `verify-badge`, `report-count-badge`, `warning-strip`, `conflict-card`, `stale-badge`, `pinned-critical`, `sub-tabs`, ...). Old css lacks them. |
| `src/main.tsx`, `src/vite-env.d.ts` | **KEEP** (identical in purpose) | |
| `index.html` | **KEEP old** | NEW-FE's has Figma placeholder comments; either works. Make sure `<title>` is set to "ReliefOS" and `lang="en"`. |
| `public/basemap/punjab_districts.geojson` | **REPLACE with NEW-FE's** (9 district polygons with `properties.district`) | Old one is the coarse placeholder (1 polygon + 14 `Point` towns). NEW-FE's map code assumes `Polygon` + `properties.district`. **Check licence/provenance of the 9 polygons**; `check_assets.py` only warns about the placeholder, so no warning will remind you. |
| `public/favicon.svg` | KEEP | |
| `vite.config.ts` | **REPLACE with NEW-FE's** (it adds the `/api` -> `http://localhost:5000` dev proxy) | Dev server port defaults to 8443 with `strictPort`. Run `PORT=5173 npm run dev` locally. |
| `tsconfig.json` | **REPLACE**, then set `"lib": ["ES2021","DOM","DOM.Iterable"]` | fixes the `replaceAll` tsc error |
| `package.json` | **KEEP old deps**; add `"typecheck": "tsc --noEmit"` script. Add `leaflet` + `@types/leaflet` only if D6 Phase 2 is done. | |
| `package-lock.json` | **KEEP and regenerate** (`npm install`) | `scripts/build_offline_pack.sh` uses `npm ci`, which requires `package-lock.json`. NEW-FE ships only `pnpm-lock.yaml`. Keep **one** lockfile policy: npm (`package-lock.json`); move `pnpm-lock.yaml` to `_to_delete/` after asking. |
| `.env.example` | **ADD** (`VITE_API_URL=/api`, `VITE_MOCK_MODE=`, `VITE_MAPS_API_KEY=`) | |
| `.gitignore` | **MERGE**: NEW-FE ignores `.env*`, which also ignores `.env.example`. Add the line `!.env.example`. | |
| `README.md` | **REPLACE with a rewritten one** (see B-10) | NEW-FE's README is stale: says `MOCK_MODE = true` and "maps are SVG only". |
| `AGENTS.md`, `CLAUDE.md`, `.figma/`, `.mise.toml`, `.gitattributes` | **KEEP** | Figma Make scaffolding; harmless. Note: frontend `CLAUDE.md` is just `@AGENTS.md` and is different from the repo-root `CLAUDE.md` (Person 4's rules). Don't merge them. |

#### A-03 [FE] Delete (after asking the user; otherwise move to `_to_delete/`) (P1)
- `prototype/frontend_old/` (once the new one is verified)
- `pnpm-lock.yaml` (if standardising on npm)
- Inside the new `api.ts`: legacy helpers `dashboard()`, `submitReport()`, `approveReport()`, `rejectReport()`
- Inside `reportQueue.ts`: `seedDemoQueue()` (**P0, see B-03**)
- Inside `App.tsx`: the dummy `Filters()` selects (or wire them, B-12), hardcoded arrays listed in B-06, the always-on "SIMULATED DATA" ribbon (B-11)
- Unused import `mockShortages` etc. in `api.ts`

#### A-04 [OPS] Make the old docs match (P1)
Update `docs/08_tech_stack_architecture.md` section 6 (API table) to the FE-contract + additions from C-01, and replace the `HANDOFF.md` Flask snippet with the one in C-01 (D3).

---

### PART B: Frontend fixes (NEW-FE bugs + project-fit changes)

Files are under `frontend/src/`. Do B-01 first, since it fixes types the rest depend on.

#### B-01 [FE] Extend `types.ts` to match the real backend (P0)
1. `DemandProvider = 'gemini' | 'rules' | 'unknown' | 'gemini_failed' | 'local_llm'` (backend can emit `gemini_failed`).
2. `Demand`: add `item_id: string | null`, `client_uuid?: string`, `client_created_at?: string`, `created_at?: string`, `status?: string`. Keep all existing fields.
3. `SupplyLot`: add `item_id: string; reserved?: number; depot_name?: string`.
4. New `Location = {id: string; name: string; type: 'camp'|'depot'|'hospital'|'hub'; lat: number; lng: number; district: string; population?: number}`.
5. `Move`: keep, but `vehicle_id: string | null` (matcher returns `None` when no vehicle), `edited_qty?: number`, `notes?: string`, `reason_text?: string`.
6. `Shortage` becomes:
   `{item: string; item_id: string; district: string; shortage: number; requested?: number; available?: number; camp?: string; camp_id?: string; message: string; nearest_source?: {name: string; km: number; distance_source: string; source_exhausted: boolean} | null}`
7. `Surplus` becomes `{item: string; item_id: string; qty: number; depot?: string; stock_id?: string; no_demand?: boolean; message?: string}`.
8. Add `Health = {mode: 'online'|'offline'; providers: string[]; db: 'sqlite'|'mysql'}` and `JoinInfo = {ip: string; port: number; url: string; qr_svg: string | null}`.
9. `PlanOutput.distance_sources: string[]` (backend gives a sorted list), `algorithm: string`.
10. Add `client_uuid` + `client_created_at` to `PublicReportPayload`.
**Done when:** `npx tsc --noEmit` shows no errors after the other tasks use them.

#### B-02 [FE] `services/api.ts` fixes (P0)
1. **Remove silent mock fallback.** `getDemands/getStock/getAudit` currently return the in-memory mock when `status===0`. Only return mock when `MOCK_MODE`. Otherwise return `{ok:false,...}` so pages show an error state with a **Retry** button.
2. Add the missing calls: `getHealth()` -> `GET /api/health`, `getLocations()` -> `GET /api/locations`, `getJoin()` -> `GET /api/join`, `getVehicles()` (optional) -> `GET /api/vehicles`.
3. `submitIntake(text, meta?: {client_uuid, client_created_at})` and `submitPublicReport(payload)` must **send `client_uuid` and `client_created_at`** (generate with `crypto.randomUUID()` / `new Date().toISOString()` if not supplied). This gives idempotency (docs/08 section 9, `check_offline.md`: "double send -> exactly one record").
4. `runMatching(opts?: {weights?, algorithm?})` -> body `{weights, algorithm}` only (D3). Do not send demands/stock.
5. **Add a toast host.** `showToast()` fires a window event but **nothing listens** (`onToast` is imported in `App.tsx` and never used), so no error toast ever shows. Create a small `<ToastHost/>` in `App.tsx`, subscribe with `onToast`, auto-dismiss after ~5 s, `role="status"`. Mount it in both the coordinator shell and `PublicReport`.
6. Mock-mode text: `algorithm` string "Haversine Road Factor 1.35" -> **1.3** (matches `backend/routing.py ROAD_FACTOR`).
7. `rejectDemand` should send `{reason}` (already does). Add `correctDemand(id, fields)` -> `POST /api/demands/<id>/correct` (see C-01, B-05).
8. Remove the "Backward compatibility helpers" block (`dashboard`, `submitReport`, `approveReport`, `rejectReport`) once B-03 stops using `submitReport`.
**Done when:** with the backend stopped and `VITE_MOCK_MODE` unset, the Dashboard shows an error banner, not mock data; with `VITE_MOCK_MODE=1` it shows mock data and a visible "MOCK DATA" label.

#### B-03 [FE] `offline/reportQueue.ts` fixes (**P0, data-loss bugs**)
1. **Retry deletes reports without sending them.** `OfflineStatus.retry()` in `App.tsx` calls `api.submitReport()` (a stub that echoes its input) and then `removeQueuedReport()`. Replace with a real replay of **that one item** through the same function used by `replayQueue` (extract `sendQueued(report)`), and remove it from the queue **only if the API returned `ok`**. On failure keep it and set `state:"Failed"` + `error`.
2. **Queued public reports get laundered as verified coordinator reports.** `replayQueue` sends everything to `/api/intake`. Add `kind: 'intake' | 'public'` and the full payload (`location_text, lat, lng, phone`) to `QueuedReport`. In replay: `kind==='public'` -> `api.submitPublicReport(payload)`; else `api.submitIntake(text, meta)`. Bump IndexedDB version to 2 and handle old records (missing `kind` = `'intake'`). Also replay the `localStorage` fallback `reliefos-public-queue` (currently never replayed): on startup, move any items from it into IndexedDB.
3. **Delete `seedDemoQueue()`** and its call in `useQueue()`. It plants 3 fake reports in IndexedDB that are sent to the real backend on first reconnect. If you want a demo queue, only seed when `MOCK_MODE`.
4. Replay must be **strict FIFO**, **stop** on the first network error (do not mark the rest Failed), and auto-retry `Failed` items with back-off (e.g. 3 attempts) instead of skipping them forever. Treat HTTP 4xx (except 429) as permanent failure; 5xx/network/429 as retryable.
5. Expose queue length to the offline banner (already shown); also show it in the header chip (already).
**Done when:** (a) set browser offline, submit one coordinator message and one `/public` report, go online: backend shows one demand `source=coordinator verified=true` and one `source=public verified=false` with lat/lng + phone intact; (b) pressing Retry on a Failed item while the server is down leaves it in the queue; (c) a fresh profile shows 0 queued items.

#### B-04 [FE] Intake offline/online edge cases (P1)
`Intake.submitDemand` only queues when `navigator.onLine` is false. If the browser says online but the server is unreachable (hotspot with no uplink, **exactly the offline-box scenario**), it just shows an error and the text is lost on screen. On `res.status===0` (network error) queue the message exactly like the offline path. `navigator.onLine` is unreliable on a LAN hotspot, so also drive the "online" flag from `GET /api/health` polling (every 10 s) in `useConnectivity()`: `online = navigator.onLine && health.ok`.
**Done when:** with Wi-Fi up but Flask stopped, submitting a message shows "Saved, will send when connected" and the item appears in Offline Status.

#### B-05 [FE] Review Queue: send corrections to the API (P0 for product honesty)
The Review panel has editable item/qty/unit/beneficiaries/urgency/location fields, but **Approve calls only `verifyDemand(id)`; the edits are discarded.** Fix:
1. On Approve, if any field differs from the parsed value, first `POST /api/demands/<id>/correct {item_id, qty, unit, beneficiaries, urgency, location_text, notes}` then `POST /api/demands/<id>/verify`. (Backend task C-02.)
2. Use a **dropdown of canonical items** (from `GET /api/items`, or a hardcoded list `water/food/tent/blanket/medkit` mirrored from the backend dictionary) instead of a free-text Item box, so corrections cannot create an item the matcher can't match. This is the *only* place structured inputs are allowed.
3. Remove the fake defaults when a field is null: today a null qty is shown as `100`, item as `General Relief`, location `Punjab`, beneficiaries `100`. Show an empty field with a "not extracted" hint and **require** the coordinator to fill item + qty (or beneficiaries) before Approve is enabled.
4. Confidence threshold: FE and docs disagree (FE says 0.8, docs/08 section 4.1 says 0.7). **Use the server's `needs_review` flag only**; do not recompute in the UI. Change the copy "below 80%" to "flagged for review".
5. `ReviewQueue`'s tab "Needs Review" currently counts `needs_review || !verified`; keep, but critical-unverified must still be pinned first (already sorted; keep).
**Done when:** correcting qty 100 -> 600 and approving makes `GET /api/demands` return qty 600, `verified:true`, and an `edited`/`verified` audit entry.

#### B-06 [FE] Replace remaining hardcoded data with API data (P0/P1)
All of these are in `App.tsx`:
| Where | Hardcoded thing | Replace with |
|---|---|---|
| Dashboard, "Critical shortages" table | 4 fixed rows | `api.getShortages()` (top 4 by `shortage`) |
| Dashboard, map | `locations` + `moves[0]` from mockData | `api.getLocations()` + latest plan's selected move |
| AppShell nav | literal `7` badge on Review Queue | count of `needs_review || !verified` demands (lift into a shared `useDemands()` hook or context) |
| Dashboard `pendingReviews` sort | `sort((a,b)=> a.urgency==="critical" ? -1 : 1)` (invalid comparator) | proper comparator: critical first, then needs_review, then `report_count` desc |
| Needs page | "Top needed items" array, "Shortage overview" array, "Recent updates" array | compute top items from `demands` (sum of qty by item); shortages from `api.getShortages()`; recent updates from `api.getAudit()` (first 5) |
| Stock page | `depots` from mockData (list, counts, bar chart, selected depot `d1`) | derive depots from `api.getLocations()` filtered `type==='depot'` joined with `stock` by `depot_id`; default-select first depot; bar chart = real total units per depot |
| Stock stale badge | local 6 h select, not linked to plan warnings | keep select (configurable, default 6) **and** show a "Flagged by matching engine" tag when the lot's `id` is in the last plan's `warnings` (store last plan in a small shared store or call `GET /api/shortages`+plan) |
| Offline Status | "12 synced today", "Last sync 18 Oct 2026 10:28", whole "Sync history" table, "12 MB / 50 MB", Device ID `a3f1-...`, "v1.0.0" | keep a small local `syncLog` (IndexedDB store or localStorage) written by `replayQueue` (time, count, ok/fail); storage from `navigator.storage.estimate()`; device id = a UUID stored once in localStorage; remove anything you cannot compute |
| Dashboard/Needs "Backend sync: Auto-sync / Live API" KPI | static text | show last successful fetch time |
| Review "Location preview" map | `locations.filter(... \|\| l.id==="c17")` | the demand's resolved location from `getLocations()` by `camp_id`; if unresolved show "Location unresolved: set manually" (and let the coordinator pick a location in the correction panel) |
**Done when:** `grep -n "mockData" frontend/src/App.tsx` returns nothing, and `grep -n "Camp 17\|Drinking water" frontend/src/App.tsx` only matches placeholder/example strings.

#### B-07 [FE] Matching page fixes (P0)
1. **Approvals must survive a re-run.** `loadPlan()` is called on mount and after every approve/edit/reject. Because the server keeps state (D4/C-05) this works only if the backend returns persisted `state`. Confirm in testing; additionally **stop re-running the matcher after each action**: after approve/edit/reject just update that move's `state` from the response and re-fetch via a cheap `GET /api/plan/latest` (add in C-01) instead of `POST /match/run`. Keep "Re-run Matching" as the explicit button.
2. Replace `routeForMap` string-guessing (`stock_id.includes("d1")`) with real ids: the move carries `stock_id` and `demand_id`; the backend adds `origin_location_id` and `dest_location_id` to each move (C-04). The map draws from/to using those ids and `getLocations()`.
3. Add **weight sliders** (urgency / fill / proximity, sum shown, defaults 0.5/0.25/0.25) and an **algorithm toggle** (Greedy / LP) that call `runMatching({weights, algorithm})` (docs/08 section 7.4 and 5.2: "judges love this: change weights, see moves change"). **P1.**
4. Show `vehicle_id` as "No vehicle available" when `null`; show `trips`; show distance source label ("Straight-line x1.3 estimate" for `haversine`, "Road (OSRM)" for `osrm`).
5. KPI "Solver algorithm: Greedy Matrix / Haversine x 1.35 road factor" -> read `plan.algorithm` and use **1.3**.
6. Keep the Conflicts panel, stale-stock strip, shortages and surplus tables, but render the new Shortage/Surplus shapes (B-01): show `message` and `nearest_source`.
7. Wording audit: replace "Dispatch authorized", "assigned" with "Proposal approved"/"proposed".
**Done when:** approve a move, click Re-run Matching, and the move still shows APPROVED; changing the proximity weight changes the ranking.

#### B-08 [FE] Stop importing mock data into pages (P0)
`App.tsx` line 4 imports `demands, depots, inventory, locations, moves, reviewReports` from `./data/mockData`. Remove it. Pages get data only through `api.*`. `mockData.ts` is imported only by `api.ts`, only when `MOCK_MODE`.

#### B-09 [FE] `components/ReliefMap.tsx` fixes (P0 for offline check, P2 for Leaflet)
**P0:**
1. **Remove the hardcoded OSM tile URL** (`https://tile.openstreetmap.org/8/182/107.png`). It is a single fixed z8 tile stretched at 22% opacity (not a real tile layer), it hits OSM directly (violates their tile policy), and `scripts/check_assets.py` warns on it. For now render **no** online tile layer. The badge must read "Offline basemap" whenever no real tile layer is drawn, so it never claims "Online map" falsely.
2. **Guard the GeoJSON parser:** only draw features where `geometry.type === 'Polygon'` (use `coordinates[0]`) or `'MultiPolygon'` (loop). The REPO's `backend/offline/basemap.py` / `scripts/make_basemap_placeholder.py` generate a file with `Point` towns, and `run_offline.sh` regenerates it if the file is missing; today that crashes `coords.map is not a function` and `properties.district` is undefined. Also draw `Point` features as small town dots if you like.
3. Remove `(location as any)`; add `unverified?: boolean` to the map's location type.
4. Map must take **API data**: props `locations: Location[]` (from `getLocations()`), `demands` (to colour camps by max urgency and to set the amber ring for `!verified` demands), `route`/`moves`. Remove hardcoded `c8`/`c21` unverified rings and hardcoded district label positions (compute label positions from polygon centroids, or use the GeoJSON `district` property).
5. `fetch("/basemap/punjab_districts.geojson")` is fine (same origin). Make sure Flask serves `/basemap/...` from `frontend/dist/basemap` (C-08).
**P2 (D6 Phase 2): bundled Leaflet.** `npm i leaflet @types/leaflet`; import `leaflet/dist/leaflet.css` and **copy marker images into `src/assets` and import them** (Leaflet's default icon URLs break under Vite and would 404 offline; use `L.divIcon` or `L.circleMarker` instead to avoid images entirely). Layer 1: GeoJSON polygons (always). Layer 2: online tiles only when `VITE_MAPS_API_KEY` set **and** `/api/health.mode==='online'` **and** `navigator.onLine`; on first `tileerror`, remove the tile layer and flip the badge to "Offline basemap". Draw camps (circle by urgency colour, amber ring if unverified public), depots (squares), moves as polylines with popup (km, ETA, state) and click-through to the "Why this match" text. Never put the API key anywhere but `import.meta.env`; restrict it by referrer in the provider dashboard (keys in a Vite bundle are public).
**Done when (P0):** `grep -c "openstreetmap" frontend/dist/assets/*.js` is `0`, and the map renders with the REPO's placeholder GeoJSON **and** NEW-FE's GeoJSON without console errors.

#### B-10 [FE] Mode badge, offline banner, join page, README (P1)
1. **Mode badge** in the header from `GET /api/health`: "Online · Gemini+Rules" / "Offline · Rules". `check_offline.md` requires "UI badge reads 'Offline · Rules'".
2. **Offline banner** exact text (already present): "Works with zero internet on a local network. Internet adds AI parsing and chat-app intake." Show it when `online === false` **or** `health.mode === 'offline'` (the box is "offline" even though the LAN is up).
3. **Join page** (`#/join`, not in main nav; link from Offline Status): calls `GET /api/join`, renders `qr_svg` via `dangerouslySetInnerHTML` (it is server-generated SVG from `qrcode`; sanitise by checking it starts with `<svg`), shows the URL big. If `qr_svg` is null show the URL only.
4. `README.md`: rewrite: real API default, `VITE_MOCK_MODE=1` for demo mode, proxy, env vars, the offline rules, how to build and where Flask serves it, and the file layout.

#### B-11 [FE] Honesty labels (P1)
- Remove the permanent `SIMULATED DATA — DEMO ENVIRONMENT` ribbon. Show it only when `MOCK_MODE` **or** the backend reports a seeded scenario (`/api/health` may include `"scenario":"punjab_flood_sim"`). A simulation label is good for the pitch (data is synthetic); just don't show it when real data is in.
- `mock-label` div in `App()` shows "Mock data mode" only in mock mode (already). Keep.
- Provider labels: map `provider` -> "AI (Gemini)" / "Rules engine" / "AI unavailable, rules used" (for `gemini_failed`).
- Language chip: the backend currently does not return `language`; until C-03 does, hide the chip when missing instead of rendering `undefined`.

#### B-12 [FE] Make filters real or remove them (P1)
`Filters()` renders District/Camp/Item/Urgency/Status selects that do nothing and contain fixed options. Either wire them (options derived from loaded demands; filter the demand lists, map and KPIs) or delete the component. Recommended: wire District, Item, Urgency, Status on Needs Board and Dashboard (small shared hook).

#### B-13 [FE] Needs Board: Reject button (P1)
Spec: unverified rows get **Verify and Reject**. Needs Board has only Verify. Add Reject with a mandatory-reason inline input (reuse Review Queue's pattern); calls `api.rejectDemand`.

#### B-14 [FE] Public page polish (P1)
Check `PublicReport.tsx` against the brief: one textarea ("Describe what you need or what you see"), "📍 Share my location" (`navigator.geolocation`, fills `lat/lng`), optional free-text location, optional phone, success text "Your report was received. Relief teams have been notified." (the current text adds "and nearby depots"; keep or shorten, but **do not claim anyone was notified when the report was only queued**: the offline text "Saved, will send when connected" is correct), 429 -> "Too many reports, please wait a minute." No external fonts/images (verify `font-family` is a system stack, which it is). Add auto-retry on the `online` event (use the shared `replayQueue`, B-03). Note `navigator.geolocation` needs a secure context; on `http://192.168.x.x` it is **blocked by browsers**, so the button must fail gracefully ("Location unavailable on this connection. Type your location instead.") and the free-text location must remain usable. Don't present geolocation as working on the hotspot demo.
Also: `/public` must be reachable by path (`/public`) and hash (`#/public`). Flask needs an SPA fallback (C-08).

#### B-15 [FE] Typecheck, strictness, small bugs (P1)
- `tsc --noEmit` clean (ES2021 lib).
- No `any` for API data (`as any` in the map; `catch (err: unknown)` is fine).
- `useMemo` for `content` in `App()` lists deps `[page, online, queue.reports]` but pages are self-fetching; fine, but remove `useMemo` entirely to avoid stale closures.
- `StrictMode` double-invokes effects in dev; make sure `useQueue` seeding removal (B-03) makes that harmless.
- Keyboard accessibility: map markers have `role=button`; add Space handling. Low priority.
- Mobile: verify layouts at 360 px for `/public` and Intake.

---

### PART C: Backend and contract work (the REPO has no API server)

> **C-00 is a gate.** Ask the user whether Person 2's Flask app/DB exist elsewhere (another repo/branch). If yes, **merge these tasks into it instead of creating a second app**, and only build the pieces it lacks. If no, build the minimal version below. Everything must pass `pytest`, and `OFFLINE_MODE=1` must make no network calls.

#### C-00 [BE] Create the Flask app skeleton (P0, Person 2's area)
Create `backend/requirements.txt` (flask, sqlalchemy, flask-limiter optional, python-dotenv optional, rapidfuzz optional; **no Gemini package required offline** but list `google-genai` as optional), `backend/config.py` (`OFFLINE_MODE`, `DATABASE_URL` default `sqlite:///reliefos.db`, `STALE_HOURS=6`, `PORT`), `backend/models.py` (SQLAlchemy models per docs/08 section 3, trimmed, see C-02), `backend/app.py` (factory `create_app()`, registers blueprints, **`app = create_app()` at module level so `flask --app backend.app run` works**), `backend/seed/seed.py` with `--if-empty` (C-07).
`app.py` must: serve `frontend/dist` (static folder, `index.html` fallback for any non-`/api` path, so `/public` and deep links work); register `backend.offline.join.create_blueprint()`; set JSON `ensure_ascii=False` (Hindi text).
**Done when:** `OFFLINE_MODE=1 flask --app backend.app run` starts; `curl localhost:5000/api/health` returns `{"mode":"offline","providers":["rules"],"db":"sqlite"}`.

#### C-01 [BE] Implement the FE-contract endpoints + additions (P0)
Create `backend/api.py` (blueprint). Endpoints (JSON in/out; shapes in `frontend/src/types.ts` are the source of truth):

```
GET  /api/health                 -> {mode, providers, db, scenario?}
GET  /api/join                   -> from backend.offline.join (already written)
GET  /api/locations              -> Location[]          (camps + depots; NEW, needed by map/stock)
GET  /api/items                  -> [{item_id, name, unit, category}]   (NEW, for the correction dropdown)
GET  /api/vehicles               -> vehicles (optional)
GET  /api/demands                -> Demand[]            (include duplicates; FE groups them)
POST /api/intake                 {text, client_uuid?, client_created_at?} -> Demand      source=coordinator, verified=true
POST /api/public/report          {text, location_text?, lat?, lng?, phone?, client_uuid?, client_created_at?}
                                                          -> {id, status:"received"}     source=public, verified=false, 429 after 5/min/IP
POST /api/demands/<id>/correct   {item_id?, qty?, unit?, beneficiaries?, urgency?, location_text?, camp_id?, notes?} -> Demand   (NEW; audit "edited")
POST /api/demands/<id>/verify    -> {verified:true}    (audit "verified")
POST /api/demands/<id>/reject    {reason}  -> {verified:false, rejected:true}   (audit "rejected" or "rejected-public" if source=public)
GET  /api/stock                  -> SupplyLot[]
POST /api/supply/paste           {text} -> SupplyLot[]   (see C-06 parser)
POST /api/supply/csv             multipart "file" -> SupplyLot[]   (columns: item, qty, unit, depot_id, lat, lng)
POST /api/match/run              {weights?, algorithm?} -> PlanOutput    (D3: loads from DB)
GET  /api/plan/latest            -> PlanOutput (last run, with persisted move states)   (NEW)
POST /api/moves/<id>/approve     -> {state:"approved"}
POST /api/moves/<id>/edit        {qty?, notes?} -> {state:"edited"}
POST /api/moves/<id>/reject      {reason}  (reason required, else 400) -> {state:"rejected"}
GET  /api/audit                  -> AuditEntry[] newest first  {id,user,action,target_id,timestamp,notes}
GET  /api/shortages              -> Shortage[]   (from the latest plan)
```
**Idempotency (docs/08 section 9):** `POST /api/intake` and `/api/public/report` with the same `client_uuid` twice must return the **same** record and not create a second one (unique index on `client_uuid`; on conflict return the existing row with 200).
**Validation:** reject empty text, cap text at 2,000 chars, cap `/public/report` body at ~4 KB, return `{"error": "..."}` with the right status so the FE toast (`errorData.error || errorData.message`) works. 429 body `{"error":"Too many reports, please wait a minute."}`.
Replace the `HANDOFF.md` snippet: the `match_run` route now uses C-04's adapter, not `data["demands"]`.
**Done when:** a script `scripts/smoke_api.py` (write it) calls every endpoint in the list with the Flask test client and asserts status codes + required JSON keys.

#### C-02 [BE] Data model (P0)
Minimal SQLAlchemy models (SQLite and MySQL compatible types only):
- `Location(id str pk, name, type, lat, lng, district, population?)`
- `Item(id str pk "water", name "Water", unit, category, sphere_rate_per_person_day?)`
- `Demand(id, client_uuid UNIQUE, client_created_at, created_at, raw_text, item_id, qty, unit, beneficiaries, urgency, confidence, provider, needs_review, location_text, camp_id (FK Location.id nullable), source, verified, rejected, kind, language, duplicate_of, report_count, phone?, lat?, lng?)`
- `Stock(id, location_id, item_id, quantity, reserved, unit, updated_at)`
- `Vehicle(id, type, capacity_kg, current_location_id, speed_kmph, available)`
- `Move(id str pk "mv-<demand>-<stock>", demand_id, stock_id, vehicle_id, qty, km, eta_h, score, item_id, distance_source, trips, reason_json, explain, state, notes, plan_run_id, updated_at)`
- `Audit(id, user, action, target_id, timestamp, notes)`  (`user` = "Aastha Jha (Coordinator)" style label, or "public" for public rejects)
**Dedup/cluster rule** (spec: "30 reports from one area = 1 need with `report_count` 30"): on insert, if an existing non-rejected demand has the same `item_id` and `camp_id` (or same `location_text` normalised) created within the last 6 h, set the new row's `duplicate_of = parent.id` and `parent.report_count += 1`; the parent is the oldest one. Parent keeps the **max** urgency seen. FE already collapses `duplicate_of` rows under the parent.

#### C-03 [BE] `DemandDraft` -> API `Demand` adapter (P0)
In `backend/api_adapters.py` add `draft_to_demand(draft, *, source, verified, client_uuid, client_created_at)`:
- `item_id = draft.item`, `item = ITEMS[item_id].name` (display name, e.g. "Water"), `qty`, `unit` (default from item dictionary if `None`), `urgency` lowercase, `confidence`, `provider` (map `gemini_failed` as is), `needs_review`.
- `camp_id`: canonical `camp17`; look it up in `locations`. If missing, **create nothing**; leave `camp_id=null`, `location_text="camp 17"`, `needs_review=True`.
- `language`: `'hi'` if any char in `ऀ-ॿ`; `'hinglish'` if Latin text contains any word from a small Hinglish list (`paani, pani, khana, kambal, dawai, turant, jaldi, log, chahiye, bhejo, hain`); else `'en'`.
- `kind='demand'` (supply goes through `/supply/*`).
- Public submissions: `verified=False`, **always** `needs_review=True` regardless of confidence (not yet human-seen), `source='public'`. The public text is extracted with the same chain; **never discard the raw text**.
- Coordinator intake: `verified=True` but still `needs_review` if confidence is below the threshold (C-09 sets 0.7 for rules).
Return exactly the `Demand` TS type.

#### C-04 [BE] Matching adapter + explain/conflicts/warnings (P0, Person 4's area)
New file `backend/matching/explain.py` (pure functions, no network) and the adapter in `api_adapters.py`. **Do not edit `greedy.py/scoring.py/engine.py`** (tests are green); wrap them.

1. **Build matcher inputs from DB rows:**
   - demands: only `kind=='demand' and verified and not rejected and not needs_review_unresolved and duplicate_of is None`. `quantity_needed = qty`, **or** if `qty is None` and `beneficiaries` is set and the item has a Sphere rate: `beneficiaries * rate` (water 15 L/person/day, per README/docs 4.2.5). `urgency = urgency.upper()`. `lat/lng` from the camp `Location` (or demand's own lat/lng if public with GPS). `location_id = camp_id`. `district` from location. `client_created_at` from the row (**so waiting time is real**). Subtract already-approved quantities via `fulfilled`.
   - stock: `{id, location_id: depot id, item_id, quantity, reserved, lat, lng, name: depot name}`.
   - vehicles: from DB (or `None` = unconstrained). `item_kg` from the item dictionary if available (default 1.0).
   - `item_names`, `location_names` from the dictionaries.
2. Call `engine.plan(...)`.
3. **Post-process** `plan_for_ui(raw, demands, stock, move_states, now)`:
   - **Move id** = `f"mv-{demand_id}-{stock_id}"`; `state` = persisted state if the same id exists (D4), else `"pending"`; if `qty` was edited, keep the **edited qty** and recompute nothing else. Add `origin_location_id`, `dest_location_id` (look up from stock/demand).
   - **`explain`** (string; one sentence): e.g. `"Truck-2 -> Camp 17: Ludhiana Depot is the best-scoring source (59.8 km, straight-line estimate), CRITICAL urgency, covers 100% of the request."` Build from `rec.reason` (`urgency, fill, proximity, wait_h, vehicle`) plus names. Include "no vehicle available" when `vehicle_id is None`.
   - **`conflicts`**: for each `item_id` where the sum of open demand (`remaining_qty`) across >= 2 demands exceeds the sum of available stock (`quantity - reserved`) of that item, emit `{item, camps_competing: ["Camp 17 (CRITICAL)", "Camp 21 (CRITICAL)", ...], winner: "<camp name of the demand that received the largest allocation, ties broken by the matcher's own order>", reason}` where `reason` states the ranking basis from the matcher (urgency level, waiting hours, distance) and what the others got, e.g. `"Camp 17 ranked first (CRITICAL, waited 3.0 h, 59.8 km). Camp 21 received 200 of 500 requested; Camp 6 received 0."` This powers the "three camps, one truck" demo moment. Derive winners **from the real allocation**, never hardcode.
   - **`warnings`**: for every stock row used in a recommendation (and optionally every stock row) with `age_hours = (now - updated_at)/3600 > STALE_HOURS`: `{stock_id, item, age_hours (1 dp), message: "Stock at <depot> updated <x> h ago. Verify before dispatch."}`.
   - **`shortages`** to FE shape: `{item: item_name, item_id, district, shortage: short_qty, requested: sum(quantity_needed of demand_ids), available: sum(stock qty - reserved for that item), camp?: name if one demand, message, nearest_source}`.
   - **`surplus`** to FE shape: `{item: item_name, item_id, qty: leftover_qty, depot: name, stock_id, no_demand, message}`.
   - `algorithm`, `distance_sources` pass through.
4. Persist the Move rows and the plan so `GET /api/plan/latest` and `GET /api/shortages` read them.
5. **Tests** (add to `backend/tests/test_api_adapters.py`): (a) the 3-camps-1-stock fixture from Section 6 produces exactly one conflict whose winner is the CRITICAL camp; (b) stale stock produces a warning; (c) `explain` contains the destination name and distance source; (d) deterministic move ids are stable across two runs; (e) `vehicles=[]` gives `vehicle_id None` and the explain says so. Use `no_network`.
**Done when:** `pytest` is green, and `POST /api/match/run` returns all of `recommendations[*].{id,explain,state}`, `conflicts`, `warnings`, `shortages`, `surplus`.

#### C-05 [BE] Move state machine + stock reservation (P0)
- `approve`: `state='approved'`, `Stock.reserved += qty` (so a later re-run does not promise the same stock twice; the matcher already subtracts `reserved`), `Demand.fulfilled += qty`, audit `approved`.
- `edit {qty, notes}`: `0 < qty <=` available; `state='edited'`; audit `edited` with notes. Editing an approved move adjusts `reserved` by the delta.
- `reject {reason}` (**required, 400 if blank**): `state='rejected'`; store the pair in a small exclusion set so the **next run does not re-propose the same stock->demand pair**; audit `rejected` with the reason.
- Re-running keeps `approved/edited/rejected` states and only (re)creates `pending` proposals for the remaining need.
**Done when:** approve -> re-run -> the same move is still `approved`, and the remaining proposals no longer double-count its quantity.

#### C-06 [BE] Supply parsing: `/supply/paste` and `/supply/csv` (P0)
- CSV: `item,qty,unit,depot_id,lat,lng` (as the UI says). Match `item` against item aliases (case-insensitive); unknown item -> 400 with the row number. Upsert on `(depot_id, item_id)`; set `updated_at = now`.
- Paste: free text such as `"Warehouse A: 2000 water bottles, 500 blankets, 1 truck free"` or `"Ludhiana Depot: 5000 litres drinking water available immediately"`. Rules parser: split on `:` for the depot name (fuzzy-match against depot `Location.name`/gazetteer, case-insensitive), then `(\d+)\s*(unit words)?\s*(item alias)` pairs separated by commas/"and"/newlines; `"N truck(s)"` creates/updates a `Vehicle`. If the depot cannot be resolved, return 422 `{"error":"Depot not recognised: <name>. Known depots: ..."}` (FE shows it as a toast). Never invent coordinates.
- Always return the **created/updated** `SupplyLot[]` including `item` (display name), `item_id`, `updated_at` (ISO UTC).

#### C-07 [BE] Seed scenario (P0 for demo)
`backend/seed/seed.py --if-empty` loads a Punjab-flood scenario: ~5 depots with real coordinates (reuse `gazetteer.json` / `basemap.py TOWNS`), **camps with coordinates** (the gazetteer has none; camps 3, 4, 6, 8, 9, 12, 17, 21 near the districts used in the mock: Camp 17 Gurdaspur, Camp 4 Firozpur, Camp 8 Hoshiarpur, Camp 12 Ludhiana, Camp 21 Patiala, Camp 3 Amritsar, Camp 9 Sangrur, Camp 6 Jalandhar), items (5 canonical + display names + units), stock with a mix of fresh and **one stale** `updated_at` (to demo the warning), 2-3 vehicles, a few demands including **one scarce item competing across 3 camps** (the "three camps, one truck" moment) and one unverified public report. `POST /api/admin/seed/reset` calls the same function. Mark the scenario as synthetic in `/api/health` (`"scenario":"punjab_flood_sim"`), which lets the FE show the "simulated data" label honestly.

#### C-08 [BE] Serve the frontend + health + limits (P0)
- Static: serve `frontend/dist`; `GET /<path>` falls back to `index.html` unless it starts with `api/`. `/basemap/punjab_districts.geojson` is served from `dist/basemap/`.
- `/api/health`: `mode = "offline" if OFFLINE_MODE=="1" else "online"`, `providers = ["rules"]` offline, else `["gemini","rules"]` if a key exists else `["rules"]`, `db` from `DATABASE_URL`.
- Rate limit: `/api/public/report` 5/min per IP (Flask-Limiter with in-memory storage, or a 15-line dict-based limiter so there is no extra dependency). Behind the hotspot every phone has a different IP; behind a proxy use `X-Forwarded-For` only if configured.
- No CORS needed (same origin in prod; Vite proxy in dev). If you add `flask-cors`, restrict to the dev origin.
- Security basics from docs/08 section 9: parameterised queries (SQLAlchemy), input size limits, API keys only from env.

#### C-09 [BE] Extraction fixes: the demo sentence currently FAILS (P0, Person 3's area, **flag to the user**)
Verified by running `backend.extraction.chain.extract` with `OFFLINE_MODE=1`:

| Input | Actual | Expected |
|---|---|---|
| `Camp 17 needs drinking water for approx 600 people, urgent` | `item=None, qty=None, beneficiaries=600, urgency=high, confidence=0.33` | `item=water, beneficiaries=600, urgency=critical (see rule below)` |
| `Camp 4 needs 200 waterproof tents immediately for newly displaced families` | `item='water'` (!), qty 200, confidence 1.0 | `item=tent, qty=200, urgency=high` |
| `Camp 8 ke paas log beemar hain please medical kits bhejo turant` | `item=None` | `item=medkit, urgency=high` |
| `Camp 21 paani bilkul khatam ho chuka hai 300 log hain urgent` | `item=None, beneficiaries=300` | `item=water, beneficiaries=300, urgency=high/critical` |
| `pani 600 log camp 17` | `item=water, qty=600` (qty is the **people count**) | `item=water, qty=None, beneficiaries=600` (qty derived via Sphere = 9,000 L) |

Root causes in `backend/extraction/providers/rules.py`:
1. Item matching requires a number **adjacent** to the alias (`(\d+)\s+alias` or `alias\s+(\d+)`), so "drinking water for approx 600 people" never matches. **Fix:** match the item alias on its own (word boundary), and take quantity separately: a number adjacent to the item (not followed by `log|people|persons|families`) is `qty`; a number followed by those words is `beneficiaries` only.
2. `\balias` has no word boundary on the right, so `"200 waterproof"` matches alias `water`. **Fix:** use `\b` on both sides. Also the comment says aliases are "sorted longest-first" but `ALIASES` lists them unsorted; sort each list by length descending, **and iterate items so that the item with the longest matched alias wins**, not the first dict key.
3. Add Hinglish/Hindi aliases that appear in the demo set (`beemar` -> medical context, `medical kits`, `paani`, Devanagari `पानी`, `खाना`, `कंबल`, `दवा`, `टेंट`). Keep it small and tested against the gold set.
4. Confidence: docs/08 section 4.1 says rules confidence is **capped at 0.65 so every rules record goes to review**; the code returns 1.0 with `needs_review=False` when item+qty+camp are found. Decide with the owner: the judge-friendly behaviour is *"offline records always land in review; one approve click"* (docs/08 4.2, step 8). **Recommended:** cap at 0.65, `needs_review=True` for `provider=='rules'`. Then update the tests that assume otherwise only if they assert `needs_review` (the current 10 parametrised cases assert item/qty/camp/urgency only, so they stay green).
5. Urgency: current map makes `urgent` -> `high`; the product example shows `urgent` -> `Critical`. Minimal rule that **does not break the existing test** (`"Camp 17 needs 600 water urgently"` must stay `high`): if item in `{water, medkit}` **and** an urgency keyword is present **and** `beneficiaries >= 500` -> `critical`. Document the rule in a code comment and in docs/08 4.2 step 6.
6. `unit`: set from the item dictionary when `None` (water -> litres, food -> packets, tent -> units, blanket -> units, medkit -> kits).
7. `GeminiProvider`: timeout is 10 s but docs say 3 s; set `timeout=3000`. Add `unit` and `language` to the prompt/JSON. Ensure it is never constructed when `OFFLINE_MODE=1` (chain already does this).
8. Create the missing dictionary files **or** `check_assets.py` will keep failing: `backend/extraction/dictionary/items.json` (`{"item_id","name","unit","category"}` rows for the 5 canonical items) and `units.json`.
**Add tests** to `backend/tests/test_extraction.py` for every row above (parametrised). **Done when:** all rows in the table pass and the old 10 cases still pass.

#### C-10 [BE] `HANDOFF.md` + `docs/08` update (P1)
Record the contract additions (`/api/locations`, `/api/items`, `/api/plan/latest`, `/api/demands/<id>/correct`, `client_uuid` fields), the corrected `match_run` snippet, and the extraction rule changes.

---

### PART D: Integration, packaging and verification

#### D-01 [OPS] Build and wire it (P0)
```bash
cd frontend && npm install && npm run typecheck && npm run build   # produces frontend/dist
cd .. && pip install -r backend/requirements.txt -r backend/requirements-matching.txt
python scripts/check_assets.py        # target: 0 failures; read each [WARN]
OFFLINE_MODE=1 python -m pytest -q    # 35+ tests green
SKIP_CHECKS=0 ./scripts/run_offline.sh  # app + API on one port, prints URL + QR
```
Then open the printed URL from a second device on the same hotspot.
**Done when:** Network tab shows **zero** requests to any host except the LAN address; `check_assets.py` prints "no CDN or public-tile URLs found in the build".

#### D-02 [OPS] Dev mode with hot reload (P1)
Terminal 1: `OFFLINE_MODE=1 flask --app backend.app run --port 5000`. Terminal 2: `cd frontend && PORT=5173 npm run dev` (proxy forwards `/api`). For frontend-only demos: `VITE_MOCK_MODE=1 PORT=5173 npm run dev`.

#### D-03 [OPS] Acceptance test: merged checklist (P0)
**Owner's acceptance list (from `PROMPT_AASTHA_FRONTEND.md`) plus `scripts/check_offline.md`.** Tick each; record failures.

- [ ] Field Intake has **no** structured inputs: one textbox + bulk-paste + Supply tab
- [ ] `Camp 17 needs drinking water for approx 600 people, urgent` -> chips `Water | 600 people (or 9,000 L) | CRITICAL | Camp 17`, confidence bar, provider badge, language (needs C-09)
- [ ] A low-confidence message lands in the Review Queue; correct a field, Approve -> API call, saved; Reject without reason is blocked; with reason it hits the API and shows in audit
- [ ] Supply by pasted text and by CSV; stale badge appears for an old `updated_at`; matches the plan's warning
- [ ] `/public` works on a phone: text, location button (graceful failure on plain HTTP), optional phone, success screen, 429 message after 6 quick submits
- [ ] Public report appears on coordinator pages as "⚠ Unverified"; **Verify** moves it into matching; **Reject** requires a reason
- [ ] 30 near-identical reports produce one need with a "30 reports" badge (use a script to POST 30 times)
- [ ] Critical items are pinned to the top everywhere, even when unverified
- [ ] Matching shows proposals with Approve / Edit / Reject (+reason), a "Why this match" panel, a Conflicts panel ("three camps, one truck"), stale-stock warnings, shortages and surplus; wording says "proposed"
- [ ] Approving a move shows in Recent Activity (audit) without a page reload; approvals survive "Re-run Matching"
- [ ] Map shows depots, camps (urgency colours), amber ring for unverified, move routes with km/ETA; with Wi-Fi/Internet off it still renders (placeholder GeoJSON **and** the 9-district GeoJSON) with no console errors
- [ ] Wi-Fi off, submit a report: queued; reconnect: synced **in order, exactly once**; double-send of the same `client_uuid` creates one record
- [ ] Offline banner has the exact wording; header badge reads "Offline · Rules" on the box
- [ ] Review the 150-message gold set accuracy per provider if time (README step 5)
- [ ] `npm run build` OK, `tsc` clean, `pytest` green, `check_assets.py` 0 failures, **no external requests offline**
- [ ] Phone on hotspot opens the QR URL (not `reliefos.local`); mobile layouts OK at 360 px

#### D-04 [OPS] Offline pack (P1)
Run `scripts/build_offline_pack.sh` **with internet before the event** (needs `package-lock.json`, `backend/requirements.txt`); copy `offline-pack/` to the USB along with the repo, a licence-checked district GeoJSON, Tesseract + Hindi data (optional).

#### D-05 [OPS] Pitch honesty (P1)
Slides/demo must not claim: "fully offline AI", live WhatsApp/SMS intake (it is a paste box; roadmap), road routing offline (straight-line x1.3, labelled), a verified GeoJSON (until the licence is checked), or "notified" when a report was only queued. Data on screen is a **synthetic Punjab-flood scenario**; label it.

---

## 5. Task order and dependencies

```
A-01 -> A-02 -> (A-03 later, A-04 any time)
B-01 -> B-02 -> B-08 -> B-03 -> B-04 -> B-05 -> B-06 -> B-07 -> B-09 -> B-10..B-15
C-00 -> C-02 -> C-03 -> C-09 (parallel) -> C-01 -> C-04 -> C-05 -> C-06 -> C-07 -> C-08 -> C-10
Frontend can be developed against VITE_MOCK_MODE=1 until C-01 exists; integrate at D-01.
```
Parallelisable by person: **Frontend** (B-*), **Backend/API** (C-00..C-03, C-05..C-08), **Matching/extraction** (C-04, C-09), **Ops** (A-*, D-*).

---

## 6. Reference appendix

### 6.1 Test fixture: "three camps, one truck" (use in C-04 tests and the seed)
```python
demands = [
 {"id":"d17","item_id":"water","quantity_needed":600,"urgency":"CRITICAL","lat":32.04,"lng":75.40,"location_id":"camp17","district":"Gurdaspur","client_created_at":"<now-3h>"},
 {"id":"d21","item_id":"water","quantity_needed":500,"urgency":"CRITICAL","lat":30.34,"lng":76.39,"location_id":"camp21","district":"Patiala","client_created_at":"<now-1h>"},
 {"id":"d06","item_id":"water","quantity_needed":450,"urgency":"HIGH","lat":31.33,"lng":75.58,"location_id":"camp6","district":"Jalandhar","client_created_at":"<now-5h>"},
]
stock = [{"id":"s1","location_id":"ludhiana-depot","item_id":"water","quantity":800,"lat":30.90,"lng":75.86,"name":"Ludhiana Depot"}]
vehicles = [{"id":"truck-1","capacity_kg":2000}]
# expected: 1 conflict item=water, 3 camps competing, winner = camp17 or camp21 (by matcher order), others partially/un-served -> shortage
```
(I ran a 2-demand version of this by hand: the matcher gave the CRITICAL camp all 600, the HIGH camp 200 of 500, and reported a 300 shortage in Firozpur. The adapter must turn that into a conflict + shortage.)

### 6.2 Field mapping (backend -> API `Demand`)
| API field | Source |
|---|---|
| `id` | DB id (uuid) |
| `item` | `ITEMS[draft.item].name` (e.g. "Water") |
| `item_id` | `draft.item` (`water/food/tent/blanket/medkit`) |
| `qty`, `unit` | `draft.qty`, `draft.unit` or dictionary default |
| `location_text`, `camp_id` | `draft.location_text`, canonical `camp17` |
| `beneficiaries` | `draft.beneficiaries` |
| `urgency` | `draft.urgency` (lowercase) |
| `confidence`, `provider`, `needs_review`, `raw_text` | `draft.*` |
| `source`, `verified` | endpoint (`coordinator/true` or `public/false`) |
| `kind` | `"demand"` |
| `language` | detected (C-03) |
| `duplicate_of`, `report_count` | C-02 clustering |

### 6.3 Urgency casing
API/UI: lowercase `critical|high|medium|low`. Matcher: UPPERCASE. Convert **only** in the adapter (`.upper()` in, `.lower()` out).

### 6.4 Env vars
| Var | Where | Meaning |
|---|---|---|
| `OFFLINE_MODE=1` | backend | no network calls; Gemini removed; no public OSRM |
| `DATABASE_URL` | backend | default `sqlite:///reliefos.db` |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | backend only | Gemini; never in the frontend |
| `OSRM_URL` | backend | optional local OSRM |
| `RELIEFOS_HOST_IP` | backend | force the IP shown in the QR |
| `STALE_HOURS` | backend | default 6 |
| `VITE_API_URL` | frontend | default `/api` |
| `VITE_MOCK_MODE=1` | frontend | mock data fallback (demo backup only) |
| `VITE_MAPS_API_KEY` | frontend | online tiles key (public in the bundle; restrict by referrer) |

### 6.5 Known risks to tell the user
1. The **Flask app/DB may exist with Person 2**; confirm before building C-00/C-02 so work isn't duplicated.
2. `navigator.geolocation` and service workers need a **secure context**; they will not work over `http://<LAN-IP>`. IndexedDB queueing does.
3. The 9-district GeoJSON in NEW-FE has **unknown provenance/licence**; the REPO's `basemap.py` warns about exactly this.
4. Rules-based extraction is weak on free-form Hinglish; the offline demo should use messages the rules handle, and the rest must land in review. Run the gold set.
5. Code freeze was 29 Oct: land the P0 list on a branch, test it on a clean machine with Wi-Fi off, and keep the **mock-mode build** as a backup demo.
6. Keep `prototype/frontend_old` and a tagged commit of the current state until the demo is over.

### 6.6 Files touched summary (for the PR description)
- **Added:** `frontend/` (NEW-FE), `backend/app.py, config.py, models.py, api.py, api_adapters.py, requirements.txt`, `backend/matching/explain.py`, `backend/seed/seed.py`, `backend/extraction/dictionary/{items,units}.json`, `backend/tests/test_api_adapters.py`, `scripts/smoke_api.py`.
- **Modified:** `backend/extraction/providers/{rules,gemini}.py`, `backend/tests/test_extraction.py` (new cases only), `HANDOFF.md`, `docs/08_tech_stack_architecture.md` (API table).
- **Moved (not deleted):** `prototype/frontend` -> `prototype/frontend_old`.
- **Not touched:** `backend/matching/{greedy,scoring,shortages,optimise,engine}.py`, `backend/routing.py` (tests stay green).

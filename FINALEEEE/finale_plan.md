# 🚑 ReliefOS: Finale Plan v3 (30–31 Oct, Chandigarh University)

> Coordinator-side decision engine. Messy field report (Hinglish, WhatsApp-style) → structured demand → stock matched → dispatch **proposal** a human approves. Works on a local network with zero internet; AI parsing and Telegram are online bonuses. 📴
>
> **One-line USP:** *"WhatsApp chaos in, dispatch plan out."*

**Team Koshish:** Navya · Ridhima · Aastha · Khushali
**Window:** 30 Oct 9 AM → 31 Oct 9 AM IST
**Status as of:** 30 Oct, 09:07 (H0). Prep night is over; this plan starts from the verified repo state in section 1.

---

## 🧭 0. What changed from v2

v2 assumed the frontend only needed small additions and that the API was "route stubs". The frontend integration review showed the real gap is bigger, so v3 re-plans around it.

| Topic | v2 | v3 |
|---|---|---|
| Frontend | Old mock-only frontend, add Edit/Reject, badges, public page | **Swap in the reworked frontend (NEW-FE)**: ~2,450-line `App.tsx`, `PublicReport.tsx`, typed API client, IndexedDB queue, SVG map. Then fix its bugs (task list in section 4) |
| Flask API | Route stubs, "blocks everything" | **No Flask app exists** (`app.py`, `models.py`, `config.py`, `api.py`, `requirements.txt` all missing; only `/api/health` and `/api/public/report` live inside `routing.py`). Build it, with a hard gate in H0–H1 |
| API contract | Shapes to be agreed at standup | **Locked: the frontend contract is canonical.** Backend adapts to it, not the reverse. All translation lives in `api_adapters.py` + `matching/explain.py` |
| Matching changes | `explain()` inside `greedy.py` / `engine.py` | **Do not edit** `greedy/scoring/engine/shortages`. Wrap them: `explain`, `conflicts`, `warnings`, move ids and states are added by the adapter (35 tests stay green) |
| Mock data | Mock fallback in the UI | **No silent mock fallback.** Mock only when `VITE_MOCK_MODE=1`, with a visible label. A dead backend must look dead, not alive |
| Extraction | "Needs alias loading, Hinglish" | **The headline demo sentence currently fails** (`item=None`). Rules-parser fixes are now a P0 task (C-09) |
| Review Queue | Approve / reject | **Approve must send the coordinator's corrections** (today the edits are discarded). Item field becomes a dropdown of canonical items |
| Offline queue | IndexedDB queue exists | **Two data-loss bugs** to fix first: Retry deletes reports without sending; queued public reports get replayed as verified coordinator reports |
| Confidence threshold | 0.8 | UI trusts the server's `needs_review` flag only. Rules provider capped at 0.65 so every offline record lands in review (see open decision O1) |
| Phone test | Single note | Geolocation is **blocked on `http://192.168.x.x`**; the button must fail gracefully, and the demo must not claim it works |
| Pitch | 5-question defence | Add: say "protects critical needs first", **never** "better coverage overall" (see section 10) |

---

## 📊 1. Where we stand (30 Oct, 09:07, verified)

| Area | Status | Notes |
|---|---|---|
| 🧮 Matching engine (score, greedy, LP, shortages) | ✅ Done | **35 tests pass.** Output has no move `id`, `explain`, `state`, `conflicts` or `warnings`; the adapter adds them |
| 🗺️ Geo-routing (haversine ×1.3) | ✅ Done | Keep `routing.py` as the pure distance module the matcher imports |
| 📴 Offline node (/api/join, QR, basemap check) | ✅ Done | Basemap is a placeholder; label it |
| 🔤 Extraction chain (Gemini → rules) | ⚠️ Works, but buggy | Fails the demo sentence; `waterproof` matches `water`; item needs an adjacent number; `urgent` → high; rules confidence 1.0 skips review |
| 📚 `items.json`, `units.json` | ✅ Exist | `items.json` is a dict keyed by item id (`water, food, tent, medkit, blanket`). Use as is, do not recreate |
| 📚 `gazetteer.json` | ⚠️ 8 districts only | **No camps with coordinates.** Camps must be added (seed task) |
| 📚 `dedupe.py`, `seed/messages.json`, `seed/supply.json` | ❌ Empty placeholders | Still to write |
| 🌐 Flask API | ❌ Not built | Only two routes in `routing.py`. `flask --app backend.app` fails. **Critical path** |
| 🎨 Frontend in repo | ⚠️ Still the OLD 330-line mock frontend | NEW-FE is built (builds, ~313 kB) but not yet swapped in; it has bugs and hardcoded tables |
| 🌍 Public report page | ⚠️ Exists in NEW-FE only | Not in the repo yet |
| 📱 Phone test (hotspot → QR → report) | ❌ Never run | Highest demo risk |
| 🖨️ Tesseract OCR | ❌ Not installed | Install or drop from the pitch (decide by H12) |

**Pitch fact from `simulation_results.json`:** ReliefOS beats the naive baseline on **critical coverage (100% vs 68.2%)** and critical ETA (−29%). Overall coverage is lower (70.5% vs 73.2%) and total km is 28.8% higher. Always say "protects critical needs first".

---

## 🔒 2. Decisions locked (do not re-debate)

| # | Decision |
|---|---|
| D1 | The frontend API contract (`api.ts` / `types.ts`) is canonical. `docs/08` section 6 gets updated to match |
| D2 | Backend adapts to frontend shapes in **one place**: `backend/api_adapters.py` + `backend/matching/explain.py`. Tested matcher and extractor stay untouched |
| D3 | `POST /api/match/run` loads demands, stock and vehicles **from the DB**. Body carries only `{weights?, algorithm?}` |
| D4 | Move ids are deterministic: `mv-{demand_id}-{stock_id}`. State (`pending / approved / edited / rejected`) is persisted and re-applied after every re-run |
| D5 | **No structured intake form** on the coordinator Intake page. Free text in, structure out. The Review Queue correction panel is the only place structured inputs are allowed |
| D6 | Map: keep the SVG + local GeoJSON map. Bundled Leaflet is P2, only if time remains |
| D7 | Frontend lives at `frontend/` (scripts and `basemap.py` expect it). Old frontend is kept as `prototype/frontend_old/` and is not deleted |
| D8 | Mock data only behind `VITE_MOCK_MODE=1`. In real mode a failed call shows an error state with Retry |
| D9 | Item names come from the backend dictionary; ids are the backend's (`camp17`, `ludhiana-depot`). The frontend never hardcodes ids |

**Product rules judges will test:** input is free text; `OFFLINE_MODE=1` makes zero network calls (no CDN fonts, icons or tiles); the frontend never calls Gemini; every state change goes to the backend then refreshes; wording is "proposed / approve", never "assigned / dispatched"; critical items are pinned to the top even if unverified; distance source is always labelled (straight-line ×1.3 vs road).

**Required offline banner text, exactly:** *"Works with zero internet on a local network. Internet adds AI parsing and chat-app intake."*

---

## 👭 3. Team split

| Person | Role | Owns |
|---|---|---|
| 🔤 **Navya** | Extraction + data | `backend/extraction/` (rules fixes C-09, `dedupe.py`, chain), `draft_to_demand` adapter (C-03), dictionaries, gazetteer + camp coordinates, `seed/messages.json`, `seed/supply.json`, extraction tests |
| 🧮 **Ridhima** | Matching + lead | `matching/explain.py` + plan adapter (C-04), three-camps fixture and tests, seed scenario (C-07), phone test, build/assets checks (D-01), final demo |
| 🎨 **Aastha** | Frontend + pitch | Frontend swap (A-02) and all B-tasks, `PublicReport.tsx`, offline queue fixes, map fixes, slides, backup video |
| 🌐 **Khushali** | Flask API + deploy | Flask skeleton (C-00), models (C-02), endpoints (C-01), move state machine (C-05), supply parsing (C-06), static serving + rate limit (C-08), audit log, Render deploy, README |

Task ids (A-, B-, C-, D-) refer to the integration plan.

---

## ⚡ 4. Task board

Priority: **P0** demo-breaking · **P1** should have · **P2** nice to have.

### Part A: File swaps (Aastha, first 30 min)
| ID | Task | Pri |
|---|---|---|
| A-01 | **No-op.** `frontend/` already exists at the repo root. Skip moving to `prototype/frontend_old` | – |
| A-02 | Replace `frontend/src` with NEW-FE files (`App.tsx`, `ReliefMap.tsx`, `PublicReport.tsx`, `types.ts`, `api.ts`, `reportQueue.ts`, `mockData.ts`, `index.css`), its 9-district GeoJSON, `vite.config.ts` (adds `/api` proxy) and `tsconfig.json` (lib ES2021). Keep the existing `package-lock.json` (npm, since `build_offline_pack.sh` uses `npm ci`). Add `.env.example` and `!.env.example` to `.gitignore` | P0 |
| A-03 | Cleanup: move (do not delete) `pnpm-lock.yaml`; remove legacy helpers in `api.ts` and `seedDemoQueue()` | P1 |
| A-04 | Update `docs/08` API table and the `HANDOFF.md` Flask snippet (the old `data["demands"]` snippet would KeyError) | P1 |

### Part B: Frontend fixes (Aastha)
| ID | Task | Pri |
|---|---|---|
| B-01 | Extend `types.ts` to the real backend shapes (`item_id`, `Location`, new `Shortage` / `Surplus`, `Health`, `JoinInfo`, `client_uuid`) | P0 |
| B-02 | `api.ts`: remove silent mock fallback, add `getHealth / getLocations / getJoin`, send `client_uuid` + `client_created_at`, `runMatching` sends only `{weights, algorithm}`, **add a `<ToastHost/>`** (toasts currently fire into nothing), ratio text 1.35 → **1.3** | P0 |
| B-03 | `reportQueue.ts`: **Retry must really send and only remove on success**; store `kind: 'intake' \| 'public'` + full payload so public reports stay unverified on replay; delete `seedDemoQueue()`; strict FIFO, stop on first network error, back-off retries; replay the old `localStorage` queue | P0 |
| B-04 | Intake queues on network error too (not just `navigator.onLine === false`); drive "online" from `/api/health` polling every 10 s | P1 |
| B-05 | Review Queue: **Approve sends corrections** (`/correct` then `/verify`); item = dropdown of canonical items; remove fake defaults (`100`, `General Relief`, `Punjab`); require item + qty or beneficiaries before Approve; use the server's `needs_review`, not a recomputed threshold | P0 |
| B-06 | Replace hardcoded data with API data (shortages, nav badge, Needs page lists, Stock depots, Offline Status numbers, review location map). **Done when** `grep -n mockData frontend/src/App.tsx` returns nothing | P0/P1 |
| B-07 | Matching page: approvals survive a re-run (use `GET /api/plan/latest` after actions), real `origin/dest_location_id` for routes, **weight sliders + Greedy/LP toggle**, "No vehicle available" for `null`, distance-source label, "proposed" wording | P0 (sliders P1) |
| B-08 | Remove the `mockData` import from `App.tsx` | P0 |
| B-09 | `ReliefMap.tsx`: **remove the hardcoded OSM tile URL**, guard the GeoJSON parser (`Polygon` / `MultiPolygon` only, `Point` as dots), take camps/depots/routes from API data, badge says "Offline basemap" unless a real tile layer is drawn. Leaflet = P2 | P0 |
| B-10 | Mode badge from `/api/health` ("Offline · Rules" / "Online · Gemini+Rules"), exact offline banner, `#/join` QR page | P1 |
| B-11 | Honesty labels: SIMULATED DATA ribbon only in mock mode or when `/api/health` reports the scenario; provider labels; hide the language chip when missing | P1 |
| B-12 | Wire the Filters (District, Item, Urgency, Status) or delete them | P1 |
| B-13 | Needs Board: add **Reject** with a mandatory reason | P1 |
| B-14 | Public page: graceful geolocation failure on plain HTTP ("Location unavailable on this connection. Type your location instead."), 429 message, never claim "notified" when only queued, auto-retry on the `online` event, reachable at `/public` and `#/public` | P1 |
| B-15 | `tsc --noEmit` clean, no `any` on API data, 360 px mobile check | P1 |

### Part C: Backend (Khushali, Navya, Ridhima)
| ID | Task | Owner | Pri |
|---|---|---|---|
| C-00 | **Gate (H0–H1): confirm no Flask app exists elsewhere** (verified: it does not). Build `requirements.txt`, `config.py`, `models.py`, `app.py` (`app = create_app()` at module level). Move `/api/health` and `/api/public/report` out of `routing.py` into `api.py`; keep `from ..routing import distance` working | Khushali | P0 |
| C-01 | All contract endpoints (list in section 6), plus the additions `GET /api/locations`, `/api/items`, `/api/plan/latest`, `POST /api/demands/<id>/correct`. Idempotent on `client_uuid`; empty text rejected, 2,000-char cap; errors as `{"error": "..."}` | Khushali | P0 |
| C-02 | SQLAlchemy models (Location, Item, Demand, Stock, Vehicle, Move, Audit). Cluster rule in `dedupe.py`: `find_parent(new, existing)` → same item + camp within 6 h (qty ±20%), parent keeps max urgency, `report_count += 1` | Khushali + Navya | P0 |
| C-03 | `draft_to_demand` adapter: lowercase urgency, display name, language detection (`hi` / `hinglish` / `en`), public → `verified=False` and **always** `needs_review=True`, never discard raw text | Navya | P0 |
| C-04 | `matching/explain.py` + plan adapter: build matcher inputs from DB, deterministic move ids, `explain` string, **`conflicts` derived from the real allocation (never hardcoded)**, `warnings` for stale stock, new Shortage/Surplus shapes. Tests in `test_api_adapters.py` | Ridhima | P0 |
| C-05 | Move state machine: approve reserves stock and bumps `fulfilled`; edit adjusts `reserved` by the delta; reject **requires a reason** and excludes that pair next run; re-run keeps non-pending states | Khushali | P0 |
| C-06 | `/api/supply/paste` and `/csv`: alias-matched items, upsert on (depot, item), stamp `updated_at`, 422 for unknown depot (never invent coordinates) | Khushali + Navya | P0 |
| C-07 | Seed scenario: ~5 depots, **camps with coordinates** (3, 4, 6, 8, 9, 12, 17, 21), mixed fresh + **one stale** stock row, 2–3 vehicles, the three-camps demands, one unverified public report. Health reports `scenario: punjab_flood_sim` | Ridhima + Navya | P0 |
| C-08 | Serve `frontend/dist` with SPA fallback (so `/public` works); `/api/health` mode logic; rate limit 5/min/IP (dict-based, no extra dependency) | Khushali | P0 |
| C-09 | **Extraction fixes** (table below) | Navya | P0 |
| C-10 | Update `HANDOFF.md` and `docs/08` | Khushali | P1 |

**C-09 acceptance table** (add as parametrised tests; the existing 10 must stay green):

| Input | Must give |
|---|---|
| `Camp 17 needs drinking water for approx 600 people, urgent` | item=water, beneficiaries=600, urgency=critical |
| `Camp 4 needs 200 waterproof tents immediately for newly displaced families` | item=tent (not water), qty=200, urgency=high |
| `Camp 8 ke paas log beemar hain please medical kits bhejo turant` | item=medkit, urgency=high |
| `Camp 21 paani bilkul khatam ho chuka hai 300 log hain urgent` | item=water, beneficiaries=300 |
| `pani 600 log camp 17` | qty=None, beneficiaries=600 (qty derived via Sphere rate) |

Root causes: item alias must match on its own with `\b` on both sides; quantity is parsed separately (number followed by `log / people / families` = beneficiaries); sort aliases longest-first; add Hindi/Devanagari aliases; cap rules confidence at 0.65 with `needs_review=True`; Gemini timeout 10 s → 3 s. Urgency rule (keeps the existing `600 water urgently` = high test green): item in {water, medkit} **and** urgency keyword **and** beneficiaries ≥ 500 → critical.

### Part D: Integration (Ridhima leads)
| ID | Task | Pri |
|---|---|---|
| D-01 | `npm install && npm run typecheck && npm run build`, `pip install`, `check_assets.py` (0 failures), `OFFLINE_MODE=1 pytest`, `run_offline.sh`. Network tab shows zero external requests | P0 |
| D-03 | Run the acceptance checklist (section 7) | P0 |
| D-04 | Run `build_offline_pack.sh` **while internet is still available**, copy `offline-pack/` to USB | P1 |
| D-05 | Pitch honesty review (section 11) | P1 |

---

## ⏱️ 5. Hackathon-day timeline (24 hrs)

> 🍕 Breaks built in: H4 lunch 30 min, H9 dinner 45 min, H14 snack 20 min, H19 chai 20 min, H22 snack 15 min. Don't skip them.
>
> **Minimum path if time collapses:** A-02 → B-01, B-02, B-03, B-05, B-08, B-09 → C-00, C-01, C-02, C-03, C-04, C-09 → D-01, D-03. Skip everything P2.

### 🟢 H0–H1 (9–10 AM): Standup, gate, branch
- [ ] 👑 Ridhima: tag the current repo state (rollback point), work on a branch, `README.md` disclosure
- [ ] 👑 Ridhima: send `routing.py` (current, with Flask routes) to Khushali before she moves routes out
- [ ] 🌐 Khushali: **C-00 gate**, start the Flask skeleton
- [ ] 🎨 Aastha: A-02 swap, confirm `vite build` passes
- [ ] 🔤 Navya: start C-09 (the demo sentence must parse by H3)
- [ ] All: confirm the contract = `types.ts`; agree that nobody renames endpoints (15 min)
- [ ] 🧮 Ridhima + 🔤 Navya: seed kickoff, camp coordinates list (15 min)

### 🟡 H1–H4 (10 AM–1 PM): Core sprint 1
- [ ] 🎨 Aastha: B-01, B-02 (incl. ToastHost), B-08, then **B-03 data-loss bugs**
- [ ] 🌐 Khushali: C-02 models, C-01 endpoints (demands, intake, public report, verify/reject/correct, stock, audit, health, locations, items, join), idempotency
- [ ] 🔤 Navya: C-09 with tests; `dedupe.py` (`find_parent`); C-03 adapter
- [ ] 🧮 Ridhima: C-04 `explain.py` + three-camps fixture tests (don't touch `greedy.py` / `engine.py`)
- [ ] 🎨 Aastha: Matching page works against `VITE_MOCK_MODE=1` until the API lands

### 🍕 H4–H4:30: Lunch

### 🟡 H4:30–H9 (1:30–6 PM): Core sprint 2
- [ ] 🌐 Khushali: C-05 state machine, C-06 supply parsing, C-08 static serving + rate limit, `scripts/smoke_api.py`, audit log, `test_audit.py`
- [ ] 🎨 Aastha: B-05 (corrections), B-06 (hardcoded → API), B-07 (matching page), B-09 P0 (map), B-04, B-14 (public page)
- [ ] 🔤 Navya: finish `messages.json` (35 msgs, 5 dupes, 1 vague), `supply.json` (with `updated_at`), real camp gazetteer, `test_dedupe.py`, `test_supply_parsing.py`
- [ ] 🧮 Ridhima: C-07 `seed.py`, persisted plan + `GET /api/plan/latest`, stale-stock warning tests; optional stale-score penalty (first thing to cut)
- [ ] **First end-to-end by H8:** coordinator message → parsed → Review Queue → Approve with a correction → Matching shows a proposal

### 🍽️ H9–H9:45: Dinner

### 🟠 H9:45–H14 (6:45–11 PM): Integration sprint
- [ ] All, first 30 min: public page → API → dashboard (⚠ Unverified) → Verify → matching → approve → audit log; run three-camps end to end
- [ ] 👑 Ridhima: **phone test** (laptop hotspot → airplane mode → scan QR → submit → appears on dashboard). Do not push past H10
- [ ] 👑 Ridhima: D-01 (`check_assets.py`, `tsc`, `pytest`, `grep openstreetmap` on the build)
- [ ] 🎨 Aastha: B-10, B-11, B-12, B-13, B-15, mobile layout at 360 px
- [ ] 🔤🧮 Navya + Ridhima: 20+ real Hinglish messages, ≥ 80% correct item, qty and camp
- [ ] 🌐 Khushali: deploy to Render (Flask serving `frontend/dist`), `OFFLINE_MODE=0`, `GEMINI_API_KEY` env var, test the live URL end to end
- [ ] 🌐 Khushali + 🔤 Navya: D-04 offline pack **while still online**
- [ ] 🖨️ Decide OCR: install Tesseract or cut it from the pitch (by H12)
- [ ] 🎥 **Build and keep a `VITE_MOCK_MODE=1` backup build** for the demo-failure case

### 🍵 H14–H14:20: Snack

### 🔴 H14:20–H18 (11:20 PM–3 AM): Acceptance, pitch prep, buffer
- [ ] All: D-03 acceptance checklist, log every failure
- [ ] 🎨👑 Aastha + Ridhima: `docs/06_pitch_defense.md` (5 judge Q&A), one verified case-study slide from `docs/02_case_studies.md`, slide deck (problem → gap → solution → demo → impact → team)
- [ ] 🔤🌐 Navya + Khushali: bug buffer, C-10 docs, `README.md` (local setup, env vars, deploy link, demo credentials)
- [ ] 🎥 Record a 2-minute backup demo video
- [ ] All, 30 min: full dry run, timed, under 4 minutes

### 😴 H18–H19: Sleep rotation (whoever can)

### ☕ H19–H19:20: Chai

### 🔵 H19:20–H22 (4:20–7 AM): Polish **or** optional extras
- [ ] **Priority:** test the public page on a real phone, confirm the deploy URL is stable, run three-camps once more on the live URL and once on the offline box with Wi-Fi off
- [ ] **Only if everything is done and tested** (pick at most one): bundled Leaflet map (B-09 P2) or the Telegram bot (`/report`, `/status`, labelled "Online mode bonus, requires internet"). Given the backend gap in this plan, Telegram is expected to be skipped

### 🍪 H22–H22:15: Last snack

### 🏁 H22:15–H24 (7:15–9 AM): Freeze + rehearsal
- [ ] 🚫 **No new code.** Freeze
- [ ] Full pitch run × 2
- [ ] 🎨 Aastha: final screenshots for slides
- [ ] All: review the 5 judge answers
- [ ] 👑 Ridhima: confirm live URL, slide deck link, GitHub repo link; final push and tag 🏷️ (keep `prototype/frontend_old` and the rollback tag until the demo is over)

---

## 🚪 6. Two-door architecture and API contract

```
Public page (no login)            Coordinator console (trusted)
  text + location + phone?          dashboard
  POST /api/public/report           POST /api/intake
  source="public"                   source="coordinator"
  verified=false                    verified=true
  needs_review=true (always)        needs_review = server flag
        └────────── same AI parser ──────────┘
                          ↓
                same DB + matching engine
                          ↓
   Coordinator sees both: ✓ Verified (green) / ⚠ Unverified (amber)
   Verify / Reject tap on each unverified row
   Duplicate cluster: 30 reports from one area → 1 need, report_count=30
```

**Canonical endpoints**

```
GET  /api/health            GET  /api/join          GET  /api/locations     GET /api/items
GET  /api/demands           POST /api/intake        POST /api/public/report
POST /api/demands/<id>/correct | /verify | /reject
GET  /api/stock             POST /api/supply/paste  POST /api/supply/csv
POST /api/match/run         GET  /api/plan/latest   GET  /api/shortages
POST /api/moves/<id>/approve | /edit | /reject
GET  /api/audit
```

**Trust rules**
- Public input gets lower matching priority until verified; life-threatening reports surface to a human immediately
- Critical items are pinned to the top everywhere, even if unverified
- Duplicates cluster by area + item (+ qty ±20%, 6 h window)
- Rate limit 5 reports/IP/min; same `client_uuid` twice = one record
- Reject always needs a reason
- No OTP, no accounts (post-hackathon)

---

## 🧪 7. How to test

| Test | How | Pass when |
|---|---|---|
| Unit | `OFFLINE_MODE=1 pytest` | All green: the original 35 plus dedupe, explain, stale warning, adapters, audit, C-09 cases |
| Assets | `python scripts/check_assets.py` | 0 failures |
| Typecheck / build | `npm run typecheck && npm run build` | Clean |
| No mock leakage | `grep -n mockData frontend/src/App.tsx` | No output |
| No online tiles | `grep -c openstreetmap frontend/dist/assets/*.js` | 0 |
| API smoke | `python scripts/smoke_api.py` | Every endpoint returns the right status and keys |
| Extraction | C-09 table + 20+ Hinglish/English messages | All table rows pass; ≥ 80% correct item, qty and camp |
| Dedupe | The 5 seeded duplicates, plus a script that POSTs 30 near-identical reports | Merged, `report_count` correct, highest urgency kept, UI shows "30 reports" |
| Idempotency | POST the same `client_uuid` twice | One record |
| Rate limit | 6 public reports in a minute | 6th is rejected with the 429 message |
| Review corrections | Change qty 100 → 600, Approve | `GET /api/demands` shows 600, verified, and an audit entry |
| Move persistence | Approve a move, click Re-run Matching | Move still APPROVED; remaining proposals don't double-count it |
| Weights | Change the proximity slider | Ranking changes |
| Public flow | Submit on `/public` | Appears as ⚠ Unverified; Verify moves it into matching; Reject requires a reason |
| Offline queue | Browser offline, submit one coordinator message + one public report, go online | One `coordinator/verified` and one `public/unverified` record, lat/lng + phone intact, in order, exactly once |
| Retry safety | Press Retry on a Failed item with the server down | Item stays in the queue |
| Server down, Wi-Fi up | Stop Flask, submit a message | "Saved, will send when connected"; item appears in Offline Status |
| Backend dead | Stop Flask, no mock flag | Dashboard shows an error banner with Retry, not mock data |
| Map offline | Wi-Fi off, placeholder GeoJSON **and** the 9-district GeoJSON | Renders, no console errors |
| 📱 Phone | Hotspot + QR join + submit | Report shows on the dashboard; location button fails gracefully |
| Live URL | Three-camps scenario on Render | Same result as local |
| Demo | Full script, timed | Under 4 minutes, no crashes |

---

## 🎬 8. Demo script (under 4 min)

1. 😰 Problem: show a messy Hinglish WhatsApp-style report; Needs Board shows the shortage
2. 📋 Paste 5 messy messages into Field Intake → AI parses → 2 land in Review Queue → **correct one field and approve it**, reject the other with a reason
3. 🌍 Open the Public page in another tab → submit "Water needed near X school, 40 people" + typed location → it appears as ⚠ Unverified on the dashboard
4. ✅ Tap Verify → it enters matching
5. 🧮 Run matching → **three camps, one truck** → the Critical camp wins → show the "Why this match" string and the Conflicts panel; nudge a weight slider and show the ranking change
6. ✔️ Approve the move → it appears in the audit log; re-run matching and show it stays approved
7. 📴 Disable Wi-Fi and say so out loud → submit a report → offline banner → queued
8. 📶 Re-enable Wi-Fi → queued report syncs, in order, once

**Say out loud:** data is a synthetic Punjab-flood scenario; distances are straight-line ×1.3 estimates; the plan is a proposal.

---

## ⚠️ 9. Risks and cuts

| Risk | Mitigation |
|---|---|
| Flask API is the critical path and doesn't exist | Khushali starts at H0; Ridhima takes C-04/C-07 so she isn't blocked; Aastha works against `VITE_MOCK_MODE=1` until C-01 lands |
| NEW-FE queue bugs lose or launder reports | B-03 is the first frontend fix after the type/API work, tested before anything else |
| Silent mock fallback hides a dead backend | D8: mock only when `VITE_MOCK_MODE=1`, with a visible label |
| Demo sentence fails on stage | C-09 by H3; demo only with tested messages; Review Queue as safety net |
| Phone can't reach the laptop | Test by H10; keep the backup video |
| Geolocation blocked on `http://192.168.x.x` | Typed location stays usable; don't claim GPS works on the hotspot |
| `navigator.onLine` lies on a LAN hotspot | Drive "online" from `/api/health` polling (B-04) |
| 9-district GeoJSON has unknown licence/provenance | Label "placeholder basemap" in the pitch until checked |
| Hinglish parsing weak offline | Rules records always land in review (one approve click); use tested messages |
| Judge: "is it really offline?" | Say local-network offline; AI and Telegram are labelled online bonuses |
| Judge: "supply data from where?" | Coordinating body pastes/uploads it once; same AI layer parses it |
| Gemini fails | Rules provider is the offline fallback |
| Deploy trouble | Railway as backup; local demo is the primary; mock-mode build as the last resort |

**Cut list (cut earlier items first if behind):**
1. Leaflet map (P2)
2. Stale-score penalty in `scoring.py` (UI badge + warning is enough)
3. Wired Filters (B-12): delete the component instead
4. CSV upload (paste is enough)
5. Telegram bot
6. Weight sliders / LP toggle (B-07 P1 part)
7. Audit log detail page (Recent Activity summary is enough)

**Do NOT build:** a structured intake form (D5), WhatsApp Business API, OTP verification, multi-NGO sharing, role-based auth, live map routing (OSRM/Google), native driver app, Docker/production infra, formal security audit, real NGO onboarding.

---

## 🛡️ 10. Judge Q&A cheat sheet (expand in `docs/06_pitch_defense.md`)

| Question | One-line answer |
|---|---|
| Victims won't use a website | They don't. The coordinator does. Victims keep using WhatsApp and calls; the public page is an extra channel for anyone with connectivity. |
| Sahana/Ushahidi exist | They need clean form data. We parse messy forwarded messages. That's the gap. |
| Is it really offline? | Local-network offline. Rules parser and matching run with zero internet; AI and Telegram need internet and are labelled online bonuses. |
| Who enters supply data? | The coordinating body pastes or uploads it once; the same AI layer parses it. |
| Won't people spam the form? | Rate limit, duplicate clustering, and a human verify step before anything enters matching. |
| What if the plan is wrong? | AI proposes, human decides. Every move is approved, edited or rejected, with an explanation and an audit log. |
| Is it better than a naive allocation? | It protects critical needs first: 100% critical coverage vs 68.2% for the naive baseline in simulation, and 29% faster critical ETA. Overall coverage is slightly lower (70.5% vs 73.2%) and total distance is higher. That is the trade-off we chose on purpose. |
| Is the data real? | No. It's a synthetic Punjab-flood scenario, labelled as such. |

---

## 🧾 11. Honesty note and pitch rules

The new repo gets a real commit history with real dates. It starts with a commit that imports the prep work, labelled as prep. **The reworked frontend (NEW-FE) was built before the event; import it as its own labelled commit and disclose it in the README.** Everything built at the event is committed during the event. A judge who checks the history should find that it matches the disclosure. ✅

Slides and demo must not claim: fully offline AI; live WhatsApp/SMS intake (it is a paste box; roadmap); offline road routing (straight-line ×1.3, labelled); a verified GeoJSON (until the licence is checked); "notified" when a report was only queued; "better coverage overall".

Case-study numbers on the slide come only from `docs/02_case_studies.md` and verified sources. Do not invent figures.

---

## ❓ 12. Open decisions (settle at the H0 standup)

| # | Question | Default if nobody decides |
|---|---|---|
| O1 | Confidence threshold: v2 says 0.8, `docs/08` says 0.7, the plan's adapter note says 0.7 for rules | Define it once in `chain.py` (0.8, as in v2), cap rules at 0.65 so every offline record goes to review; the UI only reads `needs_review` |
| O2 | Does a Flask app or DB exist on another branch or machine? | Verified no. Build C-00 |
| O3 | OCR: install Tesseract or cut it | Cut it from the pitch at H12 unless it already works |
| O4 | Provenance/licence of the 9-district GeoJSON | Label "placeholder basemap" |
| O5 | `pnpm-lock.yaml`: delete or keep | Move to `_to_delete/`, standardise on npm |

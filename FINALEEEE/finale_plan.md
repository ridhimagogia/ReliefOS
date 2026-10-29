# 🚑 ReliefOS: Finale Plan v2 (30–31 Oct, Chandigarh University)

> Coordinator-side decision engine. Messy field report (Hinglish, WhatsApp-style) → structured demand → stock matched → dispatch **proposal** a human approves. Works on a local network with zero internet; AI parsing and Telegram are online bonuses. 📴
>
> **One-line USP:** *"WhatsApp chaos in, dispatch plan out."*

**Team Koshish:** Navya · Ridhima · Aastha · Khushali
**Window:** 30 Oct 9 AM → 31 Oct 9 AM IST

---

## 🧭 0. What changed from v1

| Topic | v1 | v2 |
|---|---|---|
| Framing | Offline-first matching tool | Coordinator decision support; "offline-tolerant" (local network), not "fully offline" |
| Matching output | Dispatch recommendation | **Proposal** the human approves, edits or rejects, with an explanation string |
| Intake | Coordinator only | **Two doors:** coordinator console (trusted) + public page (unverified until a human verifies) |
| Supply data | Seed only | Paste / CSV intake parsed by the same AI layer, with `updated_at` and stale warnings |
| Trust | Not covered | Verified / Unverified badges, duplicate clustering, rate limit, verify/reject taps, audit log |
| Confidence threshold | 0.6 | **0.8** (below goes to Review Queue) |
| Demo | 3 min | Under 4 min, centred on the "three camps, one truck" conflict |
| Pitch | Generic | 5-question judge defence in `docs/06_pitch_defense.md` |
| Telegram bot | Not planned | Optional, only if everything else is done and tested |

---

## 📊 1. Where we stand (29 Oct)

| Area | Status | Notes |
|---|---|---|
| 🧮 Matching engine (score, greedy, LP, shortages) | ✅ Done | Ridhima. Needs `explain()`, `conflicts`, `warnings` |
| 🗺️ Geo-routing (haversine ×1.3, offline-safe) | ✅ Done | Ridhima |
| 📴 Offline node (/api/join, QR, basemap check) | ✅ Done | Basemap is a placeholder, label it so |
| 🔤 Extraction (rules + Gemini fallback) | ✅ Done | Needs alias loading, Hinglish/Devanagari, supply sentences, multi-item |
| 🧪 Tests | ✅ 35 passing | New: dedupe, supply parsing, explain, stale warning, audit |
| 🎨 Frontend | ✅ Builds, no CDN | Mock data only; Review Queue approve/reject, offline banner, IndexedDB queue exist |
| 🌐 Flask API | ⚠️ Route stubs only | Endpoints below still to build. Blocks everything |
| 📚 Real `items.json`, `units.json`, `gazetteer.json` | ⚠️ Stubs only | Hindi/Hinglish aliases needed |
| 🌍 Public report page | ❌ Not started | New, priority |
| 📱 Phone test (hotspot → QR → report) | ❌ Never run | Highest demo risk |
| 🖨️ Tesseract OCR | ❌ Not installed | Install or drop from the pitch (decide by H12) |

---

## 👭 2. Team split

| Person | Role | Owns |
|---|---|---|
| 🔤 **Navya** | Extraction + data | `backend/extraction/` (rules, dedupe, chain), dictionaries, gazetteer, `seed/messages.json`, `seed/supply.json`, extraction tests |
| 🧮 **Ridhima** | Matching + lead | `backend/matching/`, `explain()`, conflicts/warnings, three-camps scenario, phone test, final demo |
| 🎨 **Aastha** | Frontend + pitch | `App.tsx` changes, `PublicReport.tsx`, badges, slides, backup video |
| 🌐 **Khushali** | Flask API + deploy | `routing.py` endpoints, audit log, rate limit, Render deploy, README |

---

## ⚡ 3. Tonight (29 Oct, before the hackathon, ~2–3 hrs, sleep by 1 AM)

| # | Task | Who | Time | Done |
|---|---|---|---|---|
| T1 | Add `source`, `verified`, `kind`, `language`, `duplicate_of`, `report_count` to `DemandDraft` in `base.py` | Navya | 20 min | [ ] |
| T2 | Change confidence threshold 0.6 → 0.8 in `chain.py` | Navya | 10 min | [ ] |
| T3 | Add `updated_at` to the stock/supply data model | Khushali | 15 min | [ ] |
| T4 | Add `source` and `verified` to every demand record in `mockData.ts` | Aastha | 20 min | [ ] |
| T5 | Stub `GET /public` (static shell) and `POST /api/public/report` (returns 200) in `routing.py` | Khushali | 20 min | [ ] |
| T6 | Create empty `dedupe.py`, `seed/messages.json`, `seed/supply.json`; open and check `docs/06_pitch_defense.md` | Navya | 10 min | [ ] |
| T7 | Confirm `vite dev` + `flask run` both start cleanly; fix dep issues | Ridhima | 30 min | [ ] |
| T8 | Create Render.com accounts and connect the repo (Railway as backup) | Khushali | 30 min | [ ] |

**Tonight goal:** green dev servers, deploy account ready, data-model fields added.

> 🧾 These are prep-work commits. Keep them in the prep repo; they get imported into the hackathon repo as the labelled first commit (see the honesty note in section 9).

---

## ⏱️ 4. Hackathon-day timeline (24 hrs)

> 🍕 Breaks built in: H4 lunch 30 min, H9 dinner 45 min, H14 snack 20 min, H19 chai 20 min, H22 snack 15 min. Don't skip them.

### 🟢 H0–H1 (9–10 AM): Standup + setup
- [ ] 👑 Ridhima: fresh hackathon repo, real first commit importing the prep work, `README.md` disclosure
- [ ] All: run the app, confirm tonight's prerequisites landed (30 min)
- [ ] All: assign issues, agree API request/response shapes (15 min)
- [ ] 🧮 Ridhima: seed data kickoff with Navya (`messages.json` 35 msgs, `supply.json`) (15 min)

### 🟡 H1–H4 (10 AM–1 PM): Core sprint 1
- [ ] 🔤 Navya: `rules.py` loads aliases from `items.json`; Devanagari + Hinglish terms; detect supply sentences; multiple items per message
- [ ] 🔤 Navya: `dedupe.py` (same camp + item within 6 h + qty ±20% → merge, keep highest urgency, increment `report_count`, set `duplicate_of`); wire into `chain.py`
- [ ] 🧮 Ridhima: `explain()` in `greedy.py`/`engine.py`, e.g. "Truck 2 → Camp 17: closest depot (3.2 km), Critical camp, no water on site"
- [ ] 🧮 Ridhima: `plan()` returns `conflicts` and `warnings` (stock older than N hours)
- [ ] 🎨 Aastha: Matching page gets Edit + Reject beside Approve, "Why this match" panel, Conflicts panel
- [ ] 🎨 Aastha: Stock page stale badge; Intake page bulk-paste box and Supply tab; `✓ Verified` / `⚠ Unverified` badges
- [ ] 🌐 Khushali: `POST /api/supply/paste`, `/api/supply/csv` (stamp `updated_at`)
- [ ] 🌐 Khushali: `POST /api/moves/<id>/approve`, `/edit`, `/reject`
- [ ] 🌐 Khushali: `POST /api/public/report` → `{text, location_text, lat?, lng?, phone?}`, sets `source="public"`, `verified=false`, `needs_review=true`; rate limit 5 req/IP/min (in-memory)

### 🍕 H4–H4:30: Lunch

### 🟡 H4:30–H9 (1:30–6 PM): Core sprint 2
- [ ] 🔤 Navya: finish seed `messages.json` (5 dupes, 1 vague) and `supply.json` (with `updated_at`); `test_dedupe.py`, `test_supply_parsing.py`
- [ ] 🔤 Navya: real `gazetteer.json` of camps near Chandigarh
- [ ] 🧮 Ridhima: optional stale-stock penalty in `scoring.py` (first thing to cut)
- [ ] 🧮 Ridhima: "Three camps, one truck" scenario in `seed/` + simulate module (the showstopper); `test_explain.py`, `test_stale_warning.py`; validate full `plan()` output
- [ ] 🎨 Aastha (priority): `PublicReport.tsx` / `/public`, mobile-first, no login: text box, "📍 Share my location", optional phone, submit → `POST /api/public/report`, success screen
- [ ] 🎨 Aastha: offline fallback on the public page (localStorage, "Saved, will send when connected"); works on 2G, no heavy assets
- [ ] 🌐 Khushali: audit log table (`who`, `action`, `target_id`, `timestamp`, `notes`) + `GET /api/audit` → Recent Activity panel
- [ ] 🌐 Khushali: `POST /api/demands/<id>/verify` and `/reject`; verify/reject buttons on unverified rows
- [ ] 🌐 Khushali: `test_audit.py`

### 🍽️ H9–H9:45: Dinner

### 🟠 H9:45–H14 (6:45–11 PM): Integration sprint
- [ ] All, first 30 min: public page → API → dashboard flow (report appears as ⚠ Unverified); approve a move and see it in the audit log; run three-camps end to end
- [ ] 🔤🧮 Navya + Ridhima: fix parsing/matching bugs from integration; test 20+ real Hinglish messages (≥ 80% correct item, qty, camp)
- [ ] 👑 Ridhima: **phone test**: laptop hotspot → airplane mode → scan QR → submit report → see it on the dashboard (do not push past H10)
- [ ] 👑 Ridhima: `check_assets.py` and full `pytest`
- [ ] 🎨 Aastha: loading states, error toasts, mobile layout; offline banner wording: *"Works with zero internet on a local network. Internet adds AI parsing and chat-app intake."*
- [ ] 🌐 Khushali: deploy to Render (Flask + Vite static, or Vite served from Flask); `OFFLINE_MODE=0`, `GEMINI_API_KEY` env var; test the live URL end to end; note it for the pitch
- [ ] 🖨️ Decide OCR: install Tesseract or cut it from the pitch (by H12)

### 🍵 H14–H14:20: Snack

### 🔴 H14:20–H18 (11:20 PM–3 AM): Pitch prep + buffer
- [ ] 🎨👑 Aastha + Ridhima: `docs/06_pitch_defense.md` (5 judge Q&A), one verified case-study slide from `docs/02_case_studies.md`, slide deck (problem → gap → solution → demo → impact → team)
- [ ] 🔤🌐 Navya + Khushali: buffer for bugs and deploy issues; `README.md` (local setup, env vars, deploy link, demo credentials)
- [ ] 🎥 Record a 2-minute backup demo video
- [ ] All, 30 min: full dry run, timed, under 4 minutes

### 😴 H18–H19: Sleep rotation (whoever can)

### ☕ H19–H19:20: Chai

### 🔵 H19:20–H22 (4:20–7 AM): Telegram bot **or** polish
- [ ] **Only if everything above is done and tested:** 🌐 Khushali leads. `/report` → `POST /api/public/report`, `/status` → shortage summary. Label in UI: "Online mode bonus, requires internet". Behind on anything → skip entirely
- [ ] **If skipping Telegram:** test the public page on a real phone, confirm the deploy URL is stable, run three-camps once more on the live URL

### 🍪 H22–H22:15: Last snack

### 🏁 H22:15–H24 (7:15–9 AM): Freeze + rehearsal
- [ ] 🚫 **No new code.** Freeze
- [ ] Full pitch run × 2
- [ ] 🎨 Aastha: final screenshots for slides
- [ ] All: review the 5 judge answers
- [ ] 👑 Ridhima: confirm live URL, slide deck link, GitHub repo link; final push and tag 🏷️

---

## 🚪 5. Two-door architecture

```
Public page (no login)            Coordinator console (trusted)
  text + location + phone?          dashboard
  POST /api/public/report           POST /api/intake
  source="public"                   source="coordinator"
  verified=false                    verified=true
  needs_review=true                 needs_review = confidence < 0.8
        └────────── same AI parser ──────────┘
                          ↓
                same DB + matching engine
                          ↓
   Coordinator sees both: ✓ Verified (green) / ⚠ Unverified (amber)
   Verify / Reject tap on each unverified row
   Duplicate cluster: 30 reports from one area → 1 need, report_count=30
```

**Trust rules**
- Public input gets lower matching priority until verified; life-threatening reports surface to a human immediately
- Duplicates cluster by area + item (+ qty ±20%, 6 h window)
- Rate limit 5 reports/IP/min
- No OTP, no accounts (post-hackathon)

---

## 🧪 6. How to test

| Test | How | Pass when |
|---|---|---|
| Unit | `pytest` with `OFFLINE_MODE=1` | All green, including dedupe, explain, stale warning, audit |
| Assets | `python scripts/check_assets.py` | 0 failures |
| Extraction | 20+ Hinglish/English messages | ≥ 80% correct item, qty and camp |
| Dedupe | The 5 seeded duplicates | Merged, `report_count` correct, highest urgency kept |
| API | `curl` each endpoint (supply paste/csv, moves, public report, verify/reject, audit) | Correct JSON and status codes |
| Rate limit | 6 public reports in a minute | 6th is rejected |
| Public flow | Submit on `/public` | Appears as ⚠ Unverified; verify tap moves it into matching |
| Offline | Wi-Fi off, `run_offline.sh` | No network calls, no CDN errors; public page queues to localStorage |
| 📱 Phone | Hotspot + QR join + submit | Report shows up on the dashboard |
| Live URL | Three-camps scenario on Render | Same result as local |
| Demo | Full script, timed | Under 4 minutes, no crashes |

---

## 🎬 7. Demo script (under 4 min)

1. 😰 Problem: show a messy Hinglish WhatsApp-style report; Needs Board shows the shortage
2. 📋 Paste 5 messy messages into Field Intake → AI parses → 2 land in Review Queue (confidence < 0.8) → approve 1, reject 1 with a reason
3. 🌍 Open the Public page in another tab → submit "Water needed near X school, 40 people" + location → it appears as ⚠ Unverified on the dashboard
4. ✅ Tap Verify → it enters matching
5. 🧮 Run matching → **three camps, one truck** → Camp A (Critical) wins → show the explain string and Conflicts panel
6. ✔️ Approve the move → it appears in the audit log
7. 📴 Disable Wi-Fi and say so out loud → submit a report → offline banner → queued
8. 📶 Re-enable Wi-Fi → queued report syncs

---

## ⚠️ 8. Risks and cuts

| Risk | Mitigation |
|---|---|
| Flask endpoints late | Khushali starts in H1; Ridhima helps if it slips |
| Phone can't reach the laptop | Test by H10; keep the backup video |
| Hinglish parsing fails on stage | Use tested example messages; keep the Review Queue |
| Judge: "is it really offline?" | Say local-network offline; AI and Telegram are labelled online bonuses |
| Judge: "supply data from where?" | Coordinating body pastes/uploads it once; same AI layer parses it |
| Basemap looks rough | Label it "placeholder basemap" |
| Gemini fails | Rules provider is the offline fallback |
| Deploy trouble | Railway as backup; local demo is the primary |

**Cut list (cut earlier items first if behind):**
1. Stale-score penalty in `scoring.py` (UI badge is enough)
2. CSV upload (paste is enough)
3. Telegram bot
4. Audit log detail page (Recent Activity summary is enough)

**Do NOT build:** WhatsApp Business API, OTP verification, multi-NGO sharing, role-based auth, live map routing (OSRM/Google), native driver app, Docker/production infra, formal security audit, real NGO onboarding.

---

## 🛡️ 9. Judge Q&A cheat sheet (expand in `docs/06_pitch_defense.md`)

| Question | One-line answer |
|---|---|
| Victims won't use a website | They don't. The coordinator does. Victims keep using WhatsApp and calls; the public page is an extra channel for anyone with connectivity. |
| Sahana/Ushahidi exist | They need clean form data. We parse messy forwarded messages. That's the gap. |
| Is it really offline? | Local-network offline. Rules parser and matching run with zero internet; AI and Telegram need internet and are labelled online bonuses. |
| Who enters supply data? | The coordinating body pastes or uploads it once; the same AI layer parses it. |
| Won't people spam the form? | Rate limit, duplicate clustering, and a human verify step before anything enters matching. |
| What if the plan is wrong? | AI proposes, human decides. Every move is approved, edited or rejected, with an explanation and an audit log. |

---

## 🧾 10. Honesty note

The new repo gets a real commit history with real dates. It starts with a commit that imports the prep work (including tonight's data-model and stub changes), labelled as prep. Everything built at the event is committed during the event. A judge who checks the history should find that it matches the disclosure. ✅

Case-study numbers on the slide come only from `docs/02_case_studies.md` and verified sources. Do not invent figures.

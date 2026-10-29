# 🚑 ReliefOS: Finale Plan (30–31 Oct, Chandigarh University)

> Offline-first disaster-relief matching. Messy field report → structured demand → stock matched → dispatch recommendation. 📴

---

## 📊 1. Where we stand (28 Oct)

| Area | Status | Notes |
|---|---|---|
| 🧮 Matching engine (score, greedy, LP, shortages) | ✅ Done | Ridhima |
| 🗺️ Geo-routing (haversine ×1.3, offline-safe) | ✅ Done | Ridhima |
| 📴 Offline node (/api/join, QR, basemap check) | ✅ Done | Basemap is a placeholder |
| 🔤 Extraction (rules + Gemini fallback) | ✅ Done | Rules cover 5 items |
| 🧪 Tests | ✅ 35 passing | |
| 🎨 Frontend | ✅ Builds, no CDN | Mock data only |
| 🌐 Flask `app.py`, `requirements.txt`, seed | ❌ Missing | Blocks everything |
| 📚 Real `items.json`, `units.json`, `gazetteer.json` | ⚠️ Stubs only | Hindi/Hinglish aliases |
| 📱 Phone test (hotspot → QR → report) | ❌ Never run | Highest demo risk |
| 🖨️ Tesseract OCR | ❌ Not installed | Install or drop from the pitch |

**Rough completion:** core logic about 70%, integration about 15%, demo-readiness about 25%.

---

## 👭 2. Team split

> ⚠️ I only know Navya's role (extraction) for sure. Swap the other names if they're wrong.

| Person | Role | Owns |
|---|---|---|
| 👑 **Ridhima** | Lead + matching + offline | Integration review, matching/routing, offline node, phone test, final demo |
| 🌐 **Khushali** | Backend (Flask) | `app.py`, endpoints, `requirements.txt`, seed script, DB |
| 🔤 **Navya** | Extraction + data | Rules/Gemini providers, real dictionaries, gazetteer, OCR decision |
| 🎨 **Aastha** | Frontend + demo | Wire UI to the real API, map, polish, slides, backup video |

---

## ⏱️ 3. Hackathon timeline (24 hrs)

### 🟢 Phase 1: Setup (hrs 0–2)
- [ ] 👑 Create the fresh hackathon repo with a real first commit and the `README.md` disclosure
- [ ] 👑 Add the pre-built modules with a commit message saying they come from the prep work
- [ ] 🌐 Flask skeleton, `requirements.txt`, health endpoint
- [ ] 🎨 Confirm the frontend runs against the new repo

### 🟡 Phase 2: Build (hrs 2–10)
- [ ] 🌐 `/api/reports`, `/api/demands`, `/api/stock`, `/api/plan` endpoints (**~2 hrs**)
- [ ] 🌐 Seed script with demo camps, warehouses and stock (**~45 min**)
- [ ] 🔤 Real `items.json` and `units.json` with Hindi/Hinglish aliases (**~1.5 hrs**)
- [ ] 🔤 Real `gazetteer.json` of camps near Chandigarh (**~1 hr**)
- [ ] 👑 Wire `extract()` → `match()`/`plan()` in the backend (**~1 hr**)
- [ ] 🎨 Replace mock data with API calls (**~2 hrs**)
- [ ] 🎨 Map view and "why this match" panel (**~1.5 hrs**)

### 🟠 Phase 3: Integrate and test (hrs 10–16)
- [ ] 👑 Phone test: laptop hotspot → airplane mode → scan QR → submit report → see result (**~1.5 hrs**)
- [ ] 🔤 Test 20 or more real Hinglish messages and fix the misses (**~1 hr**)
- [ ] 👑 Run `check_assets.py` and the full `pytest`
- [ ] 🌐 Human review queue for low-confidence reports (**~1 hr**)
- [ ] 🖨️ Install Tesseract, or cut OCR from the pitch (decide by hr 12)

### 🔴 Phase 4: Polish and ship (hrs 16–24)
- [ ] 🎨 Slides (problem, demo, offline story, impact)
- [ ] 🎨 Record a 2-minute backup demo video 🎥
- [ ] 👑 Full dry run with the whole team, twice
- [ ] 🌐 Optional deploy (Render/Vercel) as an online backup
- [ ] 👑 Final push and tag before the freeze 🏷️

---

## 🧪 4. How to test

| Test | How | Pass when |
|---|---|---|
| Unit | `pytest` with `OFFLINE_MODE=1` | All green |
| Assets | `python scripts/check_assets.py` | 0 failures |
| Extraction | 20 Hinglish/English messages | At least 80% correct item, qty and camp |
| API | `curl` each endpoint | Correct JSON and status codes |
| Offline | Wi-Fi off, run `run_offline.sh` | No network calls, no CDN errors |
| 📱 Phone | Hotspot + QR join + submit | The report shows up on the dashboard |
| Demo | Full script, timed | Under 3 minutes with no crashes |

---

## 🎬 5. Demo script (3 min)

1. 😰 Show the problem: a messy WhatsApp-style report in Hinglish
2. 📴 Turn the internet off and say so out loud
3. 📱 Join from a phone by QR and submit a report
4. 🔤 Show the extracted demand and its confidence
5. 🧮 Show the matching result and the "why this match" panel
6. 🗺️ Show the map with the route and ETA
7. ✅ Approve the dispatch

---

## ⚠️ 6. Risks

| Risk | Mitigation |
|---|---|
| Flask is late | Khushali starts in hr 0; Ridhima helps if it slips |
| The phone can't reach the laptop | Test by hr 10; keep the backup video |
| Hinglish parsing fails on stage | Use tested example messages and keep the review queue |
| Basemap looks rough | Label it "placeholder basemap" |
| Gemini fails | Rules provider is the offline fallback |

---

## 🧾 7. Honesty note

The new repo gets a real commit history with real dates. It starts with a commit that imports the prep work, labelled as such. Everything built at the event is committed during the event. A judge who checks the history should find that it matches the disclosure. ✅

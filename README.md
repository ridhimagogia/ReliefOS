# ReliefOS

**Right help. Right place. Right time.**

Disaster-relief supply matching: messy field reports in, ranked relief moves out.

---

**Zinnovatio 4.0 · 30-31 Oct 2026 · VIPS-TC Delhi**
Track: Smart & Sustainable Cities · Team: Koshish

---

## The idea in 30 seconds

After a disaster, supplies usually **exist**: in warehouses, NGO stores and government stockpiles. What fails is **matching supply to demand, in time, at scale.**

ReliefOS keeps a live picture of Supply → Demand → Distance → Urgency → Transport capacity and tells relief organisations **what should move where, and why**.

Example. The system turns this:

> *"Camp 17 needs drinking water for approximately 600 people."*

into structured demand:

| Item | Quantity | Urgency | Location |
|---|---|---|---|
| Water | 600 people | Critical | Camp 17 |

No one types item, quantity, urgency or location into a form. The AI reads the message.

---

## Why it matters

| Stat | Source |
|---|---|
| ~75% of relief spending goes to supply-chain logistics | 2023 study, 203M of 276M euros across 20 operations |
| 14-day gap before Punjab 2025 floods appeared in central situation reports | Verified in docs/02 |
| 58% of surveyed people got no early warning in Pakistan 2022 floods | 27 stakeholders, 39 ministries involved |
| Kerala 2018: state asked for money, not goods | Unsolicited material needed extra verification |

Full context: [docs/01_problem_and_stats.md](docs/01_problem_and_stats.md)

---

## Research pack

| Doc | What you get |
|---|---|
| [01 Problem and stats](docs/01_problem_and_stats.md) | Verified numbers, Sphere standards, AI feasibility evidence |
| [02 Case studies](docs/02_case_studies.md) | Punjab 2025, Kerala 2018, Pakistan 2022 |
| [03 Datasets](docs/03_datasets.md) | HDX, OSM, CrisisNLP, how to build a gold set |
| [04 Reading list](docs/04_reading_list.md) | Papers and handbooks, prioritised P1/P2/P3 |
| [05 Study roadmap](docs/05_study_roadmap.md) | Who owns what |
| [06 Pitch defense](docs/06_pitch_defense.md) | Judge questions and strong answers |
| [07 Competitive landscape](docs/07_competitive_landscape.md) | Ushahidi, Sahana, IDRN and where we differ |

---

## Architecture

| Layer | Tech |
|---|---|
| AI and OCR | Gemini API (online), Tesseract (offline) |
| Backend | Python, Flask |
| Database | SQLite (local), MySQL (cloud) |
| Matching | Rule-based scoring, greedy algorithm |
| Maps | OpenStreetMap, Leaflet, haversine x 1.3 |
| Frontend | React 19, TypeScript, Vite, Tailwind 4 |

### How a match is scored

```
score = feasible x ( 0.5 x urgency + 0.25 x fill + 0.25 x proximity )
```

- **urgency**: Critical 1.0, High 0.75, Medium 0.5, Low 0.25
- **fill**: how much of the need this stock covers
- **proximity**: nearer depot scores higher
- **feasible**: vehicle available, stock sufficient

Every recommendation stores its score breakdown. The coordinator sees a plain-language explanation ("Truck 2 to Camp A: critical, no water on site, 3.2 km") before approving.

Full detail: [docs/08_tech_stack_architecture.md](docs/08_tech_stack_architecture.md)

---

## Running locally

```bash
# Backend
cd backend
pip install flask flask-cors
python app.py          # runs on http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # runs on http://localhost:5173
```

Set `GEMINI_API_KEY` in the environment for AI parsing. Without it, the rules parser runs offline.

---

## Project status

| Step | Deliverable | Status |
|---|---|---|
| 1 | Research pack (docs/01-07) | Done |
| 2 | Tech stack and architecture | Done |
| 3 | Backend: extraction, matching, Flask API | Done |
| 4 | Frontend: Intake page, Review Queue | Done |
| 5 | Frontend: Needs Board, Matching page, Public page | In progress |
| 6 | Deploy to Render | Pending |
| 7 | Offline pack and USB build | Pending |

---

## Honest disclosures

- **Demo data is synthetic.** The Punjab-flood scenario uses invented camps, depots and demands. No real victim data is used.
- **Distances are estimates.** Straight-line haversine x 1.3. Not road-routed.
- **The frontend was rebuilt from scratch on 30 Oct 2026.** The original prototype used structured input fields, which defeated the product's core promise (unstructured input only). The new frontend is built clean in `frontend/` and is the version shown in the demo.
- **The AI proposes; the human decides.** Every dispatch is approved, edited or rejected by a coordinator. Nothing is auto-dispatched.
- **Statistics are tagged [V] (verified) or [B] (background).** Do not put a [B] stat on a slide without opening the source first.

---

## Team Koshish

Ridhima Gogia · Khushali Kakkar · Navya Gupta · Aastha Jha

Vivekanand Institute of Professional Studies (VIPS-TC), Delhi · GGSIPU

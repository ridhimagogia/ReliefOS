# Hackathon plan: 30-31 Oct (overnight)

You have 13 days. Build the skeleton before the event, and use the event for polish, real data and the pitch. Check the rules first: many hackathons require code to be written on site, so keep the pre-built part to a clearly declared "starter", or ask the organisers.

## Build before (side prototype)
- Repo, CI-free, README, seed data for one scenario (e.g. Punjab floods: 6 warehouses, 5 NGOs, 15 camps, 4 vehicles, using real district coordinates).
- Extraction prompt + JSON schema + 15 messy sample reports (English, Hindi, Hinglish) with labelled answers.
- The matcher (`prototype/match.py` is the starting point).
- A map page that shows camps, stock and arrows.

## Day plan (36 hours, sleep in shifts)
| Hours | Goal | Owner |
|---|---|---|
| 0-3 | Environment up, DB seeded, API skeleton, map renders seed data | all |
| 3-9 | Report in -> structured demand shown on the map (the "wow" flow) | AI/NLP + backend |
| 9-15 | Matching + recommendation panel with "why this match" | backend/OR |
| 15-20 | Human review queue, approve/dispatch, status changes | frontend |
| 20-26 | Live re-match when a new report or stock change arrives (rolling) | backend |
| 26-30 | Impact numbers from simulation: time-to-match, % demand covered, km saved vs naive | OR + domain |
| 30-34 | Bug bash, demo script rehearsal, backup screen recording | all |
| 34-36 | Slides, pitch rehearsal x3 | domain/pitch |

## Must do
1. One flawless demo path: paste a messy report, see structured demand, see a recommended move on the map.
2. Show a before/after: naive nearest-stock assignment vs ReliefOS (urgency + split loads).
3. Human-in-the-loop for low-confidence extractions. Judges will ask about hallucination.
4. A recorded backup demo in case Wi-Fi or the API fails.
5. Honest numbers labelled "simulated".

## Don't do
- Real offline sync, real WhatsApp/SMS integration, auth/roles, payments, multi-disaster support.
- Training any model. Use the API.
- Live dependence on external services without a fallback (cache Gemini responses for the demo reports; use haversine if routing fails).
- Claims like "saves X lives" or "80% faster" without a source or simulation behind them.

## Demo script (3 min)
1. The problem in one image: stock sits in A, need is in B, nobody connects them.
2. Paste "Camp 17 needs drinking water for approximately 600 people" (and a Hindi one).
3. Structured demand appears; low-confidence one goes to review.
4. Matching runs; map shows the move, ETA, and the reason.
5. A new critical report arrives; the plan re-balances live.
6. Close on the business model: NGO SaaS first, CSR dashboards and government pilots next.

## Likely judge questions
- Doesn't India already have IDRN / state systems? (Position as the matching and prioritisation layer on top; check IDRN's current scope before the day.)
- What if the LLM gets it wrong? (Confidence scores, validation rules, human approval before dispatch.)
- Where does real data come from? (NGO and warehouse stock uploads, field forms, messaging; pilot with one district or NGO.)
- Why not WhatsApp groups? (No structure, no matching, no audit trail.)
- How does it work with no connectivity? (Queued PWA form; honest answer: sync is future work.)

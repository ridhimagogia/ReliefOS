<div align="center">

# ⏱️ Hackathon Plan: Build 90% Before 30 Oct

**Pre-build 17-29 Oct · Freeze 29 Oct · Showtime 30-31 Oct, Chandigarh University**

[⬅ Back to README](../README.md) · [Architecture](08_tech_stack_architecture.md) · ![Diagram](https://img.shields.io/badge/Diagram-architecture.jpg-1f5fd0)

</div>

![Architecture](images/architecture.jpg)

---

## 🚦 Step zero: check the rules (do this today)

> ⚠️ **Many hackathons require code to be written on site, or limit pre-built code.** Your plan to arrive with ~90% built only works if the rules allow it. Do not assume.

**Email the organisers today** (keep the reply):
> *"Our team (Koshish, ReliefOS) was shortlisted. May we bring a pre-built prototype, and what are the rules on pre-written code? If not allowed, what may we prepare in advance (data, designs, libraries)?"*

| If the answer is | Then |
|---|---|
| ✅ Pre-built prototype allowed | Follow this plan as written |
| ⚠️ Allowed with disclosure | Same plan. Declare it on the first slide: "prototype built before, new features built on site" |
| ❌ Must be written on site | Keep only: research, datasets, scenario data, designs, gold set, libraries and `match.py` logic. Re-type the app on site using the [fallback split](#-fallback-if-pre-built-code-is-banned) |

The event pitch says teams turn concepts into **working models**, so a strong prototype is in the spirit of the event. Still, ask.

---

## 🎯 What "90% built" means

| Area | Target by 29 Oct | Built before | Left for the event |
|---|---|---|---|
| 🗄️ Database and seed data (Punjab scenario) | 100% | ✅ | New judge-chosen scenario in 15 min |
| 🤖 AI extraction (text, Hinglish, photo) | 95% | ✅ with cached fallbacks | Tune on judges' live messages |
| ✅ Review queue (human confirm) | 100% | ✅ | n/a |
| ⚖️ Matching engine (greedy + LP) | 100% | ✅ | n/a |
| 🗺️ Command map, matching panel, needs board | 90% | ✅ | Visual polish |
| 📊 Impact numbers (simulated, naive vs ReliefOS) | 90% | ✅ | Re-run after tweaks |
| 📴 Offline PWA queue | 70% | ✅ basic queue | Stretch only |
| 🎤 Pitch deck, demo script, backup video | 80% | ✅ drafts | Final polish and rehearsal |

**The 10% on site** is: judge-driven scenarios, polish, bug fixes, the live demo, answering questions, and one stretch feature.

---

## 👥 Roles

| Person | Owns | Done when |
|---|---|---|
| 🤖 **A: AI/NLP** | Extraction pipeline, prompts, gold set, evaluation | ≥ 85% field accuracy on the 150-message gold set |
| ⚖️ **B: Matching** | Scoring, greedy, LP, vehicle assignment, simulation | Naive-vs-ReliefOS numbers reproducible with one command |
| ⚙️ **C: Backend** | Flask API, DB, seed, Docker, routing client | `docker compose up` gives a working system |
| 🖥️ **D: Frontend and pitch** | React screens, map, deck, demo script | One flawless 3-minute demo, recorded |

Everyone reviews each other's PRs. Everyone can run the demo.

---

## 🗓️ Pre-build schedule (17-29 Oct)

| Dates | Milestone | Who | Definition of done |
|---|---|---|---|
| **17-18** | 🧱 **Foundations.** Repo, branches, Docker Compose, DB schema, one-command seed. Decide: Flask, SQLite local / MySQL compose, greedy as default matcher, Punjab flood scenario | C + all | `docker compose up` shows an empty app and API health check |
| **18-19** | 🗃️ **Data.** Punjab scenario: 8-12 depots, 15-25 camps, vehicles, stock. Sphere rates table. Start the 150-message gold set | C + A | Seed loads; map shows markers |
| **19-21** | 🤖 **Extraction v1.** Gemini JSON-schema prompt, canonicaliser, Sphere fill, location resolver, validator | A | 10 messages parse correctly end-to-end |
| **19-21** | ⚖️ **Matching v1.** Port `match.py` into the app. Scoring, greedy, reservation, shortage report | B | Problem-statement example (A/B/C blankets, kits, ORS) solved correctly in a unit test |
| **19-22** | 🖥️ **UI skeleton.** Map with camps and depots, intake page, demand list | D | Paste text, see a record appear |
| **22-24** | 🔗 **Integrate.** Report → review queue → confirm → match → moves on map. Approve reserves stock | all | The "wow" flow works with no manual DB edits |
| **23-25** | 📊 **Evidence.** Gold-set evaluation, simulation (naive nearest-stock vs ReliefOS), KPI panel, LP optimiser | A + B | Numbers on a slide, labelled "simulated" |
| **24-26** | 🛟 **Resilience.** Cached Gemini responses for demo inputs, haversine fallback, offline queue, error states, seed reset button | C + D | Demo works with Wi-Fi off, except live LLM |
| **26-27** | 🎬 **Demo and deck.** Script, slides, backup video, judge Q&A drilled | D + all | Two full rehearsals timed under 3 min |
| **28** | 🧪 **Bug bash and freeze candidate.** Fresh-laptop install test: clone, run, demo | all | Someone who did not write the code runs it |
| **29** | 🧊 **Feature freeze.** Bug fixes only. Pack: chargers, hotspot, HDMI, offline copy of repo and data, video on phone and USB | all | Tag `v1-demo` |

> Buffer rule: if a milestone slips by a day, cut the stretch items, never the end-to-end flow.

---

## ✅ Must-have vs nice-to-have

### 🟢 Must be perfect (the scoring path)
1. Paste a messy report (English and Hinglish), get structured demand with a confidence score.
2. Low-confidence record lands in a **review queue**; approve it with one click.
3. Run matching; map shows the move, quantity, distance, ETA and **why**.
4. **Before/after:** naive nearest-stock vs ReliefOS (urgency-aware, split loads).
5. A new critical report arrives and the plan **re-balances live**.
6. Shortage report: "500 medical kits short, nearest source is X".
7. Backup recording of all of the above.

### 🟡 Nice (build if the must-haves are solid)
- Photo/handwritten list intake
- Weight sliders that visibly change moves
- Donor needs board
- LP optimiser toggle
- Offline PWA queue demo

### 🔴 Do not build
- Real WhatsApp or SMS integration · payments · full auth and multi-tenant roles · multi-disaster support · training any model · live dependence on any service without a fallback.

---

## 🧪 Quality gates (no gate, no freeze)

| Gate | Test |
|---|---|
| **Extraction** | ≥ 85% field accuracy on the gold set. Report item, quantity, location and urgency separately |
| **Matching** | Unit tests: stock never goes negative; a critical demand beats a low one; reserved stock is not double-booked; the problem-statement example is solved correctly |
| **End-to-end** | 5 scripted demo inputs produce the expected moves 3 times in a row |
| **Offline** | Wi-Fi off: demo still runs from cached responses |
| **Fresh install** | A teammate clones and runs it in under 10 minutes |

---

## 🛟 Risk and fallback table

| Risk | Fallback |
|---|---|
| Gemini API down or rate-limited | Cached responses for scripted inputs; regex parser for the basic pattern |
| Routing service fails | Haversine × 1.3, cached distances |
| Venue Wi-Fi bad | Phone hotspot; everything runs locally; video backup |
| Laptop dies | Repo and data on two laptops and a USB drive; video on phone |
| Judge types a message the parser fails on | Review queue shows it as low confidence: turn the failure into a feature demo |
| Matching gives a surprising result | "Why" breakdown explains it; sliders show sensitivity |
| Rules ban pre-built code | See below |

---

## 🧯 Fallback if pre-built code is banned

Keep before the event: research, datasets, **scenario data**, gold set, prompts, designs and wireframes, the algorithm design and `prototype/match.py` as reference.
Write on site (priority order): 1) seed + map, 2) extraction, 3) review queue, 4) matcher, 5) KPIs. Use the 36 hours as: 0-6 foundations, 6-14 extraction, 14-22 matching, 22-28 UI polish and integration, 28-32 evidence, 32-36 pitch.
This is why the pre-build milestones above are modular: each one can be retyped fast because the design is already decided.

---

## 🎬 3-minute demo script

| Time | Beat | On screen |
|---|---|---|
| 0:00 | **The problem.** "Stock sits in Ludhiana. Need is in Ferozepur. Nobody connects them." | Map with idle stock and red camps |
| 0:25 | **Messy report in.** Paste "Camp 17 needs drinking water for approximately 600 people" and a Hinglish one | Intake page |
| 0:50 | **AI structures it.** Water, 9,000 L/day, Critical, Camp 17, with confidence. The shaky one goes to review | Parsed result, review queue |
| 1:20 | **Matching runs.** Move appears: depot, quantity, ETA, **why** | Map and move card |
| 1:50 | **Before and after.** Naive vs ReliefOS: coverage and time | KPI panel (label "simulated") |
| 2:15 | **New critical report arrives**, plan re-balances live | Moves change |
| 2:35 | **Close.** Who pays: NGO SaaS, CSR dashboards, government pilots. "Right help. Right place. Right time." | Closing slide |

Rule: say "real-time" only for what you just showed.

---

## ❓ Judge Q&A cheat sheet

| Question | Answer |
|---|---|
| *"Hasn't IDRN or Sahana done this?"* | "Those are registries and request trackers. We add AI intake and an explainable, capacity-aware decision layer, and can sit on top of them." ([details](07_competitive_landscape.md)) |
| *"What if the LLM is wrong?"* | "Confidence scores, validation against Sphere ranges, human approval before dispatch. Literature shows request classification is noisy, so we designed for it." |
| *"How accurate is it?"* | "X% field accuracy on our 150-message test set" (use the real number) |
| *"Where does data come from?"* | "NGO and warehouse uploads, field forms, messages. Pilot with one district or NGO network." |
| *"No connectivity?"* | "Field form queues offline and syncs later. Honest status: basic queue built, full sync is next." |
| *"How did you build so much?"* | "We prepared before the event, as the format encourages. Here is what we built on site." (only if the rules allowed it) |
| *"Who pays?"* | "NGO SaaS first; CSR teams want delivery proof; government contracts later." |
| *"Impact numbers?"* | "Simulated on a Punjab-style scenario. Method is in the repo." |

---

## 🧰 Packing and on-the-day checklist

- [ ] Laptops × 2 with repo, data and cached responses; chargers; extension cord
- [ ] Phone hotspot with data; HDMI and USB-C adapters
- [ ] Repo zip and demo video on a USB drive and on phones
- [ ] Printed one-page architecture (`images/architecture.jpg`) and QR code to the repo
- [ ] Demo inputs saved in a text file for copy-paste
- [ ] Sleep shifts agreed: two awake, two resting, rotate every 4 hours
- [ ] Pitch rehearsed 3 times, timed

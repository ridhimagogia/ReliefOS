<div align="center">

# 📖 ReliefOS Study Guide and Resource Hub

**What to study · what to read · where the data lives · what to verify**

[⬅ Back to README](../README.md)

</div>

### How to use this page

| Marker | Meaning |
|---|---|
| 🔴 **P1** | Read before **22 Oct** |
| 🟠 **P2** | Read before **28 Oct** |
| 🟢 **P3** | Only if you have time |
| ✅ | Source opened and checked during research |
| ⚠️ | Background knowledge, **not yet verified**. Open it before quoting |

**Jump to:** [Study order](#-1-study-order) · [Papers](#-2-papers-and-handbooks) · [Case studies](#-3-case-studies) · [Platforms](#-4-platforms-and-prior-art) · [Datasets and APIs](#-5-datasets-and-apis) · [Tools](#-6-tools-to-learn) · [Verify before the pitch](#-7-verify-before-the-pitch)

---

## 🧭 1. Study order

| # | Topic | Why it matters for ReliefOS |
|---|---|---|
| 1 | **Humanitarian logistics basics**: unpredictable demand, no price signal, damaged infrastructure | Explains why normal supply-chain tools fail |
| 2 | **Coordination failures and "material convergence"** (unsolicited, unneeded donations) | The core problem we solve |
| 3 | **Allocation models**: transportation problem, min-cost flow, deprivation cost, equity | The maths behind the matcher |
| 4 | **Standards**: Sphere (water, food, shelter), cluster system | Turns "600 people" into quantities |
| 5 | **India's system**: NDMA, NDRF, SDMAs, DDMAs, norms of assistance, IDRN | Who our users are |
| 6 | **LLM extraction from crisis text**: evaluation, hallucination control | The AI layer |
| 7 | **Routing and geocoding**: OSM, OSRM, Nominatim | Distance and ETA |

---

## 📚 2. Papers and handbooks

### 🚚 Humanitarian logistics (the domain)
- 🔴 ✅ Holguín-Veras et al. (2012), *On the unique features of post-disaster humanitarian logistics*, J. Operations Management 30(7-8). [doi](https://doi.org/10.1016/j.jom.2012.08.003)
- 🔴 ✅ Balcik et al. (2010), *Coordination in humanitarian relief chains*, Int. J. Production Economics 126(1). [doi](https://doi.org/10.1016/j.ijpe.2009.09.008)
- 🔴 ✅ Besiou et al. (2023), *Assessing the value of supply chain management in the humanitarian context*, J. Humanitarian Logistics and SCM. This is the **~75% logistics share** study. [Summary](https://www.klu.org/article/emergency-relief-more-efficient-supply-chains-mean-more-help-for-every-euro-donated)
- 🟠 ✅ Rivera-Royero et al. (2016), *A dynamic model for disaster response considering prioritized demand points*, Socio-Economic Planning Sciences 55. [doi](https://doi.org/10.1016/j.seps.2016.07.001)
- 🟠 ✅ Schulz, *Disaster Relief Logistics: Benefits of and Impediments to Horizontal Cooperation* (TU Berlin). [Link](https://depositonce.tu-berlin.de/handle/11303/2383)
- 🟠 ⚠️ Van Wassenhove (2006), *Humanitarian aid logistics: supply chain management in high gear*. Original source of the "~80%" claim, so check it before quoting.
- 🟠 ⚠️ Holguín-Veras et al. (2013) on the appropriate objective function and **deprivation cost**.
- 🟢 Journal of Humanitarian Logistics and Supply Chain Management: browse recent issues.

### 📏 Standards (how demand is defined)
- 🔴 ✅ **Sphere Handbook** (4th ed., 2018): WASH, shelter, food chapters. [spherestandards.org](https://spherestandards.org)
- 🟠 ⚠️ Core Humanitarian Standard (accountability).
- 🟠 ⚠️ NDMA guidelines and SDRF/NDRF relief norms. [ndma.gov.in](https://ndma.gov.in)
- 🟠 ⚠️ UN OCHA cluster system overview (Logistics Cluster, WFP-led).

### 🤖 AI and NLP for disasters
- 🔴 ✅ Xu et al. (2025), *LLM applications in disaster management: an interdisciplinary review*, IJDRR. [doi](https://doi.org/10.1016/j.ijdrr.2025.105642)
- 🔴 ✅ *Harnessing Large Language Models for Disaster Management: A Survey*. [arXiv 2501.06932](https://arxiv.org/abs/2501.06932)
- 🟠 ✅ *"Actionable Help" in Crises: dataset and models for request/offer posts*. [arXiv 2502.16839](https://arxiv.org/abs/2502.16839)
- 🟠 ✅ McDaniel et al., *Zero-shot classification of crisis tweets with instruction-finetuned LLMs*. [arXiv 2410.00182](https://arxiv.org/abs/2410.00182)
- 🟠 ✅ Imran et al., requests/offers taxonomy. [arXiv 2504.16144](https://arxiv.org/abs/2504.16144) · [data](https://crisisnlp.qcri.org/requests_offers/)
- 🟢 ✅ CrisisSense-LLM (multi-label instruction fine-tuning). [arXiv 2406.15477](https://arxiv.org/abs/2406.15477)

### 🧮 Routing and optimisation
- 🔴 ✅ Luxen and Vetter (2011), *Real-time routing with OpenStreetMap data*, ACM SIGSPATIAL. [doi](https://doi.org/10.1145/2093973.2094062)
- 🟠 ⚠️ [Google OR-Tools docs](https://developers.google.com/optimization): vehicle routing, transportation and assignment problems.
- 🟠 **Problems to learn** (about 1 hour each): transportation, assignment, capacitated VRP, multi-depot VRP, facility location, min-cost flow.
- 🟢 Multi-criteria decision making: weighted sum, TOPSIS (helps explain prioritisation to judges).

### 🇮🇳 Indian context
- 🔴 ✅ Down To Earth (2025), *Punjab floods: were state and central agencies on the same page?* [Read](https://www.downtoearth.org.in/natural-disasters/punjab-floods-2025-were-state-and-central-agencies-on-the-same-page-regarding-information-exchange-and-disaster-response)
- 🟠 ⚠️ NDMA situation reports and NDRF pages.
- 🟠 ⚠️ [ReliefWeb India](https://reliefweb.int/country/ind): NGO field reports.

---

## 🌊 3. Case studies

Find an after-action review for each from OCHA, IFRC, NDMA, ReliefWeb or journals. Write a half-page per case in the format used in [`02_case_studies.md`](02_case_studies.md).

| Case | Why read it | Status |
|---|---|---|
| Punjab floods 2025 | Closest to our demo, parallel uncoordinated relief | ✅ in `02` |
| Kerala floods 2018 | Unsolicited goods, public needs lists | ✅ in `02` |
| Pakistan floods 2022/2025 | Regional comparison, Telegram as the "system" | ✅ in `02` |
| Haiti 2010 | Classic unusable-donations case, crisis mapping | ⬜ |
| Nepal 2015 | Material convergence | ⬜ |
| Chennai floods 2015 | Crowd-sourced relief on social media | ⬜ |
| Cyclone Fani 2019, Amphan 2020 | Odisha/Bengal preparedness, a success story | ⬜ |
| Wayanad landslide 2024 | Modern volunteer coordination | ⬜ |
| Turkey-Syria 2023 | Warehouse and logistics coordination | ⬜ |

---

## 🥊 4. Platforms and prior art

Check what each does **now** and whether it is still active (see [`07_competitive_landscape.md`](07_competitive_landscape.md)).

| Platform | Look at |
|---|---|
| [ReliefWeb](https://reliefweb.int) | Reports and news feed (has an API) |
| [HDX](https://data.humdata.org) | Humanitarian datasets, UN OCHA |
| Ushahidi, Sahana Eden, Crisis Cleanup | Crowd reporting, open-source disaster management |
| [Logistics Cluster](https://logcluster.org), WFP tools | Large-agency logistics |
| IFRC GO | Red Cross operations and alerts |
| IDRN, NDMA SACHET | Indian government resource registry and alerts |
| keralarescue.in (2018) | The manual needs-board precedent |
| [HOT (Humanitarian OSM Team)](https://www.hotosm.org) | Mapping for response |

---

## 🗃️ 5. Datasets and APIs

| Need | Where |
|---|---|
| 🗺️ Admin boundaries, India data | [HDX](https://data.humdata.org) |
| 📰 Disaster reports | [ReliefWeb API](https://reliefweb.int) |
| 💬 Crisis tweets for NLP tests | CrisisNLP, HumAID, CrisisMMD, CrisisBench, Kaggle "Disaster Tweets" |
| 🛣️ Maps and roads | [OpenStreetMap](https://www.openstreetmap.org), Geofabrik India extract, [Overpass Turbo](https://overpass-turbo.eu) |
| 🧭 Routing | OSRM, OpenRouteService, Valhalla |
| 📍 Geocoding | Nominatim (check usage policy), Photon |
| 🚨 Alerts | GDACS, USGS earthquakes, NDMA SACHET |
| 📐 Standards and formats | Sphere Handbook, OASIS EDXL-RM (resource messaging) |

More detail and how to build our own 150-message gold set: [`03_datasets.md`](03_datasets.md).

---

## 🛠️ 6. Tools to learn

| Tool | For |
|---|---|
| OR-Tools, SciPy `linprog` | Matching optimisation |
| Gemini API structured output ([ai.google.dev](https://ai.google.dev)) | Reliable JSON from messy text |
| Pydantic | Validating extracted records |
| rapidfuzz | Fuzzy matching of camp and place names |
| Leaflet | Map frontend |

---

## ✅ 7. Verify before the pitch

- [ ] Every statistic on a slide: source and year opened and checked
- [ ] Current scope of IDRN and any NDMA relief platforms
- [ ] Current Gemini model names, limits and pricing
- [ ] Data-protection duties under India's **DPDP Act** for beneficiary data
- [ ] Hackathon rules on pre-written code

> 💡 **Rule of thumb:** a number goes on a slide only if it is marked ✅ and you have opened the source yourself.

# Research starter: what to study and where to look

**Important:** this was written from my own knowledge, not from a live web search. I did not verify statistics, so none are quoted here. Open each source and take numbers from it directly before they go into slides.

## 1. Topics to study (in order)
1. Humanitarian logistics basics: why it is different from commercial logistics (unpredictable demand, no price signal, damaged infrastructure).
2. Coordination failures and "material convergence" (unsolicited, unneeded donations).
3. Supply-demand allocation models: transportation problem, min-cost flow, deprivation cost, equity.
4. Humanitarian standards: Sphere minimum standards (water, food, shelter), cluster system.
5. India's disaster system: NDMA, NDRF, SDMAs, DDMAs, norms of assistance, IDRN.
6. LLM information extraction from crisis text, evaluation, hallucination control.
7. Routing and geocoding basics (OSM, OSRM, Nominatim).

## 2. Papers (from your deck; others to search by title)
- Holguín-Veras et al. (2012), On the unique features of post-disaster humanitarian logistics. https://doi.org/10.1016/j.jom.2012.08.003
- Balcik et al. (2010), Coordination in humanitarian relief chains. https://doi.org/10.1016/j.ijpe.2009.09.008
- Rivera-Royero et al. (2016), A dynamic model for disaster response considering prioritized demand points. https://doi.org/10.1016/j.seps.2016.07.001
- Xu et al. (2025), LLM applications in disaster management. https://doi.org/10.1016/j.ijdrr.2025.105642
- Luxen & Vetter (2011), Real-time routing with OpenStreetMap data. https://doi.org/10.1145/2093973.2094062
- Search by title: Van Wassenhove (2006) "Humanitarian aid logistics: supply chain management in high gear" (source of the often-quoted "logistics is ~80% of relief cost"; check the original before using it). Holguín-Veras et al. (2013) on the appropriate objective function / deprivation cost.
- Down To Earth (2025), Punjab floods coordination: link in your deck.

## 3. Case studies to read (find reputable reports for each)
Haiti 2010; Nepal 2015; Kerala floods 2018; Chennai floods 2015; Cyclone Fani 2019 and Amphan 2020 (Odisha preparedness, a success story); Punjab floods 2025; Wayanad landslide 2024; Turkey-Syria 2023. Look for after-action reviews from OCHA, IFRC, NDMA, ReliefWeb and academic journals.

## 4. Platforms and tools to look at (competitor and prior-art check)
ReliefWeb, Humanitarian Data Exchange (HDX), Ushahidi, Sahana Eden, Crisis Cleanup, WFP/Logistics Cluster tools, IFRC GO, India's IDRN and NDMA SACHET, keralarescue.in (2018). Check what each currently does and whether it is still active.

## 5. Datasets and APIs
| Need | Where |
|---|---|
| Admin boundaries, India humanitarian data | https://data.humdata.org |
| Disaster reports/news feed | https://reliefweb.int (API) |
| Crisis tweets for NLP tests | CrisisNLP, HumAID, CrisisMMD, Kaggle "Disaster Tweets" |
| Maps, roads | https://www.openstreetmap.org, Geofabrik India extract |
| Routing | OSRM, OpenRouteService, Valhalla |
| Geocoding | Nominatim (check usage policy), Photon |
| Alerts | GDACS, USGS earthquakes, NDMA SACHET |
| Standards | Sphere Handbook (spherestandards.org), OASIS EDXL-RM |

## 6. Tools and docs to learn
Google OR-Tools and SciPy `linprog`; Gemini API structured output (ai.google.dev); Leaflet docs; Pydantic; rapidfuzz for fuzzy name matching.

## 7. What to verify before the pitch
- Every statistic you plan to quote, with its source and year.
- Current scope of IDRN and any NDMA relief platforms.
- Current Gemini model names, limits and pricing.
- Data-protection duties under India's DPDP Act for beneficiary data.
- Hackathon rules on pre-written code.

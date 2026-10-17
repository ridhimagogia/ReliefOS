# 04. Reading List

Priority: **P1** = read before Oct 22, **P2** = before Oct 28, **P3** = if time.

## Humanitarian logistics (the domain)
- P1 Holguin-Veras et al. 2012, "On the unique features of post-disaster humanitarian logistics", J. Operations Management 30(7-8). https://doi.org/10.1016/j.jom.2012.08.003
- P1 Balcik et al. 2010, "Coordination in humanitarian relief chains", Int. J. Production Economics 126(1). https://doi.org/10.1016/j.ijpe.2009.09.008
- P1 Besiou et al. 2023, "Assessing the value of supply chain management in the humanitarian context", J. Humanitarian Logistics and Supply Chain Mgmt (the 75% study). Summary: https://www.klu.org/article/emergency-relief-more-efficient-supply-chains-mean-more-help-for-every-euro-donated
- P2 Rivera-Royero et al. 2016, "A dynamic model for disaster response considering prioritized demand points", Socio-Economic Planning Sciences 55. https://doi.org/10.1016/j.seps.2016.07.001
- P2 Schulz, "Disaster Relief Logistics: Benefits of and Impediments to Horizontal Cooperation" (TU Berlin). https://depositonce.tu-berlin.de/handle/11303/2383
- P3 Journal of Humanitarian Logistics and Supply Chain Management (browse recent issues).

## Standards (how demand is defined)
- P1 The Sphere Handbook (4th ed., 2018), WASH, shelter, food chapters. https://spherestandards.org
- P2 Core Humanitarian Standard (accountability).
- P2 NDMA India guidelines and SDRF/NDRF relief norms. https://ndma.gov.in [B]
- P2 UN OCHA cluster system overview (Logistics Cluster, WFP-led). [B]

## AI/NLP for disasters
- P1 Xu et al. 2025, "Large language model applications in disaster management: an interdisciplinary review", IJDRR. https://doi.org/10.1016/j.ijdrr.2025.105642
- P1 "Harnessing Large Language Models for Disaster Management: A Survey", arXiv 2501.06932.
- P2 "Actionable Help in Crises: A Novel Dataset and Resource-Efficient Models for Identifying Request and Offer Social Media Posts", arXiv 2502.16839.
- P2 McDaniel et al., "Zero-Shot Classification of Crisis Tweets Using Instruction-Finetuned LLMs", arXiv 2410.00182.
- P2 Imran et al., requests/offers taxonomy paper, arXiv 2504.16144; data at https://crisisnlp.qcri.org/requests_offers/
- P3 CrisisSense-LLM (multi-label instruction fine-tuning), arXiv 2406.15477.

## Routing and optimisation
- P1 Luxen and Vetter 2011, "Real-time routing with OpenStreetMap data", ACM SIGSPATIAL. https://doi.org/10.1145/2093973.2094062
- P2 OR-Tools documentation: vehicle routing, transportation/assignment problems. https://developers.google.com/optimization [B]
- P2 Classic problem names to learn: transportation problem, assignment problem, capacitated vehicle routing (CVRP), multi-depot VRP, facility location. Each is a 1-hour read.
- P3 Multi-criteria decision making: weighted sum, TOPSIS (for explaining prioritisation).

## Indian context
- P1 Down To Earth analysis of Punjab floods 2025 (coordination). https://www.downtoearth.org.in/natural-disasters/punjab-floods-2025-were-state-and-central-agencies-on-the-same-page-regarding-information-exchange-and-disaster-response
- P2 NDMA situation reports; NDRF pages. [B]
- P2 ReliefWeb India country page for NGO field reports. https://reliefweb.int/country/ind [B]

## Data platforms to explore (bookmark)
- HDX https://data.humdata.org
- ReliefWeb https://reliefweb.int
- OpenStreetMap / Overpass Turbo https://overpass-turbo.eu
- Logistics Cluster https://logcluster.org [B]
- Humanitarian OpenStreetMap Team https://www.hotosm.org [B]

---
## Additions (merged from the second research kit; items not yet verified [B])
**Extra topics:** material convergence (unsolicited, unneeded donations); min-cost flow, deprivation cost and equity in allocation; India's system (NDMA, NDRF, SDMAs, DDMAs, norms of assistance, IDRN).
**Extra papers:** Van Wassenhove (2006), "Humanitarian aid logistics: supply chain management in high gear" (original source of the "~80%" claim; check it before quoting). Holguin-Veras et al. (2013) on the appropriate objective function / deprivation cost.
**Extra platforms to check for prior art:** Crisis Cleanup, IFRC GO, keralarescue.in (2018), NDMA SACHET.
**Extra data and APIs:** ReliefWeb API; Geofabrik India extract; OpenRouteService, Valhalla (routing); Photon (geocoding; check Nominatim usage policy); GDACS, USGS earthquakes (alerts); Kaggle "Disaster Tweets"; OASIS EDXL-RM (resource messaging standard).
**Extra tools:** SciPy `linprog`, Pydantic, rapidfuzz, Gemini structured output (ai.google.dev).
**Verify before the pitch:** DPDP Act duties for beneficiary data; current Gemini model names, limits, pricing; hackathon rules on pre-written code.

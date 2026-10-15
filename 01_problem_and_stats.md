# 01. Problem and Stats

## 1. The core claim and its evidence

**Logistics eats most of the money in a relief operation.**
- Often-quoted range: 60-80% of humanitarian response cost is supply chain/logistics. For years this was repeated without proof. [V]
- A 2023 study (Besiou et al., *Journal of Humanitarian Logistics and Supply Chain Management*, Kuhne Logistics University) tested it: across 20 response operations in 14 countries (2005-2018, five aid organisations), about 203M of 276M euros went to supply chain management, roughly **75%**. Conflict and epidemic settings were costlier. [V]
  - Source: https://www.klu.org/article/emergency-relief-more-efficient-supply-chains-mean-more-help-for-every-euro-donated
- Older papers and trade bodies (ALAN, TU Berlin thesis by Schulz) cite "up to 80%". Use "60-80%, confirmed at ~75% in a 2023 study" on slides. [V]

**Why this matters for the pitch:** even a few points of logistics efficiency frees a lot of relief money. ReliefOS targets exactly that lever.

## 2. Coordination is the repeated failure

- Humanitarian logistics literature names weak coordination between organisations as one of the most criticised issues. [V] (Schulz, TU Berlin)
- Core academic references already in your PPT: Holguin-Veras et al. 2012 (unique features of post-disaster logistics), Balcik et al. 2010 (coordination in relief chains).
- Pakistan 2022 floods: a survey by IWMI found 58% of respondents did not receive early warning; the system involves 27 stakeholders and 39 ministries, and coordination problems blocked effective response. [V] https://www.iwmi.org/news/inclusive-disaster-management-is-key-to-ensuring-safe-internal-climate-migration-in-pakistan/
- Punjab (India) 2025: Down To Earth's review of situation reports found state-central information sharing started late; the first central flood report mentioning Punjab was dated 27 Aug 2025 though flooding began 14 Aug. [V] (details in 02_case_studies.md)

## 3. Mismatch, not scarcity (Kerala 2018)

- State government told the Indian mission in the UAE that unsolicited, uncoordinated material was a distraction, and that verifying arriving supplies costs extra manpower. They asked for money instead. [V] https://www.khaleejtimes.com/uae/send-money-to-relief-fund-not-supplies-indian-envoy
- In 2019 Kerala published district-wise needs lists and collection-centre locations on its "Kerala Rescue" site. This is a manual version of what ReliefOS automates. [V] https://www.thenewsminute.com/amp/story/kerala/kerala-needs-your-help-collection-centres-relief-materials-almost-empty-year-107050

## 4. Minimum standards: what "demand" should mean (Sphere Handbook)

These give the AI layer and the matching engine a defensible way to convert "600 people" into quantities. [V]

| Need | Sphere minimum |
|---|---|
| Water | 15 L per person per day (7.5 L short-term survival in acute drought, ~50 L in urban middle-income settings) |
| Water access | nearest water point within 500 m, queue under 30 min |
| Shelter | 3.5 m2 covered living space per person (4.5-5.5 m2 in cold climates) |
| Food energy | 2,100 kcal per person per day |
| Hygiene | 250 g bath soap per person per month; 200 g laundry soap; 10-20 L water containers per household |

Sources: https://spherestandards.org (Sphere in Practice PDF; Intro to Sphere slides). Table value for water: "Water Supply Standard 2.1".

**Use in ReliefOS:** `needs_calculator.py` multiplies headcount by these per-person rates so "water for 600 people" becomes about 9,000 L/day minimum. This turns vague text into a number the matcher can use. (15 x 600 = 9,000.)

## 5. NLP/AI evidence that the "messy text to structured demand" layer is feasible

- A taxonomy and dataset exist for classifying crisis posts as requests and offers, multi-label (one post can be both). https://crisisnlp.qcri.org/requests_offers/ [V]
- A 2025 paper reports that only about 41% of posts labelled "requests" and 38% of "offers" in older datasets actually contained actionable content. This is your reason for human-in-the-loop validation. [V] (arXiv 2502.16839)
- CrisisHelpOffer: 101k tweets labelled by LLMs and validated by humans. [V]
- Zero-shot LLM classification of crisis tweets was evaluated for GPT-4o, Gemini 1.5 Flash and Claude 3.5 Sonnet on CrisisBench; performance varied a lot by dataset. [V] arXiv 2410.00182
- Survey: "Harnessing LLMs for Disaster Management" (arXiv 2501.06932) and your PPT's Xu et al. 2025 review.

**Takeaway:** LLM extraction is credible, but quality is uneven. Design for confidence scores plus a human confirm step. That is also already your "Inaccurate Demand Data" mitigation.

## 6. Numbers still to collect (assign to team)

- India: NDMA / NDRF deployment figures for a recent flood (Punjab 2025 situation reports).
- India: NDMA guidelines on relief camp standards and relief norms (SDRF/NDRF norms of assistance).
- Share of donations that are "non-priority" or unusable in recent disasters (search ReliefWeb evaluations; Haiti 2010 and Nepal 2015 have documented cases). [B] not yet verified.
- Typical truck capacity and cost per km for Indian relief transport (for the cost model).

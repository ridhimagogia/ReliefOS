# 03. Datasets and Data Sources

Rule for the hackathon: **real data for the map and NLP evaluation, synthetic data for supply/demand scenarios** (no public live supply inventory exists).

## A. Humanitarian and geographic data

| Source | Use in ReliefOS | Notes |
|---|---|---|
| Humanitarian Data Exchange (HDX), UN OCHA | India admin boundaries, population, health facilities, hazard layers | Launched 2014; 20,000+ datasets; has an API (HAPI) for standardised indicators. https://data.humdata.org [V] |
| OpenStreetMap | Roads, warehouses, schools, hospitals as potential camps/depots | Free; routing via OSRM (Luxen and Vetter 2011 is in your PPT) [V] |
| GADM / Survey of India boundaries | District/block polygons | [B] |
| India Disaster Resource Network (IDRN), NDMA | Registry of equipment and resources | Check access and format. [B] |
| WorldPop / Census population grids | Estimate people per area to scale demand | [B] |
| IMD, CWC (flood forecast), NDMA SACHET alerts | Optional later layer for risk context | Out of scope for MVP (your brief says this is not prediction). [B] |

## B. NLP: turning messy reports into structured demand

| Dataset | What it is | Use |
|---|---|---|
| CrisisNLP (QCRI) | Large collection of labelled crisis tweets, humanitarian classes | Few-shot examples, evaluation [V] |
| CrisisBench | Consolidated benchmark of crisis tweet datasets | Evaluate LLM prompts [V] |
| CrisisMMD | 16k labelled tweets with images from 7 disasters (2017) | Photo + text experiments [V] |
| HumAID | Disaster tweets, humanitarian categories | Evaluation [V] |
| Requests and Offers taxonomy and data (QCRI) | Multi-label request/offer taxonomy | Define your own label schema; https://crisisnlp.qcri.org/requests_offers/ [V] |
| CrisisHelpOffer | 101k tweets, request/offer labels | Reference; arXiv 2502.16839 [V] |
| Hindi/Hinglish crisis text | Little public data | Create your own 100-200 samples (see below) |

**Make your own gold set (do this in week 1):** write 150 realistic field messages (English, Hindi, Hinglish, typos, voice-to-text noise, photos of handwritten lists) with the expected structured output. This beats any public dataset for demo and for measuring accuracy.

Target schema:
```
{ item, quantity, unit, beneficiaries, urgency (Critical/High/Medium/Low),
  location_text, lat, lng, contact, confidence, raw_text, source }
```

## C. Synthetic scenario data (build this ourselves)

- 8-12 depots (NGO warehouses, state stockpiles) with item-wise stock and expiry for medical items.
- 15-25 camps with headcount and needs, spread across a realistic geography (e.g., Punjab districts).
- Vehicle fleet: type, capacity, location, speed.
- Use Sphere rates (see 01) to derive needs from headcount so the numbers are defensible.
- Create 3 named scenarios: "Punjab flood", "Cyclone coast", "Mountain landslide" with different road constraints.

## D. Photos and OCR

- Sample handwritten requisition sheets and printed stock lists (make ~20 yourselves).
- Tesseract struggles with handwriting. Plan: send the image to a vision-capable LLM and use Tesseract only for clean printed text.

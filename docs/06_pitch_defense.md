# 06. Pitch Defense: Likely Judge Questions

## About the idea
**"Isn't this just a spreadsheet plus a map?"**
Spreadsheets need clean data. Our value is (1) turning calls, texts and photos into structured demand, and (2) ranking moves by urgency, distance and truck capacity together. Show the messy text going in and a ranked move list coming out.

**"Does something like this already exist?"**
Pieces exist (crisis mapping, cluster coordination tools, government resource registries). See 07. Our difference: one shared layer across NGOs, government and donors, with AI intake and recommendations. Be honest about prior work. Never claim "nobody has done this".

**"Why does it matter?"**
Logistics is roughly 75% of relief spending in a 2023 study (60-80% in the older literature). Matching failures were documented in Punjab 2025 and Kerala 2018 (see 02).

## About the tech
**"Why rule-based matching and not ML?"**
Relief needs explainable, auditable decisions. A transparent scoring function (availability, urgency, distance) can be justified to a district officer. Next step is optimisation (transportation/assignment problem) with the same inputs; ML later for demand estimation.

**"What if the LLM misreads a report?"**
Every extracted record gets a confidence score, validation rules (units, plausible ranges using Sphere rates) and a human confirm step before it enters matching. Literature shows request classification is noisy (only about 41% of "requests" in older datasets were actually actionable), so we designed for it.

**"What about no internet in disaster zones?"**
Field form works offline and syncs later; SMS/WhatsApp intake as a channel. (Design details in Step 2.)

**"Data privacy and misuse?"**
Role-based access; coordinates of camps are not personal data; no victim-level personal data stored in MVP. Audit trail of recommendations.

## About business
**"Who pays?"**
NGO SaaS, CSR management (CSR teams want proof of delivery), government contracts, logistics partnerships (your PPT/brief). Pick **one** first customer for the pitch: a state/district disaster authority pilot or a mid-size NGO network.

## Pitch hygiene
- Say "real-time" only for what the demo actually shows.
- Use numbers with sources on the slide.
- Show one flawless end-to-end story: message in, structured demand, match, move recommendation with ETA.

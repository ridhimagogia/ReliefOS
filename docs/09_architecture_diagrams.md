# ReliefOS: Architecture

Everything below builds on the stack in your deck (Tesseract + Gemini, Flask, MySQL, rule-based matching, OSM + Leaflet, React). Two changes are recommended: swap the rule-based score for a small LP (see `prototype/match.py`), and add a human review queue.

## 1. System architecture

```mermaid
flowchart LR
  subgraph Intake
    A[Web form / PWA<br/>offline-capable] --> Q
    B[WhatsApp / SMS<br/>Twilio or Gupshup] --> Q
    C[Photo / PDF forms] --> OCR[Tesseract or Gemini vision]
    OCR --> Q
    V[Voice note] --> STT[Whisper] --> Q
  end
  Q[(Raw report queue)] --> X[LLM extractor<br/>Gemini + JSON schema]
  X --> VAL[Validator<br/>units, quantity sanity,<br/>fuzzy camp match, dedupe]
  VAL -->|confidence >= 0.8| DEM[(Demand table)]
  VAL -->|low confidence| HR[Human review queue]
  HR --> DEM
  INV[Stock updates<br/>warehouses / NGOs / govt] --> STK[(Inventory table)]
  DEM --> M[Matching engine<br/>urgency score + LP]
  STK --> M
  RT[Routing<br/>OSRM or haversine fallback] --> M
  M --> REC[(Recommendations)]
  REC --> API[Flask / FastAPI REST]
  API --> UI[React dashboard<br/>Leaflet map]
  UI -->|approve / dispatch| API
  API --> DB[(MySQL / Postgres+PostGIS)]
```

## 2. End-to-end workflow (sequence)

```mermaid
sequenceDiagram
  participant FW as Field worker
  participant API as Backend
  participant LLM as Gemini extractor
  participant V as Validator
  participant M as Matcher
  participant OP as Relief coordinator
  FW->>API: "Camp 17 needs drinking water ~600 people"
  API->>LLM: text + JSON schema + known camp list
  LLM-->>API: {item: water, qty_people: 600, urgency: critical, location: Camp 17, confidence: 0.92}
  API->>V: validate, normalise (600 people x 15 L x 1 day = 9000 L)
  V-->>API: ok / needs review
  API->>M: new demand event
  M->>M: re-solve LP (rolling horizon)
  M-->>API: Move 6000 L from Warehouse A to Camp 17, ETA 3.2 h
  API-->>OP: Ranked recommendation + "why this match"
  OP->>API: Approve and dispatch
  API-->>FW: Status update, delivery confirmation (QR / OTP)
```

## 3. Matching logic

```mermaid
flowchart TD
  S[New demand or stock change] --> N[Normalise to item and quantity]
  N --> U[Urgency = tier + vulnerable share + waiting-time ageing]
  U --> D[Distance and ETA matrix<br/>road routing, or haversine x 1.3]
  D --> L[Per-item LP<br/>max urgency-weighted coverage, min distance]
  L --> C{Transport capacity OK?}
  C -->|no| SP[Split loads or pick next vehicle]
  C -->|yes| R[Ranked moves + explanation]
  SP --> R
  R --> H[Human approval]
```

Why LP instead of the plain score: a greedy "best match" double-allocates the same stock and can't split a warehouse across camps. The LP handles both and still runs in milliseconds at hackathon scale.

## 4. Data model

```mermaid
erDiagram
  LOCATION ||--o{ SUPPLY_LOT : holds
  LOCATION ||--o{ DEMAND : at
  LOCATION { int id string name string type float lat float lon }
  SUPPLY_LOT { int id int location_id string item int qty date expiry }
  DEMAND { int id int location_id string item int qty string tier float confidence string status int report_id }
  REPORT ||--o{ DEMAND : produces
  REPORT { int id text raw_text string channel string lang datetime received }
  VEHICLE { int id string type int capacity_kg int home_location_id }
  MOVE }o--|| SUPPLY_LOT : from
  MOVE }o--|| DEMAND : to
  MOVE { int id int qty float km float eta_h string status }
```

## 5. Deployment (hackathon)

```mermaid
flowchart LR
  U[Browser] --> FE[React on Vercel/Netlify]
  FE --> BE[FastAPI on Render/Railway]
  BE --> DB[(Postgres or MySQL)]
  BE --> G[Gemini API]
  BE --> O[OSRM demo or haversine]
```

## 6. Stack decisions

| Layer | Your deck | Recommendation |
|---|---|---|
| Backend | Flask | Fine. FastAPI is nicer for typed JSON schemas (Pydantic), but don't switch if the team knows Flask. |
| DB | MySQL | Fine for the hackathon. Postgres + PostGIS is better for geo queries later. |
| Matching | Rule-based | Keep the score for urgency, add the LP on top. |
| Extraction | Tesseract + Gemini | Use Gemini for both text and images. Keep Tesseract only as a fallback. |
| Routing | OSM + Leaflet | Leaflet for display. For distance use haversine x 1.3 and add OSRM only if time allows. |
| Offline | "Lightweight UI + sync" | Build a simple PWA form that queues to localStorage. Don't build real sync. |

Open items to check before the day: current Gemini model names and free-tier rate limits at ai.google.dev, and whether the OSRM public demo server is acceptable for your use (it has usage limits).

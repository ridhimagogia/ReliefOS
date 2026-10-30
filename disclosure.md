# 🚑 ReliefOS

Disaster-relief matching that works on a local network with zero internet. It turns messy field reports into structured demand, matches them to available stock, and proposes dispatches that a human coordinator approves. 📴

Built for the Chandigarh University hackathon, 30–31 Oct 2026.

## 📋 Disclosure: what was built before vs. during

We want judges to see exactly what is new at this event and what is not.

### 🕰️ Before the hackathon (prep work, 25–29 Oct)
Our prep repo: `<link to original repo>`

The core rule engine was prebuilt. The frontend was not: only a basic mock-data prototype existed, and we are rebuilding it during the event, so none of the new frontend counts as prior work.

| Component | State at hackathon start |
|---|---|
| Matching engine (scoring, greedy allocator, LP toggle, shortage reports) | Written and unit-tested |
| Geo-routing (haversine ×1.3, offline-safe) | Written and unit-tested |
| Offline node (join endpoint, QR, basemap validator) | Written, not tested on a phone |
| Extraction (rules + Gemini fallback) | Written for 5 items |
| Old frontend | Basic mock-data prototype only, being replaced |
| Stub dictionaries, helper scripts | Placeholders |
| Research and architecture docs | Written |

35 unit tests existed and passed before the event.

### 🏁 During the hackathon (30–31 Oct)
- **Frontend rebuilt from scratch** (new coordinator console, public report page, offline queue, map) and wired to the real API
- Flask backend (`app.py`), API endpoints, seed data, `requirements.txt`
- Real item, unit and gazetteer dictionaries (Hindi/Hinglish)
- Extraction fixes, duplicate clustering, supply parsing
- Integration: extraction → matching → dashboard
- Human review queue
- Phone test over hotspot, with QR join
- Bug fixes, demo polish, slides, deployment

The import commit in this repo's history, `Import prep modules`, marks where prep work ends. Commits after it were made during the event.

## 🛠️ Stack
Flask · React · SVG map with local GeoJSON basemap · rule-based scoring + LP · Gemini (online only) · haversine routing

## ▶️ Run
```bash
pip install -r requirements.txt
OFFLINE_MODE=1 bash scripts/run_offline.sh
pytest
```

## 👭 Team
Ridhima (lead), Khushali, Navya, Aastha

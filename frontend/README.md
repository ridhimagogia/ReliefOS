# ReliefOS Frontend

React 19 + TypeScript + Vite + Tailwind CSS frontend for ReliefOS disaster-relief coordination.

## Architecture & Integration

- **Real API by Default**: All pages request live endpoints via `src/services/api.ts` (proxied in Vite to `http://localhost:5000/api`).
- **Demo / Mock Mode**: Controlled strictly by `VITE_MOCK_MODE=1` (or `true`). When unset, failed API calls surface realistic error states with retry buttons rather than silently faking responses.
- **Offline-First Resilience**:
  - Offline banner wording: *"Works with zero internet on a local network. Internet adds AI parsing and chat-app intake."*
  - Unstructured field intake and `/public` reports are queued in browser **IndexedDB** (`reliefos-offline`, v2) with unique `client_uuid` and timestamps.
  - Strict chronological FIFO replay upon network reconnection.
  - Idempotency guarantees: double sends of the same UUID return the existing record without duplicate creation.
- **Zero External Network Dependencies**:
  - Basemap rendered from local GeoJSON (`/basemap/punjab_districts.geojson`) and SVG projection.
  - Zero CDN fonts, scripts, or external tile downloads in standard offline operation.
  - Optional online satellite/street tiles are loaded only when `VITE_MAPS_API_KEY` is explicitly configured.

## Local Development

```bash
# Install dependencies
npm install

# Typecheck
npm run typecheck

# Start dev server (proxies /api to http://localhost:5000)
PORT=5173 npm run dev

# Demo mode (mock fallback)
VITE_MOCK_MODE=1 npm run dev

# Build for production (served by Flask backend from dist/)
npm run build
```

## Directory Structure

- `src/App.tsx`: Coordinator application shell and all core pages (Dashboard, Field Intake, Review Queue, Matching Results, Stock & Depots, Needs Board, Offline Status, Join QR page) with Toast notifications and real-time backend synchronization.
- `src/components/PublicReport.tsx`: Public citizen reporting portal (`/public` or `#/public`).
- `src/components/ReliefMap.tsx`: Vector SVG basemap with GeoJSON district boundaries, camp urgency indicators, unverified alert rings, and dispatch route polylines.
- `src/services/api.ts`: Typed client for all backend endpoints (`/demands`, `/intake`, `/public/report`, `/demands/<id>/verify`, `/demands/<id>/correct`, `/demands/<id>/reject`, `/stock`, `/supply/paste`, `/supply/csv`, `/match/run`, `/plan/latest`, `/moves/<id>/approve`, `/moves/<id>/edit`, `/moves/<id>/reject`, `/audit`, `/shortages`, `/locations`, `/items`, `/health`, `/join`).
- `src/offline/reportQueue.ts`: IndexedDB queue with FIFO replay, back-off retries, and offline-online status detection.
- `src/types.ts`: TypeScript contracts matching the ReliefOS engine and backend adapters.

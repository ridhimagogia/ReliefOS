# ReliefOS frontend

Interactive React + Vite prototype for disaster-relief coordination in Punjab.

## Local development

Requirements are defined in `.mise.toml` (Node.js and pnpm).

```bash
pnpm install
pnpm dev
```

The Figma Make environment starts the development server automatically; do not run a second server there. For a production check:

```bash
pnpm build
pnpm preview
```

## Demo mode

`src/services/api.ts` exports `MOCK_MODE = true`. All seven screens use shared data from `src/data/mockData.ts`. Set up real API methods in `src/services/api.ts` before disabling mock mode; pages intentionally do not call `fetch` directly.

Field reports use IndexedDB through `src/offline/reportQueue.ts`. A queued report retains its UUID, creation time, text, source, and state. Reports are retried in creation order after a real browser reconnection and are removed only after the API service resolves successfully.

Maps are rendered locally as data-driven SVG views. They require no CDN or internet connection; markers, selection, popups, and routes are generated from current location records.

## Backend work remaining

- Replace mock service responses with the agreed Flask endpoints.
- Connect report submission, file upload, approval/rejection, matching, stock mutation, and health checks to the final backend contract.
- Replace the locally rendered schematic district geometry with the project’s authoritative Punjab district GeoJSON when supplied.
- Connect server-returned route geometry/OSRM metadata and AI provider reasoning.
- Add authenticated user/account and notification APIs.
- Confirm conflict handling and idempotency for queued UUIDs with the backend.

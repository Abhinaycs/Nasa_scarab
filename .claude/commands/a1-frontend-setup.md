---
description: "Abhinay #1: scaffold the React + Vite + TS frontend with a typed API client and contract mocks"
---
You are working on Abhinay's track. Read CLAUDE.md, docs/PLAN.md and docs/CONTRACT.md first. Time budget: 30 minutes. Extra notes: $ARGUMENTS

Do this:
1. Scaffold `frontend/` with `npm create vite@latest frontend -- --template react-ts` (non-interactive). Install maplibre-gl, terra-draw, terra-draw-maplibre-gl-adapter, @observablehq/plot, @turf/circle, @turf/area and html-to-image. Don't add a UI framework; plain CSS with CSS variables is enough.
2. `src/types.ts`: TypeScript types that mirror every request and response in docs/CONTRACT.md exactly.
3. `src/api.ts`: `getCalendar`, `getSummary`, `getTimeseries`, `downloadHotspotsCsv` (fetch → blob → save) and `getMeta`. The base URL comes from `import.meta.env.VITE_API_URL` (default `http://localhost:8000`). When `VITE_USE_MOCKS === 'true'`, return the mocks after a 300 ms delay. Errors such as the 413 case should surface the `detail` text.
4. `src/mocks/calendar.json`, `summary.json`, `timeseries.json` and `meta.json` must match the contract. Generate them with a small node script (`scripts/make-mocks.mjs`) that has realistic seasonality: a peak in Apr–May and Oct–Nov (Punjab-like), years 2000 to 2026, and a few "unusually high" months.
5. Layout shell in `App.tsx`:
   - a header with the title "Fire Activity Calendar · India"
   - a left panel for the area and dates (filled in by /a2)
   - a main area with the map on top and the charts below (filled in by /a3)
   - a footer with the data credit "Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m)"
   Use light and dark themes through CSS variables. **No NASA logos.**
6. Add `frontend/.env.example` with `VITE_API_URL=http://localhost:8000` and `VITE_USE_MOCKS=true`. Run `npm run build` to check it compiles.
7. Tick the boxes under "/a1-frontend-setup" in tasks/abhinay.md, commit `a1: frontend scaffold + mocks`, and run `git pull --rebase && git push`. Report how to run it (`cd frontend && npm run dev`), then the next step (`/a2-map-aoi`).

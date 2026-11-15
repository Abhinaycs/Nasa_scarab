---
description: "Abhinay #2: map with polygon drawing, lat/lon + radius, presets and date controls"
---
You are working on Abhinay's track. Time budget: 75 minutes. Extra notes: $ARGUMENTS

Do this:
1. `src/components/MapView.tsx`: a MapLibre map centred on India ([78.9, 22.5], zoom 4) with a free keyless style (`https://tiles.openfreemap.org/styles/positron`, or the MapLibre demo tiles as a fallback). Add scale and navigation controls.
2. Polygon and rectangle drawing with Terra Draw (maplibre adapter), plus Draw polygon, Draw rectangle and Clear buttons. Keep only one AOI at a time. Lift the AOI to app state as a GeoJSON Polygon.
3. `src/components/AoiPanel.tsx`:
   - Tabs: **Draw** | **Lat/Lon + radius** (inputs plus a "use map centre" button, radius 1–200 km, turned into a polygon with turf circle, 64 steps) | **Presets** (simple bounding polygons for Punjab, Haryana, Odisha, Mizoram and Madhya Pradesh, defined in `src/presets.ts`).
   - Show the area in km² (turf area). Above 400,000 km², show an inline warning and disable Analyze.
   - Date range inputs (default 2000-11-01 to today), a Baseline select ("All other years" or "2003–2022"), and an **Analyze** button.
4. Show the AOI on the map as a filled outline. After analysis, fit the map to it.
5. App state: `aoi`, `start`, `end`, `baseline`, `status` (idle / loading / error / ready), and the results. Analyze calls calendar, summary and timeseries in parallel and stores them.
6. Check that keyboard navigation works and the controls have labels.
7. `npm run build` must pass. Tick the boxes under "/a2-map-aoi", commit `a2: map + AOI input`, and run `git pull --rebase && git push`. Then the next step (`/a3-calendar-charts`).

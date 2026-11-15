# Abhinay: frontend + deployment + demo

Run the commands in order in Claude Code from the repo root. Each one ticks its own boxes and pushes.
Interfaces: [docs/CONTRACT.md](../docs/CONTRACT.md). Until Sravani's API is live (about 20:15), work against the mocks.

## /a1-frontend-setup (18:30–19:00)
- [x] `frontend/`: Vite + React + TypeScript
- [x] Dependencies: maplibre-gl, terra-draw (+ maplibre adapter), @observablehq/plot, @turf/circle, @turf/area
- [x] `src/api.ts`: typed client for every contract endpoint, with a `VITE_USE_MOCKS` switch
- [x] `src/mocks/*.json`: realistic fixtures that match the contract exactly
- [x] Layout shell: header, left panel (AOI + dates), main (map + charts)

## /a2-map-aoi (19:00–20:15)
- [x] MapLibre map centred on India (free OSM/OpenFreeMap style, no key)
- [x] Draw polygon / rectangle with Terra Draw; clear button
- [x] Lat/lon + radius form, turned into a circle polygon
- [x] Preset areas (Punjab, Haryana, Odisha, Mizoram, Madhya Pradesh as simple polygons)
- [x] Date range + baseline selector; area check (> 400,000 km² shows a warning)

## /a3-calendar-charts (20:15–21:15)
- [x] Burning calendar: years down, months across, cividis/log colour, value printed in each cell, median + p90 rows
- [x] Anomaly calendar: PuOr diverging ramp centred on the median, "unusually high/low" markers
- [x] Monthly climatology (median + IQR band, current year overlaid)
- [x] Year-to-date cumulative curves (current year highlighted, past years grey)
- [x] Summary cards (peak month, busiest year, this month vs median, season)
- [ ] Switch from mocks to the real API (`VITE_API_URL`): client ready, waiting for the /s4 stubs

## /a4-exports-polish (21:15–22:00)
- [x] Download hotspots CSV, calendar CSV, PNG of each chart
- [x] Raw vs harmonized toggle on the annual chart (the key demo moment)
- [x] Methods & limitations panel (from docs/METHODS.md)
- [x] Loading/error states, mobile layout, accessible colours + table view

## /a5-deploy (22:00–22:45)
- [ ] `render.yaml` blueprint: Python web service (API) + static site (frontend)
- [ ] Deployed; `VITE_API_URL` and `ALLOWED_ORIGINS` set
- [ ] `.github/workflows/keepwarm.yml` pings `/api/health` every 10 minutes
- [ ] Live URL tested in a private window on desktop and phone; URL added to README

## /a6-demo-submission (22:45–23:30)
- [ ] 7-slide deck (or a video of 30 seconds or less) with team name, members, challenge, screenshots, NASA data
- [ ] Uploaded to a public link (Google Drive/YouTube), tested logged out
- [ ] Space Apps project page filled in from docs/SUBMISSION.md; **Submit for Judging before 23:59**

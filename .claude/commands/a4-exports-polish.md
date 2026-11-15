---
description: "Abhinay #4: CSV/PNG downloads, raw-vs-harmonized toggle, methods panel, polish"
---
You are working on Abhinay's track. Time budget: 45 minutes. Extra notes: $ARGUMENTS

Do this:
1. Downloads bar:
   - **Hotspots CSV** (calls `/api/hotspots.csv`; if the `X-Truncated` header is set, warn that the file was capped at 200k rows)
   - **Calendar CSV**, built on the client from the calendar response: year, month, value, source, k, the raw counts and the anomaly fields
   - **PNG** for each chart, using html-to-image on the chart container, at 2× pixel ratio, with a white or dark background that matches the theme
2. On AnnualChart, add a **Raw vs Harmonized** toggle. Raw shows the MODIS and VIIRS series separately, so the 2012 jump is visible; harmonized shows the single series. Add a one-line caption explaining what the jump means. This is the key demo moment, so make it obvious.
3. Methods & limitations: a slide-over panel opened with "About the data". Load the content from `/api/meta` plus a short static text based on docs/METHODS.md (pull it if Sravani has pushed it). Cover the sensors, the cell-day unit, the calibration, the anomaly rules and the limitations (clouds and smoke, counts are not burned area, recent data is provisional).
4. Polish:
   - loading skeletons, plus an error banner that shows the API `detail` text
   - an empty state ("No fires detected in this area and period")
   - a first-load hint ("Draw an area or pick a preset")
   - while the API wakes up from a cold start, show "Waking up the server…" and retry after 3 s, up to 3 times
5. A quick accessibility pass: colour is never the only signal, focus outlines are visible, and charts have `aria-label`s.
6. `npm run build` must pass. Tick the boxes under "/a4-exports-polish", commit `a4: exports + toggle + methods panel`, and run `git pull --rebase && git push`. Then the next step (`/a5-deploy`).

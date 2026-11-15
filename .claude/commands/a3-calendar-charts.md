---
description: "Abhinay #3: burning calendar, anomaly calendar, climatology, YTD curves, summary cards"
---
You are working on Abhinay's track. Time budget: 60 minutes. Use Observable Plot throughout. Extra notes: $ARGUMENTS

Do this:
1. `src/components/BurningCalendar.tsx`:
   - Layout: months across (Jan–Dec) and years down. Each cell shows `value`, coloured with the `cividis` scheme on a log or quantile scale; the number is printed in the cell, with the text colour chosen for WCAG AA contrast against the fill.
   - Footer rows for the median and p90 (from the climatology), as in INPE's table.
   - Provisional months get a hatched or dashed outline. Pre-2012 cells get a small "M" marker (scaled MODIS).
   - The tooltip shows value, raw counts, source, k with its interval, and the anomaly.
   - Clicking a cell selects that month (store it in state for later use).
2. `src/components/AnomalyCalendar.tsx`: the same grid with `pct_of_median − 100` on a diverging `PuOr` scale centred on 0, clamped to ±200. Mark "unusually high" with ▲ and "unusually low" with ▼; cells with a null label are greyed out.
   Add a tab toggle: Counts | Anomalies.
3. `src/components/Climatology.tsx`: the monthly median line with an IQR band (areaY) and the current year overlaid in a strong colour.
4. `src/components/YtdChart.tsx`: one line per year of cumulative values against day of year. Past years are thin grey, the current year is bold, and the max year is labelled.
5. `src/components/SummaryCards.tsx`: peak month, busiest year, "This month vs median" (percent and label, with a provisional badge), fire season (e.g. "Mar–May"), and the total.
6. `src/components/AnnualChart.tsx`: bars of the harmonized annual totals (the raw toggle comes in /a4).
7. Every chart gets a short caption in plain words and a "show table" fallback for accessibility. It must look right on a 390 px wide phone: the calendar scrolls horizontally inside its own container.
8. Switch to the real API. If Sravani's stubs or the real API are pushed, run `git pull`, start the API locally (`.venv/bin/uvicorn backend.app.main:app --port 8000`, after installing backend/requirements.txt if needed) and test with `VITE_USE_MOCKS=false`. Fix any contract mismatch on the frontend side; if the API side is wrong, write it down in the report so the user can tell Sravani.
9. `npm run build` must pass. Tick the boxes under "/a3-calendar-charts", commit `a3: calendar + charts`, and run `git pull --rebase && git push`. Then the next step (`/a4-exports-polish`).

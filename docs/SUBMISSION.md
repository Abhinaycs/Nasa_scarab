# Space Apps submission text (ready to paste)

Replace `LIVE_URL` and `DEMO_URL` before submitting. All text is in English, as required.

---

## Project Name
**FireCalendar India: a harmonized burning activity calendar**

## High-Level Project Summary
FireCalendar turns 25 years of NASA satellite fire detections into one consistent burning activity calendar for any area in India.

MODIS (2000 onward) and VIIRS (2012 onward) see fires differently: VIIRS has finer pixels and detects about 6 times more fire cell-days. Joining their records naively creates a false jump in 2012. We count fire *cell-days* on an equal-area H3 grid and scale MODIS to VIIRS units with factors fitted region by region, month by month and for day and night passes separately, over 14 years of overlap. The result is a series where the sensor of origin no longer matters.

In the web app, a user draws an area or enters coordinates. They get a month-by-year calendar, anomalies against the historical median ("unusually high" or "unusually low"), the typical fire season, year-to-date comparisons and CSV downloads.

This lets emergency managers, scientists and land managers see at a glance whether this month is unusual, and when to prepare.

## Link to Project Demo
DEMO_URL

## Link to Final Project
- Live app: LIVE_URL
- Code: https://github.com/sravani6130/Nasa_scarab

## Detailed Project Description

**What it does**
- **Choose an area:** draw a polygon or rectangle on the map, enter a latitude/longitude and radius, or pick a preset region (for example Punjab or Odisha). Then choose a date range.
- **Burning calendar:** months across, years (2000 to present) down. Each square shows the harmonized number of fire cell-days, on an accessible colour ramp with the value printed in it. Median and 90th-percentile rows sit underneath.
- **Anomaly calendar:** each month compared with the same month in other years, with labels for unusually high and low months. Recent near-real-time months are marked provisional.
- **Summary:** the peak month, the fire season, the busiest year, and this month against its median.
- **Charts:** a typical-year chart (median with an IQR band), year-to-date cumulative curves, and annual totals with a **raw vs harmonized** toggle that shows the 2012 jump disappearing.
- **Downloads:** CSV of the hotspots in the area (with the harmonization factor applied), CSV of the calendar, and PNG of every chart.

**How it works**
1. **Data:** NASA FIRMS active-fire detections for India. MODIS Terra and Aqua cover 2000–2025, VIIRS S-NPP 2012–2025, VIIRS NOAA-20 2024 onward, and the FIRMS API supplies 2026.
2. **Filtering:** vegetation fires only (`type = 0`); MODIS confidence ≥ 30 and VIIRS nominal or high.
3. **Gridding:** every detection is assigned to an H3 resolution-7 cell (about 5 km²). The unit is the **fire cell-day**, which removes most of the pixel-size difference between the sensors.
4. **Calibration:**
   - Aqua MODIS and S-NPP VIIRS pass over at the same local time (13:30 and 01:30).
   - For every 2° block, calendar month and day/night pass, we fit k = VIIRS ÷ MODIS cell-days over 2012–2025.
   - Blocks with few fires are pulled toward the national factor, and a bootstrap over years gives 90% intervals.
   - Terra (2000–2002) is linked through a Terra/Aqua ratio, and NOAA-20 carries the series past the end of S-NPP.
5. **Validation:**
   - Fitted on 2012–2018 and tested on 2019–2025, the all-India monthly totals are predicted within 16.7% on average, with -1.2% bias. A single constant gives 29.1%.
   - Regional factors cut the bias of a single constant sharply: Northeast +6.7% vs +110.5%, Punjab +15.6% vs +58.5%.
   - The false 2012 jump (×4.6 in the naive splice) is reduced to ×1.08.
6. **Serving:** a FastAPI service queries compact Parquet files with DuckDB and responds in well under a second. The React frontend uses MapLibre and Observable Plot.

**Benefits**
- A single, consistent record from 2000 to today.
- Answers "Is this fire month unusual for *this* place?" for any custom area, not only fixed administrative regions.
- Accessible: colourblind-safe colour ramps, every number printed, and a table view of every chart.
- Open: every step is reproducible from public NASA data with one script (`pipeline/run_all.sh`).
- Ready for the end of MODIS: the series is already in VIIRS units, so it keeps going on NOAA-20 and NOAA-21.

**What we hope to achieve**
We hope to give fire managers in India, and later anywhere in the world, an early-warning view. Unusual months stand out instantly, preparation can be timed to the local fire season, and the record stays consistent as satellites are replaced.

**Tools**
Python, DuckDB with the H3 extension, pandas, NumPy, SciPy and Matplotlib for the pipeline. FastAPI for the API. React, Vite, TypeScript, MapLibre GL, Terra Draw, Observable Plot and Turf for the web app. Render for hosting, GitHub Actions for the keep-warm ping.

## Use of Super Intelligence (SI)
Yes. We used Claude Code (Anthropic) as an AI coding assistant. It helped:
- turn our research plan into a task breakdown;
- generate code for the data pipeline, the API and the web app;
- draft documentation, including this text.

The team chose the challenge approach, reviewed and ran all generated code, tested it, and checked the results against the data. No AI-generated images, video or audio are used. This is also stated in the repository README.

## NASA Data
- **NASA FIRMS (Fire Information for Resource Management System):** https://www.earthdata.nasa.gov/data/tools/firms
  - MODIS Collection 6.1 active fires, Terra and Aqua (MCD14ML), 1 km, Nov 2000 – 2025
  - VIIRS 375 m active fires, Suomi NPP (VNP14IMG), 2012 – 2025
  - VIIRS 375 m active fires, NOAA-20 (VJ114IMG), 2024 – present
  - FIRMS country yearly archives and the FIRMS API (near-real-time data for 2026)

## Space Agency Partner Data and Other References
- **H3 hexagonal grid** (Uber, Apache 2.0); **OpenFreeMap / OpenStreetMap** base map (© OpenStreetMap contributors, ODbL).
- **Libraries:** DuckDB, FastAPI, React, MapLibre GL JS, Terra Draw, Observable Plot, Turf.js (all open source).
- **Scientific references:**
  - Giglio et al. 2016 (MODIS C6 active fire algorithm)
  - Schroeder et al. 2014 (VIIRS 375 m)
  - Csiszar et al. 2012 (Aqua–S-NPP continuity)
  - Li et al. 2018 (VIIRS vs MODIS)
  - Zheng et al. 2026 (MYD14 and VNP14IMG fusion)
  - Giglio et al. 2006 (fire seasonality)
  - Giglio 2007 (diurnal cycle)
  - Andela et al. 2019 (Global Fire Atlas)
  - Wooster et al. 2021 (active fire review)
  - Chen et al. 2023 (GFED5)

  Full citations with DOIs are in `docs/METHODS.md`.
- **Inspiration for the calendar layout:** INPE Queimadas month-by-year hotspot tables. For area-based alerts: Global Forest Watch.

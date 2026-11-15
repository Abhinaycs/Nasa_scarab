# Build plan for tonight

The full research plan is the claude.ai doc "Harmonized Fire Activity Calendar: Research and Build Plan". This file is the version cut down to fit before **23:59 on 15 Nov 2026**.

## Scope
- **Region:** India only, using FIRMS yearly country files.
- **Stack:** Python + DuckDB (H3) pipeline, FastAPI API, React + Vite + TypeScript frontend with MapLibre, Terra Draw and Observable Plot.
- **Hosting:** one Render blueprint (`render.yaml`) holding:
  - the API as a free Python web service. It sleeps after 15 minutes idle; a GitHub Actions ping every 10 minutes keeps it awake during judging.
  - the frontend as a Render static site on a global CDN. It never sleeps.
- **Out of scope tonight:** global coverage, nightly refresh job (stretch goal), footprint-level calibration, user accounts.

## Data (verified 15 Nov 2026)
| Sensor | Years | Source |
|---|---|---|
| MODIS Terra + Aqua (C6.1) | 2000 to 2025 | `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{Y}/modis_{Y}_India.csv` |
| VIIRS S-NPP 375 m | 2012 to 2025 | `.../country/viirs-snpp/{Y}/viirs-snpp_{Y}_India.csv` |
| VIIRS NOAA-20 375 m | 2018 to 2025 | `.../country/viirs-jpss1/{Y}/viirs-jpss1_{Y}_India.csv` |
| 2026, VIIRS NOAA-20 and MODIS | 1 Jan 2026 to today | FIRMS API `/api/country/csv/{MAP_KEY}/{SOURCE}/IND/{1-5}/{date}`, needs MAP_KEY |

No key is needed for the yearly files (about 1.2 GB in total). The columns are `latitude, longitude, brightness, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_t31, frp, daynight, type`.

## Harmonization method (adapted from the research doc)
1. **Filter:** keep `type == 0` (vegetation fire). For MODIS keep confidence ≥ 30. For VIIRS keep `n` and `h` and drop `l`. Keep `daynight`.
2. **Reference sensors** (afternoon overpass, about 13:30, so the numbers are comparable):
   - **Aqua MODIS** for history, Jul 2002 to 2011.
   - **Terra MODIS** only for Nov 2000 to Jun 2002, scaled to Aqua using the Terra/Aqua ratio fitted over 2003 to 2019.
   - **S-NPP VIIRS** as the base unit for 2012 to 2025.
   - **NOAA-20** for 2026, scaled to S-NPP using the ratio fitted over 2018 to 2025.
3. **Grid:** put each detection in an **H3 resolution-7** cell (about 5.2 km²) and also keep its res-5 parent. The unit is the **fire cell-day**: one cell with at least one detection on a given date, counted per sensor and day/night pass.
4. **Fit k on the 2012 to 2025 overlap.** The ratio is k = Σ VIIRS cell-days / Σ Aqua cell-days, computed per (2° block, month, day/night pass). Pull sparse blocks toward the national (month, pass) ratio: `k = (V + α·k_nat·M) / (M + α·M)`, with α = 1 and a minimum of 50 MODIS cell-days. Bootstrap over years to get a 90% interval.
5. **Apply:** harmonized value before 2012 = MODIS cell-days × k. From 2012 the S-NPP value is used directly. Raw counts per sensor are kept beside it for the "raw vs harmonized" toggle.
6. **Validate:** fit on 2012 to 2018 and test on 2019 to 2025 (report MAPE of monthly totals). Run a Pettitt test on annual totals to show there is no step at 2012. Plot raw vs harmonized annual totals; this is the main figure for the demo.

**Fallback** if step 4 runs over time: use a single national k per (month, pass).

## Anomalies
For each calendar month, the baseline is the same month in all other years (or 2003 to 2022 when the user picks that). The app shows the percent of the median, the robust z-score ((x − median)/IQR) and the percentile rank. Above the 90th percentile is labelled "unusually high" and below the 10th "unusually low". No label is shown when the median is under 5 cell-days. Months with NRT data are marked provisional.

## Timeline (local time, 15 Nov)
| Time | Sravani (data + API) | Abhinay (frontend + deploy + demo) |
|---|---|---|
| 18:30–19:00 | `/s1-data-download`: start downloads, get MAP_KEY | `/a1-frontend-setup`: scaffold with mock data from CONTRACT |
| 19:00–20:15 | `/s2-ingest` and `/s3-harmonize` | `/a2-map-aoi`: map, drawing, lat/lon + radius |
| 20:15–21:15 | `/s4-api`: real endpoints, push `data/serve` | `/a3-calendar-charts`: calendar, anomaly view, charts |
| 21:15–22:00 | `/s5-validate-methods`: validation plot + methods text | `/a4-exports-polish`: CSV/PNG, toggle, limitations panel |
| 22:00–22:45 | help with deploy, fix API bugs | `/a5-deploy`: Render blueprint, keep-warm ping |
| 22:45–23:30 | submission text (methods, NASA data, SI use) | `/a6-demo-submission`: 7 slides or a 30 s video |
| **23:30** | **Submit for Judging** (one person, after both have checked the live link in a private window) | |

**Checkpoint at 20:15.** Sravani pushes stub API endpoints returning the contract shapes, even if the data isn't ready yet, so Abhinay can switch from mocks to the real API.

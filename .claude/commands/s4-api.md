---
description: "Sravani #4: FastAPI + DuckDB API implementing docs/CONTRACT.md"
---
You are working on Sravani's track. docs/CONTRACT.md is the spec; follow it exactly, because Abhinay's frontend is built against it. Time budget: 60 minutes. Extra notes: $ARGUMENTS

Do this:
1. **Checkpoint first, within 10 minutes:** if `backend/` doesn't exist yet, create `backend/app/main.py` with every contract route returning fixed, contract-shaped JSON. Commit it with `s4: API stubs` and push, so Abhinay can integrate right away. Tell the user to message Abhinay that the stubs are up.
2. `backend/requirements.txt`: fastapi, uvicorn[standard], duckdb, h3>=4, shapely, numpy, pandas, pyarrow. The app has to run from the repo root with `uvicorn backend.app.main:app` and read `data/serve/` (a path relative to the repo root, overridable with the `DATA_DIR` env var).
3. On startup, open one DuckDB connection with `SET memory_limit='350MB'; SET threads=2;`, because the Render free tier has 512 MB. Create views over the parquet files. Load the calibration into memory.
4. AOI: validate the GeoJSON with shapely. Compute the geodesic area (pyproj, or h3 cell areas); if it is over 400,000 km², return 413. Turn the polygon into cells with `h3.geo_to_cells(geojson, 7)`; if that gives more than 50,000 cells, use resolution 5 and filter on `h3_5`. Register the cell list as a DuckDB table and join on it (don't build a huge IN list).
5. `/api/calendar`: query cell_daily for the AOI and date range, then call `pipeline/harmonize.py` (import it; don't duplicate the logic). Add the climatology (median, q25, q75, p10, p90, min, max, mean per month over the baseline years), the per-cell anomaly (pct_of_median, robust_z = (x−median)/IQR with IQR at least 1, a percentile rank excluding the year itself, the label rules from the contract) and the annual totals.
6. `/api/summary`: computed from the same data. The fire-season rule is in the contract.
7. `/api/timeseries`: weekly harmonized values (apply the monthly k to the daily rows) and the year-to-date cumulative curve.
8. `/api/hotspots.csv`: stream rows from `hotspots/year=*` inside the AOI (filter by h3 cells, then by the exact polygon using lat/lon), with a cap of 200k rows and the `X-Truncated` header. Add `harmonization_k`.
9. Add CORS from `ALLOWED_ORIGINS`, `/api/health` and `/api/meta`. Wrap the calendar in an LRU cache keyed on (geometry hash, start, end, baseline).
10. `backend/tests/test_api.py` (pytest + TestClient): check the shapes against the contract for the Punjab box and for a tiny polygon with no fires, and check that a polygon covering India returns 413. Run the tests, then measure the latency of /api/calendar for the Punjab box (aim for under 1.5 s).
11. Tick the boxes under "/s4-api", commit `s4: API implemented`, and run `git pull --rebase && git push`. Report the local run command, the test results and the latency, then the next step (`/s5-validate-methods`).

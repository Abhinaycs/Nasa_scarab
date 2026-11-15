---
description: "Sravani #3: build fire cell-days, fit MODIS→VIIRS calibration, export data/serve"
---
You are working on Sravani's track. Read docs/PLAN.md (method steps 3 to 5, and the Fallback) and docs/CONTRACT.md (served files). Time budget: 45 minutes. If calibration runs over time, use the fallback (national k per month and pass). Extra notes: $ARGUMENTS

Do this:
1. `pipeline/grid.py`: group the detections by (h3_7, h3_5, date, sensor, pass) into `n_det`, `frp_sum`, `frp_max` and `nrt` (bool_or), and write `data/work/cell_daily.parquet`.
2. `pipeline/calibrate.py`:
   - **aqua_to_snpp**: for each (block_id, month, pass), with block_id taken from the cell centroid (2°), use the years 2012 to 2025. V = Σ S-NPP cell-days, M = Σ Aqua cell-days. Compute the national k_nat per (month, pass). Shrink toward it: `k = (V + α·k_nat·M0) / (M + α·M0)` with M0 = 50 and α = 1. Get a 90% interval by bootstrapping over years (500 resamples), and record n_modis and n_viirs.
   - **terra_to_aqua**: the national ratio per (month, pass) over 2003 to 2019.
   - **n20_to_snpp**: the national ratio per (month, pass) over 2018 to 2025.
   - Write `data/work/calibration.parquet` with the `kind` column from the contract. Print the national table and flag any k outside 0.5 to 15.
3. Write the harmonization logic as a reusable function in `pipeline/harmonize.py`, because the API imports it. Given cell_daily rows for an area, it returns monthly values per the contract:
   - Nov 2000 to Jun 2002: Terra × terra_to_aqua × aqua_to_snpp, with source `modis_terra_scaled`.
   - Jul 2002 to Dec 2011: Aqua × k, with source `modis_aqua_scaled`.
   - 2012 to 2025: S-NPP, with source `viirs_snpp`.
   - 2026: NOAA-20 × n20_to_snpp, with source `viirs_noaa20_scaled` and `provisional` set when any row is NRT.
   Apply k per block, month and pass, then sum. Return the raw per-sensor monthly counts as well.
4. `pipeline/export_serve.py` writes the files listed in the contract to `data/serve/`, using ZSTD and sorted by h3_5, date:
   - `cell_daily.parquet` (if it is over 50 MB, split it by year into `cell_daily/year=YYYY/`)
   - `calibration.parquet`
   - `hotspots/year=YYYY/part.parquet`, holding only the reference sensors (Terra before Jul 2002, Aqua up to 2011, S-NPP 2012 to 2025, NOAA-20 2026), with the columns from the contract
   - `meta.json`
   Check that every file is under 50 MB.
5. `pipeline/run_all.sh` runs download → ingest → grid → calibrate → export.
6. Quick check: print the harmonized vs raw annual totals for all of India and for a Punjab box (lon 73.8–77, lat 29.5–32.5). The harmonized series should have no obvious jump at 2012.
7. Tick the boxes under "/s3-harmonize", then commit the code **and data/serve** with `s3: harmonized cell-days + calibration`, and run `git pull --rebase && git push`. Report the national k table and the step check, then the next step (`/s4-api`).

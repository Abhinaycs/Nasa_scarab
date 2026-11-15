---
description: "Sravani #2: normalize, filter and H3-index all FIRMS CSVs into Parquet"
---
You are working on Sravani's track. Read docs/PLAN.md (method steps 1 to 3) and docs/CONTRACT.md. Time budget: 30 minutes. Extra notes: $ARGUMENTS

Do this:
1. Write `pipeline/ingest.py` using DuckDB with `INSTALL h3 FROM community; LOAD h3;`. If the extension won't install, fall back to h3-py vectorized over Polars.
2. Read every CSV in `data/raw/**` (`read_csv_auto`, union_by_name) and map it to this schema:
   `sensor` (`modis_terra` when satellite is 'Terra'/'T', `modis_aqua` when 'Aqua'/'A', `viirs_snpp` when 'N'/'Suomi NPP', `viirs_noaa20` when 'N20'/'1'/'NOAA-20'; print the distinct `satellite` values to confirm), `lat`, `lon`, `date`, `time` (HHMM, zero-padded), `confidence` (MODIS number → low <30, nominal 30–79, high ≥80; VIIRS l/n/h → low/nominal/high), `frp`, `pass` (D/N), `type`, `nrt` (bool).
3. Filter: `type = 0` (the API NRT files may not have `type`; keep those rows but flag them), MODIS confidence ≥ 30, VIIRS confidence in (n, h).
4. Add `h3_7 = h3_latlng_to_cell(lat, lon, 7)` and `h3_5 = h3_cell_to_parent(h3_7, 5)` as UBIGINT.
5. Deduplicate on (sensor, date, time, lat, lon). When both exist for a date, the SP row wins over the NRT row.
6. Write to `data/work/detections/` as Parquet partitioned by sensor and year.
7. Print the row counts per sensor/year before and after filtering. Sanity check: VIIRS should have roughly 3 to 10 times the rows of MODIS in the same year.
8. Tick the boxes under "/s2-ingest" in tasks/sravani.md, commit `s2: ingest + filter + H3`, and run `git pull --rebase && git push`. Report the counts, then the next step (`/s3-harmonize`).

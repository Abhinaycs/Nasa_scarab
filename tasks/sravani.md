# Sravani: data pipeline + harmonization + API

Run the commands in order in Claude Code from the repo root. Each one ticks its own boxes and pushes.
Interfaces: [docs/CONTRACT.md](../docs/CONTRACT.md). Method: [docs/PLAN.md](../docs/PLAN.md).

## /s1-data-download (18:30–19:00)
- [ ] Get a FIRMS MAP_KEY (firms.modaps.eosdis.nasa.gov/api) and put it in `.env` as `FIRMS_MAP_KEY=...`
- [x] Create `.venv` and `pipeline/requirements.txt`
- [x] `pipeline/download.py`: yearly India CSVs (MODIS 2000–2025, S-NPP 2012–2025, NOAA-20 2018–2025), resumable and parallel
- [x] `pipeline/download_api.py`: 2026 to date via the FIRMS country API (NOAA-20 + MODIS)
- [ ] All files present in `data/raw/`; row counts logged

## /s2-ingest (19:00–19:30)
- [x] `pipeline/ingest.py`: every CSV goes into one normalized schema in `data/work/detections/sensor=*/year=*/`
- [x] Filter: type 0, MODIS confidence ≥ 30, VIIRS n/h
- [x] H3 r7 + r5 columns added (DuckDB h3 extension)

## /s3-harmonize (19:30–20:15)
- [x] `pipeline/grid.py`: `cell_daily.parquet` (fire cell-days)
- [x] `pipeline/calibrate.py`: k per 2° block × month × pass, with shrinkage + bootstrap, saved to `calibration.parquet`
- [x] Terra→Aqua and NOAA-20→S-NPP factors
- [x] `pipeline/export_serve.py`: `data/serve/` (cell_daily, calibration, hotspots per year, meta.json), every file < 50 MB
- [x] `pipeline/run_all.sh` runs everything end to end
- [ ] Re-run `SKIP_DOWNLOAD=1 bash pipeline/run_all.sh` and push data/serve once S-NPP/NOAA-20 files finish downloading (interim data/serve is MODIS-only)

## /s4-api (20:15–21:15)
- [ ] **Checkpoint first:** stub endpoints returning contract-shaped data, pushed by 20:15
- [ ] `backend/app/main.py` FastAPI app with CORS, `/api/health`, `/api/meta`
- [ ] AOI → H3 cells (h3-py), r5 fallback, 413 when too large
- [ ] `/api/calendar` with climatology + anomalies
- [ ] `/api/summary`, `/api/timeseries`, `/api/hotspots.csv`
- [ ] `backend/tests/test_api.py` passes; `backend/requirements.txt`

## /s5-validate-methods (21:15–22:00)
- [ ] `pipeline/validate.py`: hold-out MAPE, Pettitt test, raw vs harmonized annual plot → `docs/figures/`
- [ ] `docs/METHODS.md`: method, validation numbers, limitations, references
- [ ] Submission text drafted in `docs/SUBMISSION.md` (summary, NASA data, SI use)

## Stretch
- [ ] `.github/workflows/refresh.yml`: nightly NRT pull (MAP_KEY as a repo secret)

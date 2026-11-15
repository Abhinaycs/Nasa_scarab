---
description: "Sravani #1: set up the Python env and download FIRMS India data (2000 to today)"
---
You are working on Sravani's track. Read CLAUDE.md, docs/PLAN.md (Data section) and docs/CONTRACT.md first. Time budget: 30 minutes. Extra notes from the user: $ARGUMENTS

Do this:
1. Create `.venv` (python3 -m venv .venv) and `pipeline/requirements.txt` with: duckdb>=1.1, polars, pyarrow, h3>=4, numpy, scipy, pandas, matplotlib, requests, python-dotenv, tqdm. Install it.
2. Check `.env` for `FIRMS_MAP_KEY`. If it's missing, tell the user to get a key at https://firms.modaps.eosdis.nasa.gov/api/map_key/ and add `FIRMS_MAP_KEY=...` to `.env`. Keep going with step 3 in the meantime, because the yearly files need no key. Make sure `.env` is in `.gitignore`.
3. Write `pipeline/download.py`. It downloads the yearly India country CSVs into `data/raw/{sensor}/{year}.csv`:
   - `modis` for 2000 to 2025: `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{Y}/modis_{Y}_India.csv`
   - `viirs-snpp` for 2012 to 2025: `.../data/country/viirs-snpp/{Y}/viirs-snpp_{Y}_India.csv`
   - `viirs-jpss1` (NOAA-20) for 2018 to 2025: `.../data/country/viirs-jpss1/{Y}/viirs-jpss1_{Y}_India.csv`
   The script should run about 6 downloads in parallel (ThreadPoolExecutor), skip files whose size matches Content-Length, retry 3 times, and use a generic User-Agent (no personal data). Start it with `run_in_background`, since it is about 1.2 GB.
4. Write `pipeline/download_api.py`. For 2026-01-01 to today it calls `https://firms.modaps.eosdis.nasa.gov/api/country/csv/{KEY}/{SOURCE}/IND/5/{date}` in 5-day steps for SOURCE in `VIIRS_NOAA20_SP`, `VIIRS_NOAA20_NRT`, `MODIS_SP`, `MODIS_NRT`. Check `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{KEY}/all` first, and only request the dates each source covers. Write to `data/raw/api/{source}/{date}.csv`, and add an `nrt` flag to NRT rows. Stay well under 5,000 transactions per 10 minutes. Do not use VIIRS_SNPP_NRT.
5. Once the downloads finish, print a table of file count and row count per sensor/year, and flag any empty or missing years.
6. Tick the finished boxes under "/s1-data-download" in tasks/sravani.md. Commit the code (not the data) with message `s1: FIRMS India download scripts` and run `git pull --rebase && git push`.
7. Report what is downloaded, anything missing, and the next step (`/s2-ingest`).

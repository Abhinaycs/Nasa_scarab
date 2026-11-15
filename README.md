# Nasa_scarab: Harmonized Fire Activity Calendar

NASA Space Apps Challenge 2026. A web app that combines MODIS (2000 onward) and VIIRS (2012 onward) active-fire hotspots from NASA FIRMS into one consistent series. It shows a month-by-year **burning calendar**, anomalies against the historical median, and CSV downloads for any area drawn over India.

**Live demo:** _coming tonight_ · **Team:** Sravani (data + API), Abhinay (frontend + deploy + demo)

## How the team works
Each person opens this repo in VS Code, runs `claude`, and works through their slash commands in order:

| Sravani | Abhinay |
|---|---|
| `/s1-data-download` | `/a1-frontend-setup` |
| `/s2-ingest` | `/a2-map-aoi` |
| `/s3-harmonize` | `/a3-calendar-charts` |
| `/s4-api` (pushes stubs first) | `/a4-exports-polish` |
| `/s5-validate-methods` | `/a5-deploy` |
| | `/a6-demo-submission` |

Both people use `/sync` to pull, check and push, and `/status` to see progress against the timeline.

- Plan and timeline: [docs/PLAN.md](docs/PLAN.md)
- Interface between the tracks: [docs/CONTRACT.md](docs/CONTRACT.md)
- Checklists: [tasks/sravani.md](tasks/sravani.md), [tasks/abhinay.md](tasks/abhinay.md)

## Run locally
```bash
# data + API
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt -r backend/requirements.txt
bash pipeline/run_all.sh                       # only needed to rebuild data/serve
.venv/bin/uvicorn backend.app.main:app --port 8000
# frontend
cd frontend && npm install && npm run dev
```

## Data
NASA FIRMS active fire products: MODIS Collection 6.1 (Terra/Aqua), VIIRS 375 m (Suomi NPP, NOAA-20). Source: https://www.earthdata.nasa.gov/data/tools/firms

## Use of AI
Claude Code (Anthropic) assisted with planning, code generation and documentation. The team reviewed, ran and tested all output.

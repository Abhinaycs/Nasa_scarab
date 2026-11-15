# Nasa_scarab: Harmonized Fire Activity Calendar (NASA Space Apps 2026)

A web app that shows a harmonized month-by-year burning calendar (MODIS + VIIRS, 2000 to present) for any area drawn over **India**, with anomalies against the historical median and CSV downloads.

**Deadline: submission closes Sunday 15 Nov 2026, 23:59 local time. Everything is scoped to fit that.**

## Read these first
- [docs/PLAN.md](docs/PLAN.md): the method, the timeline and who does what.
- [docs/CONTRACT.md](docs/CONTRACT.md): file formats and API JSON shapes. **This is the interface between the two people.** Do not change it without updating the file and telling the other person.
- Task lists: [tasks/sravani.md](tasks/sravani.md) (data + API), [tasks/abhinay.md](tasks/abhinay.md) (frontend + deploy + demo).

## Layout
```
pipeline/        Python: download, ingest, harmonize        (Sravani)
backend/         FastAPI + DuckDB API                       (Sravani)
data/raw/        downloaded FIRMS CSVs, git-ignored
data/work/       intermediate parquet, git-ignored
data/serve/      small parquet files the API serves, COMMITTED
frontend/        React + Vite + TS, MapLibre, Observable Plot (Abhinay)
render.yaml      Render blueprint: API web service + static site (Abhinay)
docs/            plan, contract, methods, demo
tasks/           per-person checklists, updated by the slash commands
.claude/commands slash commands: /s1..., /a1..., /sync, /status
```

## Rules for every session
- Stay inside your own folders (see Layout). Shared files: docs/CONTRACT.md, CLAUDE.md, README.md.
- Commit small and often, directly to `main`: `git pull --rebase` and then `git push` (use `/sync`).
- After finishing a task, tick its checkbox in your `tasks/*.md` file and push, so the other person's `/status` sees it.
- Never commit `.env`, the MAP_KEY or `data/raw/`. Keep every file in `data/serve/` under 50 MB.
- Python 3.11+, run with `.venv/bin/python`. Node 20+.
- Favour working end to end over polish. If a step takes more than 30 minutes over its budget, take the fallback listed in PLAN.md.
- Space Apps rules: no NASA logos or branding in anything we make. Credit AI assistance (Claude Code) in the README and in the submission ("Use of SI").

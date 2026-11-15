#!/usr/bin/env bash
# Rebuild data/serve end to end. Safe to re-run: downloads and ingest skip finished files.
#   bash pipeline/run_all.sh            # yearly files + 2026 API (if FIRMS_MAP_KEY is set)
#   SKIP_DOWNLOAD=1 bash pipeline/run_all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python

if [[ -z "${SKIP_DOWNLOAD:-}" ]]; then
  $PY pipeline/download.py || echo "some yearly downloads failed; continuing with what is on disk"
  if grep -qs '^FIRMS_MAP_KEY=.\+' .env || [[ -n "${FIRMS_MAP_KEY:-}" ]]; then
    $PY pipeline/download_api.py || echo "API download failed; continuing"
  else
    echo "no FIRMS_MAP_KEY: skipping 2026 API download"
  fi
fi
$PY pipeline/check_raw.py
$PY pipeline/ingest.py
$PY pipeline/grid.py
$PY pipeline/calibrate.py
$PY pipeline/export_serve.py
$PY pipeline/check_harmonized.py

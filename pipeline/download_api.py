"""Download 2026-to-date FIRMS detections for India via the FIRMS country API.

Needs FIRMS_MAP_KEY in .env (free: https://firms.modaps.eosdis.nasa.gov/api/map_key/).
Output: data/raw/api/{source}/{date}.csv  (NRT files get an extra `nrt` column = True)
Usage:  .venv/bin/python pipeline/download_api.py [--start 2026-01-01] [--end today]
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "api"
API = "https://firms.modaps.eosdis.nasa.gov/api"
HEADERS = {"User-Agent": "fire-calendar-pipeline/0.1 (python-requests)"}
SOURCES = ["VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT", "MODIS_SP", "MODIS_NRT"]  # never VIIRS_SNPP_NRT
DAY_RANGE = 5
PAUSE_S = 0.5  # ~120 req/min max, far below 5000 transactions / 10 min


def load_key() -> str:
    key = os.environ.get("FIRMS_MAP_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith("FIRMS_MAP_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("FIRMS_MAP_KEY missing: add FIRMS_MAP_KEY=... to .env "
                 "(get one at https://firms.modaps.eosdis.nasa.gov/api/map_key/)")
    return key


def get(url: str, retries: int = 3) -> str:
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=120)
            r.raise_for_status()
            text = r.text
            if text.lstrip().lower().startswith(("invalid", "error")):
                raise RuntimeError(text.strip()[:200])
            return text
        except Exception as e:  # noqa: BLE001
            if attempt == retries:
                raise
            print(f"  retry {attempt}: {e}", flush=True)
            time.sleep(5 * attempt)
    return ""


def availability(key: str) -> dict[str, tuple[date, date]]:
    text = get(f"{API}/data_availability/csv/{key}/all")
    out = {}
    for row in csv.DictReader(io.StringIO(text)):
        try:
            out[row["data_id"]] = (date.fromisoformat(row["min_date"]), date.fromisoformat(row["max_date"]))
        except (KeyError, ValueError):
            continue
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-01-01")
    ap.add_argument("--end", default=date.today().isoformat())
    args = ap.parse_args()
    key = load_key()
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)

    avail = availability(key)
    print("availability:", {k: (str(a), str(b)) for k, (a, b) in avail.items() if k in SOURCES}, flush=True)

    n_req = 0
    for src in SOURCES:
        if src not in avail:
            print(f"{src}: not listed in data_availability, skipping", flush=True)
            continue
        lo, hi = max(start, avail[src][0]), min(end, avail[src][1])
        if lo > hi:
            print(f"{src}: no coverage in {start}..{end}", flush=True)
            continue
        is_nrt = src.endswith("_NRT")
        rows_total = 0
        d = lo
        while d <= hi:
            dest = OUT / src / f"{d.isoformat()}.csv"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and dest.stat().st_size > 0:
                d += timedelta(days=DAY_RANGE)
                continue
            # API returns [d, d+DAY_RANGE-1]; clamp so we don't run past hi
            span = min(DAY_RANGE, (hi - d).days + 1)
            text = get(f"{API}/country/csv/{key}/{src}/IND/{span}/{d.isoformat()}")
            n_req += 1
            lines = text.strip().splitlines()
            if is_nrt and lines:
                lines = [lines[0] + ",nrt"] + [ln + ",True" for ln in lines[1:]]
            dest.write_text("\n".join(lines) + "\n")
            rows_total += max(0, len(lines) - 1)
            d += timedelta(days=span)
            time.sleep(PAUSE_S)
        print(f"{src}: {lo}..{hi} rows={rows_total}", flush=True)
    print(f"done, {n_req} API requests", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

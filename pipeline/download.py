"""Download FIRMS yearly India country CSVs (no MAP_KEY needed).

Output: data/raw/{sensor}/{year}.csv
Usage:  .venv/bin/python pipeline/download.py [--workers 6]
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
HEADERS = {"User-Agent": "fire-calendar-pipeline/0.1 (python-requests)"}

# (sensor folder, years), in priority order. NOAA-20 2024-2025 is enough to fit the
# NOAA-20 -> S-NPP ratio; the older NOAA-20 years are optional (--full) on slow links.
CORE = [
    ("modis", range(2000, 2026)),
    ("viirs-jpss1", range(2024, 2026)),
    ("viirs-snpp", range(2025, 2011, -1)),
]
OPTIONAL = [("viirs-jpss1", range(2023, 2017, -1))]
SOURCES = CORE


def jobs():
    for sensor, years in SOURCES:
        for y in years:
            url = f"{BASE}/{sensor}/{y}/{sensor}_{y}_India.csv"
            yield sensor, y, url, RAW / sensor / f"{y}.csv"


def fetch(sensor: str, year: int, url: str, dest: Path, retries: int = 3) -> tuple[str, int, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, retries + 1):
        try:
            head = requests.head(url, headers=HEADERS, timeout=60, allow_redirects=True)
            if head.status_code == 404:
                return sensor, year, "missing (404)"
            size = int(head.headers.get("Content-Length", -1))
            if dest.exists() and size > 0 and dest.stat().st_size == size:
                return sensor, year, f"skip ({size/1e6:.1f} MB)"
            tmp = dest.with_suffix(".part")
            with requests.get(url, headers=HEADERS, timeout=300, stream=True) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            if size > 0 and tmp.stat().st_size != size:
                raise IOError(f"size mismatch {tmp.stat().st_size} != {size}")
            tmp.replace(dest)
            return sensor, year, f"ok ({dest.stat().st_size/1e6:.1f} MB)"
        except Exception as e:  # noqa: BLE001
            if attempt == retries:
                return sensor, year, f"FAILED: {e}"
            time.sleep(5 * attempt)
    return sensor, year, "FAILED"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--full", action="store_true", help="also fetch NOAA-20 2018-2023")
    args = ap.parse_args()
    global SOURCES
    SOURCES = CORE + OPTIONAL if args.full else CORE
    failed = 0
    with ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(fetch, *j) for j in jobs()]
        for fut in as_completed(futs):
            sensor, year, status = fut.result()
            print(f"{sensor:12s} {year}  {status}", flush=True)
            failed += status.startswith("FAILED")
    print(f"done, {failed} failed", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

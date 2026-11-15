"""Summarize data/raw: files and rows per sensor/year; flag empty or missing years."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
EXPECTED = {
    "modis": range(2000, 2026),
    "viirs-snpp": range(2012, 2026),
    "viirs-jpss1": range(2018, 2026),
}


def rows(p: Path) -> int:
    with open(p, "rb") as f:
        return max(0, sum(1 for _ in f) - 1)


def main() -> None:
    problems = []
    print(f"{'sensor':12s} {'year':>4s} {'rows':>10s}  {'MB':>7s}")
    for sensor, years in EXPECTED.items():
        for y in years:
            p = RAW / sensor / f"{y}.csv"
            if not p.exists():
                problems.append(f"{sensor} {y}: MISSING")
                continue
            n = rows(p)
            print(f"{sensor:12s} {y:>4d} {n:>10,d}  {p.stat().st_size/1e6:7.1f}")
            if n == 0:
                problems.append(f"{sensor} {y}: EMPTY")
    api = RAW / "api"
    if api.exists():
        agg = defaultdict(lambda: [0, 0])
        for p in api.glob("*/*.csv"):
            agg[p.parent.name][0] += 1
            agg[p.parent.name][1] += rows(p)
        for src, (files, n) in sorted(agg.items()):
            print(f"api {src:20s} files={files:4d} rows={n:,d}")
    else:
        problems.append("api: no 2026 data yet (needs FIRMS_MAP_KEY, run pipeline/download_api.py)")
    print("\nProblems:" if problems else "\nNo problems.")
    for pr in problems:
        print("  -", pr)


if __name__ == "__main__":
    main()

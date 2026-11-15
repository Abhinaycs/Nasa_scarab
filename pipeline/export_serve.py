"""Write the small, committed files the API serves (docs/CONTRACT.md) into data/serve/.

  cell_daily/year=YYYY/part.parquet   fire cell-days (+ block_id), sorted by h3_5, date
  calibration.parquet                 scaling factors
  hotspots/year=YYYY/part.parquet     filtered detections of the month's reference sensor
  coverage.json                       months each sensor observed
  meta.json                           coverage, build time, method version, national factors
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.harmonize import Calibration  # noqa: E402

WORK = ROOT / "data" / "work"
SERVE = ROOT / "data" / "serve"
MAX_MB = 50
METHOD_VERSION = "1.0"


def main() -> None:
    SERVE.mkdir(parents=True, exist_ok=True)
    for sub in ("cell_daily", "hotspots"):
        shutil.rmtree(SERVE / sub, ignore_errors=True)
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'")
    con.execute(f"SET temp_directory='{WORK / 'tmp'}'")

    shutil.copy(WORK / "calibration.parquet", SERVE / "calibration.parquet")
    shutil.copy(WORK / "coverage.json", SERVE / "coverage.json")
    calib = Calibration.load(SERVE)

    # cell_daily, one file per year
    years = [r[0] for r in con.execute(
        f"SELECT DISTINCT year(date) FROM '{WORK / 'cell_daily.parquet'}' ORDER BY 1").fetchall()]
    for y in years:
        d = SERVE / "cell_daily" / f"year={y}"
        d.mkdir(parents=True)
        con.execute(f"""COPY (SELECT h3_7, h3_5, date, sensor, pass, n_det, frp_sum, frp_max, nrt, block_id
                    FROM '{WORK / 'cell_daily.parquet'}' WHERE year(date) = {y} ORDER BY h3_5, date)
                    TO '{d / 'part.parquet'}' (FORMAT parquet, COMPRESSION zstd)""")

    # hotspots: only the reference sensor of each month
    src = pd.DataFrame(sorted(calib.month_source.items()), columns=["ym", "sensor"])
    con.register("month_source", src)
    det = f"read_parquet('{WORK}/detections/sensor=*/year=*/*.parquet', hive_partitioning=true)"
    for y in years:
        d = SERVE / "hotspots" / f"year={y}"
        d.mkdir(parents=True)
        con.execute(f"""COPY (
            SELECT d.lat, d.lon, d.date, d.time, d.sensor, d.confidence, d.frp, d.pass, d.h3_7
            FROM {det} d JOIN month_source m
              ON strftime(d.date, '%Y-%m') = m.ym AND d.sensor = m.sensor
            WHERE d.year = {y}
            ORDER BY d.h3_7, d.date
          ) TO '{d / 'part.parquet'}' (FORMAT parquet, COMPRESSION zstd)""")

    nat = calib.cal[calib.cal.block_id == "nat"].round(4).to_dict(orient="records")
    meta = dict(
        built_utc=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        method_version=METHOD_VERSION,
        region="India",
        unit="fire cell-days (S-NPP VIIRS equivalent), H3 resolution 7",
        coverage={s: [m[0], m[-1], len(m)] for s, m in
                  ((s, sorted(v)) for s, v in calib.coverage.items()) if m},
        month_source=calib.month_source,
        national_factors=nat,
        products={
            "modis": "MODIS Collection 6.x active fires (MCD14ML), Terra + Aqua, via NASA FIRMS",
            "viirs_snpp": "VIIRS 375 m active fires (VNP14IMG), Suomi NPP, via NASA FIRMS",
            "viirs_noaa20": "VIIRS 375 m active fires (VJ114IMG), NOAA-20, via NASA FIRMS",
        },
    )
    (SERVE / "meta.json").write_text(json.dumps(meta, indent=1, default=str))

    total, too_big = 0.0, []
    for p in sorted(SERVE.rglob("*")):
        if p.is_file():
            mb = p.stat().st_size / 1e6
            total += mb
            if mb > MAX_MB:
                too_big.append(f"{p.relative_to(ROOT)} {mb:.1f} MB")
    print(f"data/serve total {total:.1f} MB")
    if too_big:
        sys.exit("FILES OVER 50 MB:\n  " + "\n  ".join(too_big))


if __name__ == "__main__":
    main()

"""Fire cell-days: one row per H3 r7 cell x date x sensor x pass.

Input : data/work/detections/sensor=*/year=*/*.parquet  (from ingest.py)
Output: data/work/cell_daily.parquet
        data/work/coverage.json  months each sensor actually observed (any detection in India)
Usage : .venv/bin/python pipeline/grid.py
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DET = ROOT / "data" / "work" / "detections"
OUT = ROOT / "data" / "work" / "cell_daily.parquet"
COVERAGE = ROOT / "data" / "work" / "coverage.json"


def connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'")
    con.execute("SET threads=4")
    con.execute(f"SET temp_directory='{ROOT / 'data' / 'work' / 'tmp'}'")
    con.execute("SET preserve_insertion_order=false")
    try:
        con.execute("LOAD h3")
    except duckdb.Error:
        con.execute("INSTALL h3 FROM community")
        con.execute("LOAD h3")
    return con


# 2-degree calibration block from the r5 parent's centroid (cheap, and stable per r5 cell)
BLOCK_SQL = """
  CAST(floor(h3_cell_to_lat(h3_5) / 2) * 2 AS INT)::VARCHAR || '_' ||
  CAST(floor(h3_cell_to_lng(h3_5) / 2) * 2 AS INT)::VARCHAR
"""


def main() -> None:
    con = connect()
    src = f"read_parquet('{DET}/sensor=*/year=*/*.parquet', hive_partitioning=true)"
    con.execute(f"""
    COPY (
      SELECT h3_7, h3_5, date, sensor, pass,
             count(*)::INT AS n_det,
             sum(frp) AS frp_sum,
             max(frp) AS frp_max,
             bool_or(nrt) AS nrt,
             {BLOCK_SQL} AS block_id
      FROM {src}
      GROUP BY h3_7, h3_5, date, sensor, pass
      ORDER BY h3_5, date
    ) TO '{OUT}' (FORMAT parquet, COMPRESSION zstd)
    """)
    stats = con.execute(f"""
      SELECT sensor, year(date) y, count(*) cell_days, sum(n_det) dets
      FROM '{OUT}' GROUP BY ALL ORDER BY 1, 2""").fetchall()
    print(f"{'sensor':14s} {'year':>4s} {'cell-days':>10s} {'detections':>11s} {'det/cell-day':>12s}")
    for s, y, cd, d in stats:
        print(f"{s:14s} {y:>4d} {cd:>10,d} {d:>11,d} {d / cd:12.2f}")

    cov = con.execute(f"""
      SELECT sensor, list(DISTINCT strftime(date, '%Y-%m') ORDER BY strftime(date, '%Y-%m'))
      FROM '{OUT}' GROUP BY sensor""").fetchall()
    COVERAGE.write_text(json.dumps({s: months for s, months in cov}, indent=1))
    print(f"\nwrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB) and {COVERAGE.name}")


if __name__ == "__main__":
    main()

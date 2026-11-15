"""Normalize, filter and H3-index FIRMS CSVs into Parquet.

Input : data/raw/{modis,viirs-snpp,viirs-jpss1}/{year}.csv  (yearly SP country files)
        data/raw/api/{SOURCE}/{date}.csv                    (2026 SP + NRT from the API)
Output: data/work/detections/sensor={sensor}/year={year}/{part}.parquet
        data/work/ingest_counts.csv  (rows before/after filtering per sensor/year)

Low-memory by design: each yearly file is processed on its own (yearly files never
overlap each other); the API files are processed together so SP can replace NRT.
Re-running only rebuilds files whose source CSV is newer than the output.
Usage: .venv/bin/python pipeline/ingest.py [--force]
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "work" / "detections"
COUNTS = ROOT / "data" / "work" / "ingest_counts.csv"

SENSOR_SQL = """
CASE
  WHEN upper(satellite) IN ('TERRA', 'T') THEN 'modis_terra'
  WHEN upper(satellite) IN ('AQUA', 'A') THEN 'modis_aqua'
  WHEN upper(satellite) IN ('N', 'SUOMI NPP', 'NPP', 'SNPP') THEN 'viirs_snpp'
  WHEN upper(satellite) IN ('N20', '1', 'NOAA-20', 'NOAA20', 'J1') THEN 'viirs_noaa20'
  WHEN upper(satellite) IN ('N21', '2', 'NOAA-21', 'NOAA21', 'J2') THEN 'viirs_noaa21'
  ELSE 'unknown:' || satellite
END
"""

# Normalized confidence. MODIS is 0-100; VIIRS is l/n/h (or low/nominal/high in some API files).
CONF_SQL = """
CASE
  WHEN instrument = 'MODIS' THEN
    CASE WHEN TRY_CAST(confidence AS INT) >= 80 THEN 'high'
         WHEN TRY_CAST(confidence AS INT) >= 30 THEN 'nominal'
         ELSE 'low' END
  ELSE
    CASE lower(left(confidence, 1)) WHEN 'h' THEN 'high' WHEN 'n' THEN 'nominal' ELSE 'low' END
END
"""


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


def normalized_sql(files: list[Path], has_nrt_col: bool) -> str:
    flist = ", ".join(f"'{f}'" for f in files)
    nrt = "coalesce(TRY_CAST(nrt AS BOOLEAN), false)" if has_nrt_col else "false"
    return f"""
    SELECT
      {SENSOR_SQL} AS sensor,
      instrument,
      TRY_CAST(latitude AS DOUBLE) AS lat,
      TRY_CAST(longitude AS DOUBLE) AS lon,
      TRY_CAST(acq_date AS DATE) AS date,
      lpad(CAST(TRY_CAST(acq_time AS INT) AS VARCHAR), 4, '0') AS time,
      {CONF_SQL} AS confidence,
      confidence AS confidence_raw,
      TRY_CAST(frp AS DOUBLE) AS frp,
      upper(daynight) AS pass,
      TRY_CAST(type AS INT) AS type,
      {nrt} AS nrt,
      version
    FROM read_csv([{flist}], union_by_name=true, all_varchar=true, header=true)
    """


FILTER_SQL = """
  lat IS NOT NULL AND lon IS NOT NULL AND date IS NOT NULL
  AND (type = 0 OR type IS NULL)      -- vegetation fires; NULL = API file without `type`, kept + flagged
  AND confidence IN ('nominal', 'high')  -- MODIS >= 30, VIIRS n/h
"""


def process(con, files: list[Path], has_nrt_col: bool, part: str) -> list[tuple]:
    """Normalize + filter + H3 + dedupe `files`, write partitioned parquet, return counts."""
    con.execute(f"CREATE OR REPLACE TEMP TABLE norm AS {normalized_sql(files, has_nrt_col)}")
    before = con.execute(
        "SELECT sensor, year(date) y, count(*) FROM norm GROUP BY ALL").fetchall()
    con.execute(f"""
    CREATE OR REPLACE TEMP TABLE clean AS
    WITH f AS (
      SELECT *, (type IS NULL) AS type_missing FROM norm WHERE {FILTER_SQL}
    ),
    -- SP beats NRT: drop NRT rows on any sensor-date that has SP rows
    sp_days AS (SELECT DISTINCT sensor, date FROM f WHERE NOT nrt),
    g AS (
      SELECT f.* FROM f
      WHERE NOT f.nrt OR NOT EXISTS (
        SELECT 1 FROM sp_days s WHERE s.sensor = f.sensor AND s.date = f.date)
    )
    SELECT
      sensor, lat, lon, date, time, confidence, frp, pass, nrt, type_missing, version,
      CAST(h3_latlng_to_cell(lat, lon, 7) AS UBIGINT) AS h3_7,
      CAST(h3_cell_to_parent(h3_latlng_to_cell(lat, lon, 7), 5) AS UBIGINT) AS h3_5,
      year(date) AS year
    FROM g
    QUALIFY row_number() OVER (
      PARTITION BY sensor, date, time, round(lat, 4), round(lon, 4) ORDER BY nrt) = 1
    """)
    after = dict(((s, y), n) for s, y, n in con.execute(
        "SELECT sensor, year, count(*) FROM clean GROUP BY ALL").fetchall())
    for sensor, year in con.execute("SELECT DISTINCT sensor, year FROM clean").fetchall():
        d = OUT / f"sensor={sensor}" / f"year={year}"
        d.mkdir(parents=True, exist_ok=True)
        con.execute(f"""
          COPY (SELECT * EXCLUDE (sensor, year) FROM clean
                WHERE sensor = '{sensor}' AND year = {year} ORDER BY h3_5, date)
          TO '{d / (part + '.parquet')}' (FORMAT parquet, COMPRESSION zstd)
        """)
    return [(s, y, b, after.get((s, y), 0)) for s, y, b in before]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="rebuild everything")
    args = ap.parse_args()
    if args.force and OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)
    con = connect()

    # what each existing output part came from, so re-runs only redo changed inputs
    stamp_dir = ROOT / "data" / "work" / "ingest_stamps"
    stamp_dir.mkdir(parents=True, exist_ok=True)

    yearly = sorted(p for p in RAW.glob("*/*.csv") if p.parent.name != "api")
    api = sorted(RAW.glob("api/*/*.csv"))
    print("satellite values:", con.execute(
        "SELECT satellite, count(*) FROM read_csv([" + ", ".join(f"'{f}'" for f in yearly + api)
        + "], union_by_name=true, all_varchar=true) GROUP BY ALL ORDER BY 1").fetchall()
        if yearly or api else "no input files", flush=True)

    counts: list[tuple] = []
    prev = {}
    if COUNTS.exists():
        for line in COUNTS.read_text().splitlines()[1:]:
            s, y, b, a, part = line.split(",")
            prev.setdefault(part, []).append((s, int(y), int(b), int(a)))

    for f in yearly:
        part = f"{f.parent.name}_{f.stem}"
        stamp = stamp_dir / part
        if stamp.exists() and stamp.stat().st_mtime >= f.stat().st_mtime and part in prev:
            counts += [(*c, part) for c in prev[part]]
            continue
        for old in OUT.glob(f"sensor=*/year=*/{part}.parquet"):
            old.unlink()
        rows = process(con, [f], has_nrt_col=False, part=part)
        counts += [(*r, part) for r in rows]
        stamp.touch()
        print(f"{part:22s} " + "  ".join(f"{s} {y}: {b:,}->{a:,}" for s, y, b, a in rows), flush=True)

    if api:
        for old in OUT.glob("sensor=*/year=*/api.parquet"):
            old.unlink()
        has_nrt = any("nrt" in p.read_text().splitlines()[0].split(",") for p in api[:50]
                      if p.stat().st_size > 0)
        rows = process(con, [p for p in api if p.stat().st_size > 0], has_nrt_col=has_nrt, part="api")
        counts += [(*r, "api") for r in rows]
        print("api                    " + "  ".join(f"{s} {y}: {b:,}->{a:,}" for s, y, b, a in rows))

    COUNTS.write_text("sensor,year,before,after,part\n" + "\n".join(
        f"{s},{y},{b},{a},{p}" for s, y, b, a, p in counts) + "\n")
    report(counts)


def report(counts: list[tuple]) -> None:
    agg: dict[tuple, list[int]] = {}
    for s, y, b, a, _ in counts:
        agg.setdefault((s, y), [0, 0])
        agg[(s, y)][0] += b
        agg[(s, y)][1] += a
    print(f"\n{'sensor':14s} {'year':>4s} {'before':>10s} {'after':>10s} {'kept':>5s}")
    for (s, y), (b, a) in sorted(agg.items()):
        print(f"{s:14s} {y:>4d} {b:>10,d} {a:>10,d} {a / b if b else 0:5.0%}")

    print("\nVIIRS / MODIS (filtered rows, same year; expect ~3-10x):")
    years = sorted({y for _, y in agg})
    for y in years:
        modis = sum(agg.get((s, y), [0, 0])[1] for s in ("modis_terra", "modis_aqua"))
        aqua = agg.get(("modis_aqua", y), [0, 0])[1]
        for v in ("viirs_snpp", "viirs_noaa20"):
            n = agg.get((v, y), [0, 0])[1]
            if n and modis:
                flag = "" if 3 <= n / modis <= 10 else "  <-- outside 3-10x"
                print(f"  {y} {v:13s} {n / modis:5.1f}x all MODIS, {n / max(aqua, 1):5.1f}x Aqua{flag}")


if __name__ == "__main__":
    main()

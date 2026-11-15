"""Quick check: raw vs harmonized annual totals, all India and a Punjab box.

A good harmonization shows no step at 2012, where the reference sensor switches from
Aqua MODIS (scaled) to S-NPP VIIRS. Reads data/serve/.
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.harmonize import Calibration, annual, harmonize_monthly  # noqa: E402

SERVE = ROOT / "data" / "serve"
PUNJAB = (73.8, 29.5, 77.0, 32.5)  # lon_min, lat_min, lon_max, lat_max


def counts(con, where: str = "TRUE"):
    return con.execute(f"""
      SELECT year(date) AS year, month(date) AS month, strftime(date, '%Y-%m') AS ym,
             sensor, pass, block_id, count(*) AS n, bool_or(nrt) AS nrt
      FROM read_parquet('{SERVE}/cell_daily/year=*/part.parquet', hive_partitioning=false)
      WHERE {where} GROUP BY ALL""").df()


def show(title: str, a) -> None:
    print(f"\n{title}")
    print(f"  {'year':>4s} {'harmonized':>11s} {'raw Aqua':>9s} {'raw VIIRS':>10s}")
    for r in a.itertuples():
        print(f"  {r.year:>4d} {r.harmonized:>11,.0f} {r.raw_aqua:>9,d} {r.raw_viirs:>10,d}")
    h = a.set_index("year").harmonized
    if 2011 in h and 2012 in h and 2010 in h and 2013 in h:
        before, after = h[[2010, 2011]].mean(), h[[2012, 2013]].mean()
        print(f"  2010-11 mean {before:,.0f} vs 2012-13 mean {after:,.0f} "
              f"-> ratio {after / before:.2f} (near 1 = no step)")


def main() -> None:
    calib = Calibration.load(SERVE)
    con = duckdb.connect()
    con.execute("LOAD h3")
    show("All India", annual(harmonize_monthly(counts(con), calib)))
    x0, y0, x1, y1 = PUNJAB
    where = (f"h3_cell_to_lat(h3_7) BETWEEN {y0} AND {y1} "
             f"AND h3_cell_to_lng(h3_7) BETWEEN {x0} AND {x1}")
    show("Punjab box", annual(harmonize_monthly(counts(con, where), calib)))


if __name__ == "__main__":
    main()

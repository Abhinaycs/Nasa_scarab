"""Fit sensor-to-sensor scaling factors on overlap periods.

kind = aqua_to_snpp : per 2-degree block x month x pass, shrunk toward the national
                      (month, pass) ratio; 90% bootstrap interval over years.
kind = terra_to_aqua: national per (month, pass), 2003-2019 (before orbit drift).
kind = n20_to_snpp  : national per (month, pass), 2018-2025.
National rows use block_id = 'nat'.

Only months that BOTH sensors observed (coverage.json) enter a ratio, so partially
downloaded years cannot bias it.

Input : data/work/cell_daily.parquet, data/work/coverage.json
Output: data/work/calibration.parquet
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CELL = ROOT / "data" / "work" / "cell_daily.parquet"
COVERAGE = ROOT / "data" / "work" / "coverage.json"
OUT = ROOT / "data" / "work" / "calibration.parquet"

M0 = 50.0      # shrinkage pseudo-count (MODIS cell-days)
ALPHA = 1.0
N_BOOT = 500
RNG = np.random.default_rng(42)


def monthly_counts(con, a: str, b: str, years: range, by_block: bool) -> pd.DataFrame:
    """Cell-days per (block?, year, month, pass) for sensors a (target) and b (source),
    restricted to months both sensors observed."""
    cov = json.loads(COVERAGE.read_text())
    both = sorted(set(cov.get(a, [])) & set(cov.get(b, [])))
    both = [m for m in both if int(m[:4]) in years]
    if not both:
        return pd.DataFrame()
    con.execute("CREATE OR REPLACE TEMP TABLE months AS SELECT unnest(?) AS ym", [both])
    block = "block_id" if by_block else "'nat'"
    return con.execute(f"""
      SELECT {block} AS block_id, year(date) AS year, month(date) AS month, pass,
             count(*) FILTER (WHERE sensor = '{a}') AS v,
             count(*) FILTER (WHERE sensor = '{b}') AS m
      FROM '{CELL}'
      WHERE sensor IN ('{a}', '{b}') AND strftime(date, '%Y-%m') IN (SELECT ym FROM months)
      GROUP BY ALL
    """).df()


def boot_interval(g: pd.DataFrame, k_prior: float | None) -> tuple[float, float]:
    """Resample years with replacement; return 5th/95th percentile of k."""
    v, m = g["v"].to_numpy(float), g["m"].to_numpy(float)
    if len(v) < 2:
        return (np.nan, np.nan)
    idx = RNG.integers(0, len(v), size=(N_BOOT, len(v)))
    vb, mb = v[idx].sum(1), m[idx].sum(1)
    if k_prior is None:
        kb = np.where(mb > 0, vb / np.maximum(mb, 1e-9), np.nan)
    else:
        kb = (vb + ALPHA * k_prior * M0) / (mb + ALPHA * M0)
    return tuple(np.nanpercentile(kb, [5, 95]))


def national(df: pd.DataFrame, kind: str) -> pd.DataFrame:
    rows = []
    for (month, pas), g in df.groupby(["month", "pass"]):
        gy = g.groupby("year")[["v", "m"]].sum().reset_index()
        V, M = gy["v"].sum(), gy["m"].sum()
        k = V / M if M > 0 else np.nan
        lo, hi = boot_interval(gy, None)
        rows.append(dict(block_id="nat", month=int(month), pass_=pas, k=k, k_lo=lo, k_hi=hi,
                         n_modis=int(M), n_viirs=int(V), kind=kind))
    return pd.DataFrame(rows)


def fill_missing_months(nat: pd.DataFrame, kind: str) -> pd.DataFrame:
    """Every (month, pass) needs a factor; borrow the pass's overall ratio where a month had no data."""
    out = [nat]
    for pas in ("D", "N"):
        sub = nat[(nat.pass_ == pas) & nat.k.notna()]
        if sub.empty:
            sub = nat[nat.k.notna()]
        if sub.empty:
            continue
        overall = sub.n_viirs.sum() / max(sub.n_modis.sum(), 1)
        have = set(sub.month)
        for mth in range(1, 13):
            if mth not in have:
                out.append(pd.DataFrame([dict(block_id="nat", month=mth, pass_=pas, k=overall,
                                              k_lo=np.nan, k_hi=np.nan, n_modis=0, n_viirs=0,
                                              kind=kind)]))
    res = pd.concat(out, ignore_index=True)
    return res[res.k.notna()].drop_duplicates(["block_id", "month", "pass_"], keep="first")


def fit_aqua_to_snpp(df: pd.DataFrame) -> pd.DataFrame:
    """National + per-block (shrunk) Aqua->S-NPP factors from monthly_counts(by_block=True).
    Columns: block_id, month, pass_, k, k_lo, k_hi, n_modis, n_viirs, kind."""
    nat = fill_missing_months(national(df, "aqua_to_snpp"), "aqua_to_snpp")
    knat = {(r.month, r.pass_): r.k for r in nat.itertuples()}
    rows = []
    for (blk, month, pas), g in df.groupby(["block_id", "month", "pass"]):
        gy = g.groupby("year")[["v", "m"]].sum().reset_index()
        V, M = gy["v"].sum(), gy["m"].sum()
        kp = knat.get((month, pas))
        if kp is None or np.isnan(kp):
            continue
        k = (V + ALPHA * kp * M0) / (M + ALPHA * M0)
        lo, hi = boot_interval(gy, kp)
        rows.append(dict(block_id=blk, month=int(month), pass_=pas, k=k, k_lo=lo, k_hi=hi,
                         n_modis=int(M), n_viirs=int(V), kind="aqua_to_snpp"))
    return pd.concat([nat, pd.DataFrame(rows)], ignore_index=True)


def main() -> None:
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'")
    parts = []

    # --- Aqua -> S-NPP, per block with shrinkage ---------------------------------
    df = monthly_counts(con, "viirs_snpp", "modis_aqua", range(2012, 2026), by_block=True)
    if df.empty:
        print("WARNING: no Aqua/S-NPP overlap months yet - aqua_to_snpp not fitted")
    else:
        a2s = fit_aqua_to_snpp(df)
        parts.append(a2s)
        years = sorted(df.year.unique())
        print(f"aqua_to_snpp: overlap years {years[0]}-{years[-1]} ({len(years)}), "
              f"{(a2s.block_id != 'nat').sum()} block-month-pass factors")

    # --- Terra -> Aqua and NOAA-20 -> S-NPP, national --------------------------------
    for kind, a, b, yrs in [("terra_to_aqua", "modis_aqua", "modis_terra", range(2003, 2020)),
                            ("n20_to_snpp", "viirs_snpp", "viirs_noaa20", range(2018, 2026))]:
        d = monthly_counts(con, a, b, yrs, by_block=False)
        if d.empty:
            print(f"WARNING: no overlap months for {kind} - not fitted")
            continue
        parts.append(fill_missing_months(national(d, kind), kind))
        ys = sorted(d.year.unique())
        print(f"{kind}: overlap years {ys[0]}-{ys[-1]} ({len(ys)})")

    cal = pd.concat(parts, ignore_index=True).rename(columns={"pass_": "pass"})
    cal["month"] = cal["month"].astype("int32")
    con.register("cal", cal)
    con.execute(f"COPY (SELECT block_id, month, pass, k, k_lo, k_hi, n_modis, n_viirs, kind "
                f"FROM cal ORDER BY kind, block_id, month, pass) TO '{OUT}' (FORMAT parquet)")

    nat = cal[cal.block_id == "nat"]
    print("\nNational factors (k [5%, 95%]):")
    for kind, g in nat.groupby("kind"):
        print(f"\n  {kind}")
        print("  month   day                       night")
        for mth in range(1, 13):
            cells = []
            for pas in ("D", "N"):
                r = g[(g.month == mth) & (g["pass"] == pas)]
                if r.empty:
                    cells.append(f"{'-':24s}")
                else:
                    r = r.iloc[0]
                    flag = " !" if kind != "terra_to_aqua" and pas == "D" and not 0.5 <= r.k <= 15 else ""
                    cells.append(f"{r.k:5.2f} [{r.k_lo:5.2f},{r.k_hi:5.2f}]{flag:3s}".ljust(24))
            print(f"  {mth:>5d}   " + "  ".join(cells))
    # Only daytime MODIS->VIIRS / NOAA-20->S-NPP factors are expected in 0.5-15. Night
    # Aqua->S-NPP factors are legitimately large (VIIRS 375 m sees far more small night fires,
    # Schroeder et al. 2014), and Terra->Aqua night factors < 0.5 (22:30 vs 01:30 overpass).
    bad = cal[(cal.kind != "terra_to_aqua") & (cal["pass"] == "D") & ((cal.k < 0.5) | (cal.k > 15))]
    if len(bad):
        print(f"\nFLAG: {len(bad)} factors outside 0.5-15:\n{bad.head(10).to_string()}")
    print(f"\nwrote {OUT} ({len(cal)} rows)")


if __name__ == "__main__":
    main()

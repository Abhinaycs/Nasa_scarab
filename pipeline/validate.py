"""Validation of the MODIS -> VIIRS harmonization.

1. Hold-out: fit aqua_to_snpp on 2012-2018 only, predict S-NPP monthly cell-days for
   2019-2025 from Aqua; MAPE and bias for India and 3 regions. Compared against a
   single national constant (the naive approach).
2. Pettitt change-point test on annual totals (2001-2025), naive splice vs harmonized.
3. Figures in docs/figures/ (Okabe-Ito colours, colourblind-safe).

Writes docs/figures/validation.json with every number quoted in docs/METHODS.md.
Usage: .venv/bin/python pipeline/validate.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import calibrate  # noqa: E402
from pipeline.harmonize import Calibration, annual, harmonize_monthly  # noqa: E402

WORK = ROOT / "data" / "work"
SERVE = ROOT / "data" / "serve"
FIG = ROOT / "docs" / "figures"
OKABE = {"orange": "#E69F00", "sky": "#56B4E9", "green": "#009E73", "blue": "#0072B2",
         "vermillion": "#D55E00", "purple": "#CC79A7", "grey": "#7f7f7f"}
REGIONS = {  # lon_min, lat_min, lon_max, lat_max
    "India": None,
    "Punjab": (73.8, 29.5, 77.0, 32.5),
    "Central India": (76.0, 18.0, 84.0, 24.0),
    "Northeast": (89.5, 22.0, 97.5, 29.5),
}
TRAIN, TEST = range(2012, 2019), range(2019, 2026)
MIN_ACTUAL = 20  # months with fewer S-NPP cell-days are left out of MAPE (tiny denominators)


def region_sql(box) -> str:
    if box is None:
        return "TRUE"
    x0, y0, x1, y1 = box
    return (f"h3_cell_to_lat(h3_5) BETWEEN {y0} AND {y1} AND "
            f"h3_cell_to_lng(h3_5) BETWEEN {x0} AND {x1}")


def connect():
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'")
    con.execute("LOAD h3")
    return con


def holdout(con, coverage: dict) -> dict:
    calibrate.CELL, calibrate.COVERAGE = WORK / "cell_daily.parquet", WORK / "coverage.json"
    train = calibrate.monthly_counts(con, "viirs_snpp", "modis_aqua", TRAIN, by_block=True)
    if train.empty:
        raise SystemExit("no Aqua/S-NPP overlap in 2012-2018 - download S-NPP first")
    cal = calibrate.fit_aqua_to_snpp(train).rename(columns={"pass_": "pass"})
    calib = Calibration(cal, coverage)
    k_const = train.v.sum() / train.m.sum()  # naive: one national constant

    both = sorted(set(coverage.get("viirs_snpp", [])) & set(coverage.get("modis_aqua", [])))
    test_months = [m for m in both if int(m[:4]) in TEST]
    con.execute("CREATE OR REPLACE TEMP TABLE tm AS SELECT unnest(?) AS ym", [test_months])
    out = {}
    for name, box in REGIONS.items():
        rows = con.execute(f"""
          SELECT strftime(date, '%Y-%m') AS ym, month(date) AS month, sensor, pass, block_id,
                 count(*) AS n
          FROM '{WORK / 'cell_daily.parquet'}'
          WHERE sensor IN ('modis_aqua', 'viirs_snpp') AND {region_sql(box)}
            AND strftime(date, '%Y-%m') IN (SELECT ym FROM tm)
          GROUP BY ALL""").df()
        aqua = calib.factors(rows[rows.sensor == "modis_aqua"].copy())
        pred = (aqua.n * aqua.k).groupby(aqua.ym).sum()
        pred_c = (aqua.n * k_const).groupby(aqua.ym).sum()
        act = rows[rows.sensor == "viirs_snpp"].groupby("ym").n.sum()
        df = pd.DataFrame({"actual": act, "pred": pred, "pred_const": pred_c}).fillna(0)
        ok = df[df.actual >= MIN_ACTUAL]
        if ok.empty:
            out[name] = None
            continue
        ape = (ok.pred - ok.actual).abs() / ok.actual
        ape_c = (ok.pred_const - ok.actual).abs() / ok.actual
        out[name] = dict(
            months=int(len(ok)),
            mape=round(100 * float(ape.mean()), 1),
            median_ape=round(100 * float(ape.median()), 1),
            bias=round(100 * float(df.pred.sum() / df.actual.sum() - 1), 1),
            mape_constant_k=round(100 * float(ape_c.mean()), 1),
            bias_constant_k=round(100 * float(df.pred_const.sum() / df.actual.sum() - 1), 1),
        )
    return dict(train=f"{TRAIN.start}-{TRAIN.stop - 1}", test=f"{TEST.start}-{TEST.stop - 1}",
                min_actual=MIN_ACTUAL, constant_k=round(float(k_const), 3), regions=out)


def pettitt(x: np.ndarray) -> tuple[int, float, np.ndarray]:
    """Pettitt (1979) test. Returns (index of last point before the change, p, |U_t|)."""
    n = len(x)
    s = np.sign(x[None, :] - x[:, None])  # s[i, j] = sign(x_j - x_i)
    u = np.array([s[: t + 1, t + 1:].sum() for t in range(n - 1)])
    k = np.abs(u).max()
    p = min(1.0, 2 * np.exp(-6 * k ** 2 / (n ** 3 + n ** 2)))
    return int(np.abs(u).argmax()), float(p), np.abs(u)


def p_at(absu: np.ndarray, t: int, n: int) -> float:
    return float(min(1.0, 2 * np.exp(-6 * absu[t] ** 2 / (n ** 3 + n ** 2))))


def step_tests(ann: pd.DataFrame) -> dict:
    a = ann[(ann.year >= 2001) & (ann.year <= 2025)].sort_values("year").reset_index(drop=True)
    naive = np.where(a.year < 2012, a.raw_modis, a.raw_viirs).astype(float)
    series = {"naive_splice": naive, "harmonized": a.harmonized.to_numpy(float)}
    years = a.year.to_numpy()
    t2012 = int(np.where(years == 2011)[0][0]) if 2011 in years else None
    out = {}
    for name, x in series.items():
        t, p, absu = pettitt(x)
        out[name] = dict(change_after=int(years[t]), p_max=round(p, 4),
                         p_at_2012=round(p_at(absu, t2012, len(x)), 4) if t2012 is not None else None)
    return out


def fig_annual(ann: pd.DataFrame) -> None:
    a = ann[(ann.year >= 2001) & (ann.year <= 2025)]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.plot(a.year, a.harmonized, "-", lw=5, alpha=0.45, color=OKABE["blue"], zorder=1,
            label="Harmonized (VIIRS units)")
    aq = a[a.year >= 2003]  # Aqua starts Jul 2002: 2002 is a half year
    ax.plot(aq.year, aq.raw_aqua.where(aq.raw_aqua > 0), "-o", ms=3, color=OKABE["sky"], zorder=3,
            label="Raw Aqua MODIS (1 km)")
    ax.plot(a.year, a.raw_viirs.where(a.raw_viirs > 0), "--o", ms=4, color=OKABE["orange"], zorder=4,
            label="Raw VIIRS S-NPP (375 m)")
    ax.axvline(2011.5, color=OKABE["grey"], ls=":", lw=1)
    ax.text(2011.6, ax.get_ylim()[1] * 0.95, "VIIRS starts", color=OKABE["grey"], fontsize=8, va="top")
    ax.set_ylabel("Fire cell-days per year (India)")
    ax.set_title("Raw sensors disagree; the harmonized series is continuous")
    ax.legend(frameon=False, fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIG / "annual_raw_vs_harmonized.png", dpi=150)
    plt.close(fig)


def fig_scatter(con, cal: pd.DataFrame, coverage: dict) -> None:
    both = sorted(set(coverage.get("viirs_snpp", [])) & set(coverage.get("modis_aqua", [])))
    con.execute("CREATE OR REPLACE TEMP TABLE bm AS SELECT unnest(?) AS ym", [both])
    m = con.execute(f"""
      SELECT strftime(date, '%Y-%m') ym, pass,
             count(*) FILTER (WHERE sensor = 'modis_aqua') AS aqua,
             count(*) FILTER (WHERE sensor = 'viirs_snpp') AS snpp
      FROM '{WORK / 'cell_daily.parquet'}'
      WHERE strftime(date, '%Y-%m') IN (SELECT ym FROM bm) GROUP BY ALL""").df()
    fig, ax = plt.subplots(figsize=(5.2, 5))
    for pas, col, lab in (("D", OKABE["orange"], "Day"), ("N", OKABE["blue"], "Night")):
        d = m[(m["pass"] == pas) & (m.aqua > 0) & (m.snpp > 0)]
        ax.scatter(d.aqua, d.snpp, s=10, alpha=0.6, color=col, label=f"{lab} (one point per month)")
        k = d.snpp.sum() / d.aqua.sum()
        xs = np.logspace(np.log10(max(d.aqua.min(), 1)), np.log10(d.aqua.max()), 50)
        ax.plot(xs, k * xs, color=col, lw=1.5)
        ax.text(xs[-1], k * xs[-1], f" k={k:.1f}", color=col, fontsize=8, va="center")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Aqua MODIS cell-days per month")
    ax.set_ylabel("S-NPP VIIRS cell-days per month")
    ax.set_title("Overlap 2012-2025, India")
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIG / "aqua_vs_snpp_scatter.png", dpi=150)
    plt.close(fig)


def fig_k(cal: pd.DataFrame) -> None:
    nat = cal[(cal.kind == "aqua_to_snpp") & (cal.block_id == "nat")]
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for pas, col, lab, off in (("D", OKABE["orange"], "Day pass (13:30)", -0.12),
                               ("N", OKABE["blue"], "Night pass (01:30)", 0.12)):
        d = nat[nat["pass"] == pas].sort_values("month")
        err = np.vstack([d.k - d.k_lo.fillna(d.k), d.k_hi.fillna(d.k) - d.k])
        ax.errorbar(d.month + off, d.k, yerr=err, fmt="o-", ms=4, capsize=2, color=col, label=lab)
    ax.set_xticks(range(1, 13), ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"])
    ax.set_ylabel("k = VIIRS / MODIS cell-days")
    ax.set_title("National Aqua → S-NPP factor by month (90% bootstrap interval)")
    ax.legend(frameon=False, fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIG / "k_by_month.png", dpi=150)
    plt.close(fig)


def main() -> None:
    FIG.mkdir(parents=True, exist_ok=True)
    con = connect()
    coverage = json.loads((WORK / "coverage.json").read_text())
    res = {"holdout": holdout(con, coverage)}

    calib = Calibration.load(SERVE)
    counts = con.execute(f"""
      SELECT year(date) AS year, month(date) AS month, strftime(date, '%Y-%m') AS ym,
             sensor, pass, block_id, count(*) AS n, bool_or(nrt) AS nrt
      FROM read_parquet('{SERVE}/cell_daily/year=*/part.parquet') GROUP BY ALL""").df()
    ann = annual(harmonize_monthly(counts, calib))
    res["pettitt"] = step_tests(ann)
    a = ann.set_index("year")
    if {2010, 2011, 2012, 2013} <= set(a.index):
        res["step_ratio_2012_13_vs_2010_11"] = dict(
            naive=round(float(a.loc[[2012, 2013]].raw_viirs.mean() / a.loc[[2010, 2011]].raw_modis.mean()), 2),
            harmonized=round(float(a.loc[[2012, 2013]].harmonized.mean() / a.loc[[2010, 2011]].harmonized.mean()), 2))
    nat = calib.cal[(calib.cal.block_id == "nat")]
    res["national_k"] = {kind: {f"{int(r.month):02d}{r['pass']}": round(float(r.k), 2)
                                for _, r in g.iterrows()} for kind, g in nat.groupby("kind")}
    a2s = nat[nat.kind == "aqua_to_snpp"]
    if len(a2s):
        res["aqua_to_snpp_overall"] = round(float(a2s.n_viirs.sum() / max(a2s.n_modis.sum(), 1)), 2)

    fig_annual(ann)
    fig_scatter(con, calib.cal, coverage)
    fig_k(calib.cal)
    (FIG / "validation.json").write_text(json.dumps(res, indent=1))

    h = res["holdout"]
    print(f"Hold-out (fit {h['train']}, test {h['test']}, months with >= {MIN_ACTUAL} cell-days):")
    print(f"  {'region':14s} {'months':>6s} {'MAPE':>6s} {'bias':>6s}   {'const-k MAPE':>12s} {'bias':>6s}")
    for name, r in h["regions"].items():
        if r:
            print(f"  {name:14s} {r['months']:>6d} {r['mape']:>5.1f}% {r['bias']:>+5.1f}%   "
                  f"{r['mape_constant_k']:>11.1f}% {r['bias_constant_k']:>+5.1f}%")
    print("Pettitt:", json.dumps(res["pettitt"]))
    print("Step ratio 2012-13 / 2010-11:", res.get("step_ratio_2012_13_vs_2010_11"))
    print("Figures:", ", ".join(p.name for p in sorted(FIG.glob("*.png"))))


if __name__ == "__main__":
    main()

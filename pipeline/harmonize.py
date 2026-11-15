"""Harmonization: turn per-sensor fire cell-days into one series in S-NPP VIIRS units.

Shared by the pipeline (quick checks) and the API (`from pipeline.harmonize import ...`).

Source rule per calendar month, the best reference sensor that observed that month
(coverage.json, national), in priority order:
    viirs_snpp                       -> used as is              (source 'viirs_snpp')
    viirs_noaa20  x n20_to_snpp      -> NOAA-20 era (2026+)     (source 'viirs_noaa20_scaled')
    modis_aqua    x aqua_to_snpp     -> Jul 2002 - 2011         (source 'modis_aqua_scaled')
    modis_terra   x terra_to_aqua x aqua_to_snpp -> 2000-2002   (source 'modis_terra_scaled')
aqua_to_snpp is looked up per (2-degree block, month, pass), falling back to the national
(month, pass) factor; the other two are national (month, pass).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

PRIORITY = ["viirs_snpp", "viirs_noaa20", "modis_aqua", "modis_terra"]
SOURCE_NAME = {
    "viirs_snpp": "viirs_snpp",
    "viirs_noaa20": "viirs_noaa20_scaled",
    "modis_aqua": "modis_aqua_scaled",
    "modis_terra": "modis_terra_scaled",
}
SENSORS = ["modis_terra", "modis_aqua", "viirs_snpp", "viirs_noaa20"]


class Calibration:
    """Factor lookups built once from calibration.parquet + coverage.json."""

    def __init__(self, cal: pd.DataFrame, coverage: dict[str, list[str]]):
        self.cal = cal
        self.coverage = {s: set(m) for s, m in coverage.items()}
        # month string -> chosen sensor
        all_months = sorted(set().union(*self.coverage.values())) if self.coverage else []
        self.month_source: dict[str, str] = {}
        for ym in all_months:
            for s in PRIORITY:
                if ym in self.coverage.get(s, set()):
                    self.month_source[ym] = s
                    break

    @classmethod
    def load(cls, data_dir: Path) -> "Calibration":
        cal = pd.read_parquet(Path(data_dir) / "calibration.parquet")
        meta_cov = Path(data_dir) / "coverage.json"
        if not meta_cov.exists():
            meta_cov = Path(data_dir) / "meta.json"
            coverage = json.loads(meta_cov.read_text())["coverage"]
        else:
            coverage = json.loads(meta_cov.read_text())
        return cls(cal, coverage)

    def months(self, start: str | None = None, end: str | None = None) -> list[str]:
        ms = sorted(self.month_source)
        if start:
            ms = [m for m in ms if m >= start[:7]]
        if end:
            ms = [m for m in ms if m <= end[:7]]
        return ms

    def factors(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add k, k_lo, k_hi columns to rows with sensor, block_id, month, pass."""
        df = df.copy()
        df["k"], df["k_lo"], df["k_hi"] = 1.0, 1.0, 1.0
        cal = self.cal

        def lookup(kind: str, by_block: bool) -> pd.DataFrame:
            c = cal[cal.kind == kind]
            nat = c[c.block_id == "nat"][["month", "pass", "k", "k_lo", "k_hi"]]
            out = df[["month", "pass"]].merge(nat, on=["month", "pass"], how="left")
            if by_block:
                blk = c[c.block_id != "nat"][["block_id", "month", "pass", "k", "k_lo", "k_hi"]]
                b = df[["block_id", "month", "pass"]].merge(
                    blk, on=["block_id", "month", "pass"], how="left")
                for col in ("k", "k_lo", "k_hi"):
                    out[col] = b[col].where(b[col].notna(), out[col]).to_numpy()
            for col in ("k_lo", "k_hi"):
                out[col] = out[col].where(out[col].notna(), out["k"])
            # a factor that could not be fitted (overlap not downloaded) is neutral, so the
            # other factors in a chain (e.g. Terra->Aqua) still apply
            out[["k", "k_lo", "k_hi"]] = out[["k", "k_lo", "k_hi"]].fillna(1.0)
            return out.set_index(df.index)

        a2s = lookup("aqua_to_snpp", by_block=True)
        t2a = lookup("terra_to_aqua", by_block=False)
        n2s = lookup("n20_to_snpp", by_block=False)

        aqua = df.sensor == "modis_aqua"
        terra = df.sensor == "modis_terra"
        n20 = df.sensor == "viirs_noaa20"
        for col in ("k", "k_lo", "k_hi"):
            df.loc[aqua, col] = a2s.loc[aqua, col]
            df.loc[terra, col] = a2s.loc[terra, col] * t2a.loc[terra, "k"]
            df.loc[n20, col] = n2s.loc[n20, col]
        return df


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "ym" not in df:
        d = pd.to_datetime(df["date"])
        df["year"], df["month"] = d.dt.year, d.dt.month
        df["ym"] = d.dt.strftime("%Y-%m")
    if "n" not in df:
        df["n"] = 1
    if "nrt" not in df:
        df["nrt"] = False
    return df


def harmonize_monthly(counts: pd.DataFrame, calib: Calibration,
                      start: str | None = None, end: str | None = None) -> pd.DataFrame:
    """counts: rows of (year, month, sensor, pass, block_id, n, nrt) - n = cell-days -
    or raw cell_daily rows (date, sensor, pass, block_id[, nrt]).
    Returns one row per covered month in [start, end] with the contract fields:
    year, month, value, raw (dict), source, k, k_lo, k_hi, provisional.
    Months with no fires in the AOI but observed by a sensor get value 0."""
    df = _prep(counts)
    if "ym" not in counts:
        df = (df.groupby(["year", "month", "ym", "sensor", "pass", "block_id"], as_index=False)
                .agg(n=("n", "sum"), nrt=("nrt", "max")))
    df = calib.factors(df)
    df["v"], df["v_lo"], df["v_hi"] = df.n * df.k, df.n * df.k_lo, df.n * df.k_hi

    raw = df.pivot_table(index="ym", columns="sensor", values="n", aggfunc="sum", fill_value=0)
    out = []
    for ym in calib.months(start, end):
        src = calib.month_source[ym]
        sub = df[(df.ym == ym) & (df.sensor == src)]
        n = float(sub.n.sum())
        v = float(sub.v.sum())
        scaled = src != "viirs_snpp"
        rawd = {s: int(raw.at[ym, s]) if (ym in raw.index and s in raw.columns) else 0
                for s in SENSORS}
        out.append(dict(
            year=int(ym[:4]), month=int(ym[5:]),
            value=round(v, 2),
            raw=rawd,
            source=SOURCE_NAME[src],
            k=(round(v / n, 4) if n else _nat_k(calib, src, int(ym[5:]))) if scaled else None,
            k_lo=(round(float(sub.v_lo.sum()) / n, 4) if n else None) if scaled else None,
            k_hi=(round(float(sub.v_hi.sum()) / n, 4) if n else None) if scaled else None,
            provisional=bool(sub.nrt.any()) if len(sub) else False,
        ))
    return pd.DataFrame(out)


def _nat_k(calib: Calibration, sensor: str, month: int) -> float | None:
    probe = pd.DataFrame([dict(sensor=sensor, block_id="nat", month=month, pass_="D")]).rename(
        columns={"pass_": "pass"})
    k = calib.factors(probe).k.iloc[0]
    return round(float(k), 4) if k is not None and not np.isnan(k) else None


def harmonize_daily(rows: pd.DataFrame, calib: Calibration,
                    start: str | None = None, end: str | None = None) -> pd.DataFrame:
    """rows: (date, sensor, pass, block_id[, n]) -> (date, value) using the month's source."""
    df = _prep(rows)
    df = df[df.ym.map(calib.month_source) == df.sensor]
    if start:
        df = df[df.ym >= start[:7]]
    if end:
        df = df[df.ym <= end[:7]]
    if df.empty:
        return pd.DataFrame(columns=["date", "value"])
    df = calib.factors(df)
    df["value"] = df.n * df.k
    return df.groupby("date", as_index=False)["value"].sum()


def annual(monthly: pd.DataFrame) -> pd.DataFrame:
    """Contract `annual`: harmonized, raw MODIS (Terra+Aqua), raw VIIRS (S-NPP, else NOAA-20)."""
    if monthly.empty:
        return pd.DataFrame(columns=["year", "harmonized", "raw_modis", "raw_viirs"])
    m = monthly.copy()
    m["raw_modis"] = m.raw.map(lambda r: r["modis_terra"] + r["modis_aqua"])
    m["raw_aqua"] = m.raw.map(lambda r: r["modis_aqua"])
    m["raw_viirs"] = m.raw.map(lambda r: r["viirs_snpp"] or r["viirs_noaa20"])
    a = m.groupby("year", as_index=False).agg(
        harmonized=("value", "sum"), raw_modis=("raw_modis", "sum"),
        raw_aqua=("raw_aqua", "sum"), raw_viirs=("raw_viirs", "sum"))
    a["harmonized"] = a.harmonized.round(1)
    return a


def to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> JSON-safe list of dicts (NaN -> None), for the API."""
    recs = df.to_dict(orient="records")
    for r in recs:
        for key, val in r.items():
            if isinstance(val, float) and np.isnan(val):
                r[key] = None
    return recs

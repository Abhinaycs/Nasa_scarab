"""Fire Activity Calendar API: FastAPI + DuckDB over data/serve (see docs/CONTRACT.md).

Run from the repo root:  .venv/bin/uvicorn backend.app.main:app --port 8000
Env: DATA_DIR (default data/serve), ALLOWED_ORIGINS (comma-separated, default *).
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import threading
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import duckdb
import h3
import numpy as np
import pandas as pd
import shapely
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pyproj import Geod
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.harmonize import Calibration, annual, harmonize_daily, harmonize_monthly, to_records  # noqa: E402

DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data" / "serve"))
MAX_AREA_KM2 = 400_000
MAX_R7_CELLS = 50_000
MAX_CSV_ROWS = 200_000
MIN_MEDIAN_FOR_LABEL = 5
GEOD = Geod(ellps="WGS84")
MONTHS = list(range(1, 13))

# ---------------------------------------------------------------- startup ----
_con = duckdb.connect()
_con.execute("SET memory_limit='" + os.environ.get('DUCKDB_MEMORY_LIMIT', '200MB') + "'")
_con.execute("SET threads=2")
_con.execute(f"""CREATE VIEW cell_daily AS SELECT * FROM read_parquet(
    '{DATA_DIR}/cell_daily/year=*/part.parquet', hive_partitioning=true)""")
_con.execute(f"""CREATE VIEW hotspots AS SELECT * FROM read_parquet(
    '{DATA_DIR}/hotspots/year=*/part.parquet', hive_partitioning=true)""")
_lock = threading.Lock()
CALIB = Calibration.load(DATA_DIR)
META = json.loads((DATA_DIR / "meta.json").read_text())
ALL_MONTHS = CALIB.months()
FIRST, LAST = (ALL_MONTHS[0], ALL_MONTHS[-1]) if ALL_MONTHS else ("2000-11", date.today().strftime("%Y-%m"))


def cursor() -> duckdb.DuckDBPyConnection:
    with _lock:
        return _con.cursor()


app = FastAPI(title="Fire Activity Calendar API", version=META.get("method_version", "1.0"),
              description="Harmonized MODIS + VIIRS fire cell-days for India (NASA FIRMS).")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")],
    allow_methods=["*"], allow_headers=["*"],
    expose_headers=["X-Truncated", "Content-Disposition"],
)


# ---------------------------------------------------------------- request ----
class AnalysisRequest(BaseModel):
    geometry: dict
    start: date = Field(default=date(2000, 11, 1))
    end: date = Field(default_factory=date.today)
    baseline: Literal["all", "2003-2022"] = "all"


class Aoi:
    def __init__(self, geometry: dict):
        try:
            geom = shape(geometry)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(422, f"Invalid GeoJSON geometry: {e}") from e
        if geom.geom_type not in ("Polygon", "MultiPolygon"):
            raise HTTPException(422, "geometry must be a Polygon or MultiPolygon")
        if not geom.is_valid:
            geom = shapely.make_valid(geom)
        if geom.is_empty:
            raise HTTPException(422, "geometry is empty")
        self.geom = geom
        self.area_km2 = abs(GEOD.geometry_area_perimeter(geom)[0]) / 1e6
        if self.area_km2 > MAX_AREA_KM2:
            raise HTTPException(413, f"Area is {self.area_km2:,.0f} km²; the limit is "
                                     f"{MAX_AREA_KM2:,} km². Draw a smaller area.")
        self.key = hashlib.sha1(json.dumps(mapping(geom), sort_keys=True).encode()).hexdigest()
        self.resolution, self.cells = cells_for(self.key, json.dumps(mapping(geom)))


@lru_cache(maxsize=256)
def cells_for(key: str, geojson: str) -> tuple[int, tuple[int, ...]]:
    gj = json.loads(geojson)
    polys = [gj["coordinates"]] if gj["type"] == "Polygon" else gj["coordinates"]
    res = 7
    cells: set[str] = set()
    for p in polys:
        cells |= set(h3.geo_to_cells({"type": "Polygon", "coordinates": p}, res))
    if len(cells) > MAX_R7_CELLS:
        res = 5
        cells = {h3.cell_to_parent(c, 5) for c in cells}
    if not cells:  # polygon smaller than one cell: use the cell under its centroid
        c = shape(gj).representative_point()
        cells = {h3.latlng_to_cell(c.y, c.x, res)}
    return res, tuple(sorted(h3.str_to_int(c) for c in cells))


def aoi_cursor(aoi: Aoi) -> tuple[duckdb.DuckDBPyConnection, str]:
    cur = cursor()
    cur.register("aoi_cells", pd.DataFrame({"cell": np.array(aoi.cells, dtype=np.uint64)}))
    col = "h3_7" if aoi.resolution == 7 else "h3_5"
    return cur, col


# ------------------------------------------------------------ core series ----
@lru_cache(maxsize=128)
def monthly_full(key: str, resolution: int, cells: tuple[int, ...]) -> pd.DataFrame:
    """Harmonized monthly series over the whole record for an AOI (cached per geometry)."""
    cur = cursor()
    cur.register("aoi_cells", pd.DataFrame({"cell": np.array(cells, dtype=np.uint64)}))
    col = "h3_7" if resolution == 7 else "h3_5"
    counts = cur.execute(f"""
      SELECT year(date) AS year, month(date) AS month, strftime(date, '%Y-%m') AS ym,
             sensor, pass, block_id, count(*) AS n, bool_or(nrt) AS nrt
      FROM cell_daily c JOIN aoi_cells a ON c.{col} = a.cell
      GROUP BY ALL""").df()
    return harmonize_monthly(counts, CALIB)


def baseline_years(baseline: str, years: list[int]) -> list[int]:
    if baseline == "2003-2022":
        return [y for y in years if 2003 <= y <= 2022]
    return years


def complete_years(m: pd.DataFrame) -> list[int]:
    """Years whose 12 months are all observed (excludes partial first/last years)."""
    g = m.groupby("year").month.nunique()
    return sorted(g[g == 12].index.tolist())


def climatology(m: pd.DataFrame, years: list[int]) -> pd.DataFrame:
    rows = []
    for mth in MONTHS:
        v = m[(m.month == mth) & m.year.isin(years)].value.to_numpy(float)
        if len(v) == 0:
            continue
        q = np.percentile(v, [10, 25, 50, 75, 90])
        rows.append(dict(month=mth, median=q[2], q25=q[1], q75=q[3], p10=q[0], p90=q[4],
                         min=v.min(), max=v.max(), mean=v.mean()))
    return pd.DataFrame(rows).round(2)


def anomaly(x: float, base: np.ndarray) -> dict:
    if len(base) == 0:
        return dict(pct_of_median=None, robust_z=None, percentile=None, label=None)
    q10, q25, med, q75, q90 = np.percentile(base, [10, 25, 50, 75, 90])
    iqr = max(q75 - q25, 1.0)
    pct_rank = 100.0 * ((base < x).sum() + 0.5 * (base == x).sum()) / len(base)
    if med < MIN_MEDIAN_FOR_LABEL:
        label = None
    elif x > q90:
        label = "unusually high"
    elif x < q10:
        label = "unusually low"
    else:
        label = "normal"
    return dict(pct_of_median=round(100.0 * x / med, 1) if med > 0 else None,
                robust_z=round((x - med) / iqr, 2), percentile=round(pct_rank, 1), label=label)


def in_range(m: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    ym = m.year.astype(str) + "-" + m.month.astype(str).str.zfill(2)
    return m[(ym >= start.strftime("%Y-%m")) & (ym <= end.strftime("%Y-%m"))]


def series(req: AnalysisRequest) -> tuple[Aoi, pd.DataFrame, pd.DataFrame, list[int]]:
    if req.start > req.end:
        raise HTTPException(422, "start must be before end")
    aoi = Aoi(req.geometry)
    full = monthly_full(aoi.key, aoi.resolution, aoi.cells)
    years = baseline_years(req.baseline, complete_years(full))
    return aoi, full, in_range(full, req.start, req.end), years


# ------------------------------------------------------------------ routes ----
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return META


@app.post("/api/calendar")
def calendar(req: AnalysisRequest):
    aoi, full, m, years = series(req)
    clim = climatology(full, years)
    cells = add_anomalies_for(full, m, years)
    ann = annual(m)
    return dict(
        aoi=dict(area_km2=round(aoi.area_km2, 1), cells=len(aoi.cells), resolution=aoi.resolution),
        unit="fire cell-days (S-NPP VIIRS equivalent)",
        years=sorted(int(y) for y in m.year.unique()),
        cells=cells,
        climatology=to_records(clim),
        annual=to_records(ann[["year", "harmonized", "raw_modis", "raw_viirs"]]) if len(ann) else [],
    )


def add_anomalies_for(full: pd.DataFrame, m: pd.DataFrame, years: list[int]) -> list[dict]:
    """Anomalies for the months in range, against the full-record baseline."""
    out = []
    for r in to_records(m):
        base = full[(full.month == r["month"]) & full.year.isin(years) & (full.year != r["year"])].value
        r["anomaly"] = anomaly(r["value"], base.to_numpy(float))
        out.append(r)
    return out


def fire_season(clim: pd.DataFrame) -> dict:
    if clim.empty or clim["median"].sum() <= 0:
        return dict(start_month=None, end_month=None, length_months=None)
    med = {int(r.month): r.median for r in clim.itertuples()}
    v = np.array([med.get(mm, 0.0) for mm in MONTHS])
    target = 0.8 * v.sum()
    best = None
    for length in range(1, 13):
        for s in range(12):
            tot = sum(v[(s + i) % 12] for i in range(length))
            if tot >= target and (best is None or tot > best[2]):
                best = (s, length, tot)
        if best:
            break
    s, length, _ = best
    return dict(start_month=s + 1, end_month=(s + length - 1) % 12 + 1, length_months=length)


@app.post("/api/summary")
def summary(req: AnalysisRequest):
    aoi, full, m, years = series(req)
    clim = climatology(full, years)
    out = dict(peak_month=None, busiest_year=None, current_month=None,
               season=fire_season(clim), total_cell_days=round(float(m.value.sum()), 1) if len(m) else 0.0)
    if not clim.empty and clim["median"].max() > 0:
        out["peak_month"] = int(clim.sort_values(["median", "mean"], ascending=False).iloc[0].month)
    ann = annual(m[m.year.isin(complete_years(full))]) if len(m) else pd.DataFrame()
    if len(ann) and ann.harmonized.max() > 0:
        b = ann.sort_values("harmonized", ascending=False).iloc[0]
        out["busiest_year"] = dict(year=int(b.year), value=float(b.harmonized))
    if len(m):
        last = m.sort_values(["year", "month"]).iloc[-1]
        base = full[(full.month == last.month) & full.year.isin(years) & (full.year != last.year)].value
        a = anomaly(float(last.value), base.to_numpy(float))
        out["current_month"] = dict(
            year=int(last.year), month=int(last.month), value=float(last.value),
            median=float(np.median(base)) if len(base) else None,
            pct_of_median=a["pct_of_median"], percentile=a["percentile"], label=a["label"],
            provisional=bool(last.provisional))
    return out


@app.post("/api/timeseries")
def timeseries(req: AnalysisRequest):
    if req.start > req.end:
        raise HTTPException(422, "start must be before end")
    aoi = Aoi(req.geometry)
    cur, col = aoi_cursor(aoi)
    rows = cur.execute(f"""
      SELECT date, sensor, pass, block_id, count(*) AS n
      FROM cell_daily c JOIN aoi_cells a ON c.{col} = a.cell
      WHERE c.date BETWEEN ? AND ? AND c.year BETWEEN ? AND ?
      GROUP BY ALL""", [req.start, req.end, req.start.year, req.end.year]).df()
    daily = harmonize_daily(rows, CALIB, str(req.start), str(req.end)) if len(rows) else \
        pd.DataFrame(columns=["date", "value"])
    if daily.empty:
        return dict(weekly=[], ytd=[])
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date")
    wk = daily.assign(week_start=daily.date - pd.to_timedelta(daily.date.dt.weekday, unit="D"))
    weekly = wk.groupby("week_start", as_index=False).value.sum()
    weekly["week_start"] = weekly.week_start.dt.strftime("%Y-%m-%d")
    weekly["value"] = weekly.value.round(2)
    # year-to-date: cumulative value at the end of each ISO week (keeps payload small)
    daily["year"] = daily.date.dt.year
    daily["doy"] = daily.date.dt.dayofyear
    daily["cum"] = daily.groupby("year").value.cumsum()
    daily["wk"] = (daily.doy - 1) // 7
    ytd = daily.groupby(["year", "wk"], as_index=False).agg(doy=("doy", "max"), cum=("cum", "max"))
    ytd["cum"] = ytd.cum.round(1)
    return dict(weekly=to_records(weekly), ytd=to_records(ytd[["year", "doy", "cum"]]))


@app.post("/api/hotspots.csv")
def hotspots_csv(req: AnalysisRequest):
    if req.start > req.end:
        raise HTTPException(422, "start must be before end")
    aoi = Aoi(req.geometry)
    cur = cursor()
    cells = np.array(aoi.cells, dtype=np.uint64)
    if aoi.resolution == 5:  # hotspots only carry h3_7: expand r5 cells to their r7 children
        cells = np.array([h3.str_to_int(ch) for c in aoi.cells
                          for ch in h3.cell_to_children(h3.int_to_str(int(c)), 7)], dtype=np.uint64)
    cur.register("aoi_cells", pd.DataFrame({"cell": cells}))
    df = cur.execute("""
      SELECT h.lat, h.lon, h.date, h.time, h.sensor, h.confidence, h.frp, h.pass, h.h3_7
      FROM hotspots h JOIN aoi_cells a ON h.h3_7 = a.cell
      WHERE h.date BETWEEN ? AND ? AND h.year BETWEEN ? AND ?
      ORDER BY h.date, h.time
      LIMIT ?""", [req.start, req.end, req.start.year, req.end.year, int(MAX_CSV_ROWS * 1.3)]).df()
    if len(df):
        df = df[shapely.contains_xy(aoi.geom, df.lon.to_numpy(), df.lat.to_numpy())
                | (len(aoi.cells) == 1)]  # tiny AOI: keep its one cell
    truncated = len(df) > MAX_CSV_ROWS
    df = df.head(MAX_CSV_ROWS)
    if len(df):
        d = pd.to_datetime(df.date)
        blocks = {c: block_of(int(c)) for c in df.h3_7.unique()}
        f = CALIB.factors(pd.DataFrame(dict(sensor=df.sensor.values, pass_=df["pass"].values,
                                            month=d.dt.month.values,
                                            block_id=df.h3_7.map(blocks).values)
                                       ).rename(columns={"pass_": "pass"}))
        df["harmonization_k"] = np.where(df.sensor.values == "viirs_snpp", np.nan, f.k.round(4).values)
    else:
        df["harmonization_k"] = []
    out = pd.DataFrame(dict(
        latitude=df.lat.round(5), longitude=df.lon.round(5),
        acq_date=pd.to_datetime(df.date).dt.strftime("%Y-%m-%d") if len(df) else [],
        acq_time=df.time, sensor=df.sensor, confidence=df.confidence,
        frp=df.frp, daynight=df["pass"], harmonization_k=df.harmonization_k))
    buf = io.StringIO()
    out.to_csv(buf, index=False)
    return Response(buf.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="hotspots_{req.start}_{req.end}.csv"',
        "X-Truncated": "true" if truncated else "false",
    })


@lru_cache(maxsize=200_000)
def block_of(cell7: int) -> str:
    lat, lng = h3.cell_to_latlng(h3.cell_to_parent(h3.int_to_str(cell7), 5))
    return f"{int(np.floor(lat / 2) * 2)}_{int(np.floor(lng / 2) * 2)}"

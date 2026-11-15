"""Contract tests for the API (docs/CONTRACT.md). Run: .venv/bin/python -m pytest backend/tests -q"""
from __future__ import annotations

import io
import time

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def box(x0, y0, x1, y1):
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


PUNJAB = {"geometry": box(73.8, 29.5, 77.0, 32.5), "start": "2000-11-01", "end": "2026-11-15",
          "baseline": "all"}
PUNJAB_SMALL = {**PUNJAB, "geometry": box(75.0, 30.0, 76.5, 31.5)}
# 0.01 degrees in the Arabian Sea: no fires
EMPTY = {**PUNJAB, "geometry": box(66.0, 15.0, 66.01, 15.01)}
INDIA = {**PUNJAB, "geometry": box(68.0, 7.0, 97.5, 35.5)}

CELL_KEYS = {"year", "month", "value", "raw", "source", "k", "k_lo", "k_hi", "provisional", "anomaly"}
SOURCES = {"modis_terra_scaled", "modis_aqua_scaled", "viirs_snpp", "viirs_noaa20_scaled"}
CLIM_KEYS = {"month", "median", "q25", "q75", "p10", "p90", "min", "max", "mean"}


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_meta_shape():
    m = client.get("/api/meta").json()
    for k in ("coverage", "build_time", "method_version", "national_factors"):
        assert k in m
    for cov in m["coverage"].values():
        assert set(cov) == {"start", "end"}


@pytest.mark.parametrize("req", [PUNJAB_SMALL, PUNJAB])
def test_calendar_shape(req):
    r = client.post("/api/calendar", json=req)
    assert r.status_code == 200, r.text
    c = r.json()
    assert set(c) == {"aoi", "unit", "years", "cells", "climatology", "annual"}
    assert set(c["aoi"]) == {"area_km2", "cells", "resolution"}
    assert c["aoi"]["resolution"] in (5, 7)
    assert c["cells"], "Punjab should have fire months"
    for cell in c["cells"]:
        assert set(cell) == CELL_KEYS
        assert cell["source"] in SOURCES
        assert set(cell["raw"]) == {"modis_terra", "modis_aqua", "viirs_snpp", "viirs_noaa20"}
        assert set(cell["anomaly"]) == {"pct_of_median", "robust_z", "percentile", "label"}
        assert cell["anomaly"]["label"] in ("unusually high", "unusually low", "normal", None)
        if cell["source"] == "viirs_snpp":
            assert cell["k"] is None
    assert all(set(x) == CLIM_KEYS for x in c["climatology"])
    assert all(set(a) == {"year", "harmonized", "raw_modis", "raw_viirs"} for a in c["annual"])
    assert c["years"] == sorted({x["year"] for x in c["cells"]})


def test_calendar_empty_area():
    c = client.post("/api/calendar", json=EMPTY).json()
    assert c["aoi"]["cells"] >= 1
    assert all(x["value"] == 0 for x in c["cells"])
    assert all(x["anomaly"]["label"] is None for x in c["cells"])


def test_india_is_413():
    r = client.post("/api/calendar", json=INDIA)
    assert r.status_code == 413
    assert "limit" in r.json()["detail"]


def test_invalid_geometry_422():
    assert client.post("/api/calendar", json={**PUNJAB, "geometry": {"type": "Point",
                                                                      "coordinates": [75, 30]}}).status_code == 422


def test_summary_shape():
    s = client.post("/api/summary", json=PUNJAB_SMALL).json()
    assert set(s) == {"peak_month", "busiest_year", "current_month", "season", "total_cell_days"}
    assert 1 <= s["peak_month"] <= 12
    assert set(s["season"]) == {"start_month", "end_month", "length_months"}
    assert set(s["current_month"]) == {"year", "month", "value", "median", "pct_of_median",
                                       "percentile", "label", "provisional"}
    e = client.post("/api/summary", json=EMPTY).json()
    assert e["peak_month"] is None and e["total_cell_days"] == 0


def test_timeseries_shape():
    t = client.post("/api/timeseries", json=PUNJAB_SMALL).json()
    assert set(t) == {"weekly", "ytd"}
    assert t["weekly"] and set(t["weekly"][0]) == {"week_start", "value"}
    assert t["ytd"] and set(t["ytd"][0]) == {"year", "doy", "cum"}
    assert client.post("/api/timeseries", json=EMPTY).json() == {"weekly": [], "ytd": []}


def test_hotspots_csv():
    r = client.post("/api/hotspots.csv", json={**PUNJAB_SMALL, "start": "2008-10-01", "end": "2008-11-30"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    assert r.headers["x-truncated"] in ("true", "false")
    df = pd.read_csv(io.StringIO(r.text))
    assert list(df.columns) == ["latitude", "longitude", "acq_date", "acq_time", "sensor",
                                "confidence", "frp", "daynight", "harmonization_k"]
    assert len(df) > 0
    assert df.latitude.between(30.0, 31.5).all() and df.longitude.between(75.0, 76.5).all()


def test_calendar_latency():
    req = {**PUNJAB, "geometry": box(73.81, 29.5, 77.0, 32.5)}  # uncached geometry
    t0 = time.perf_counter()
    assert client.post("/api/calendar", json=req).status_code == 200
    cold = time.perf_counter() - t0
    t0 = time.perf_counter()
    client.post("/api/calendar", json=req)
    warm = time.perf_counter() - t0
    print(f"\n/api/calendar Punjab box: cold {cold:.2f}s, cached {warm:.2f}s")
    assert cold < 3.0

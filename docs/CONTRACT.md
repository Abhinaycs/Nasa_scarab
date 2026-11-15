# Data and API contract

This is the interface between the pipeline/API (Sravani) and the frontend (Abhinay). If you change anything here, commit it on its own with a message starting `contract:` and tell the other person.

## Served files (`data/serve/`, committed, each under 50 MB)
| File | Grain | Columns |
|---|---|---|
| `cell_daily/year=YYYY/part.parquet` | H3 r7 cell × date × sensor × pass | `h3_7 UBIGINT, h3_5 UBIGINT, date DATE, sensor VARCHAR, pass VARCHAR('D'/'N'), n_det INT, frp_sum DOUBLE, frp_max DOUBLE, nrt BOOLEAN, block_id VARCHAR` |
| `coverage.json` | sensor → list of `YYYY-MM` months it observed | decides each month's reference sensor (see `pipeline/harmonize.py`) |
| `calibration.parquet` | 2° block × month × pass | `block_id VARCHAR, month INT, pass VARCHAR, k DOUBLE, k_lo DOUBLE, k_hi DOUBLE, n_modis INT, n_viirs INT, kind VARCHAR('aqua_to_snpp'/'terra_to_aqua'/'n20_to_snpp')` |
| `hotspots/year=YYYY/part.parquet` | one filtered detection of a reference sensor | `lat DOUBLE, lon DOUBLE, date DATE, time VARCHAR(HHMM), sensor VARCHAR, confidence VARCHAR, frp DOUBLE, pass VARCHAR, h3_7 UBIGINT` |
| `meta.json` | n/a | coverage per sensor, build time, method version |

`sensor` is one of `modis_terra`, `modis_aqua`, `viirs_snpp`, `viirs_noaa20`.
`block_id` is `"{floor(lat/2)*2}_{floor(lon/2)*2}"`.

## API
Base URL: `VITE_API_URL` (local default `http://localhost:8000`). All routes are under `/api`. CORS is controlled by the `ALLOWED_ORIGINS` env var (default `*`).

Every analysis call is a **POST** with this body:
```json
{
  "geometry": { "type": "Polygon", "coordinates": [[[75.0,30.0],[76.5,30.0],[76.5,31.5],[75.0,31.5],[75.0,30.0]]] },
  "start": "2000-11-01",
  "end": "2026-11-15",
  "baseline": "all"
}
```
- `geometry` is a GeoJSON Polygon or MultiPolygon in WGS84. A lat/lon + radius search is turned into a polygon on the frontend (turf `circle`).
- `baseline` is `"all"` (every other year) or `"2003-2022"`.
- An area larger than 400,000 km² returns **413** with `{"detail": "..."}`.
- If the polygon fills more than 50,000 r7 cells, the server uses r5 cells and sets `aoi.resolution = 5`.

### `POST /api/calendar`
```json
{
  "aoi": { "area_km2": 25000.0, "cells": 4810, "resolution": 7 },
  "unit": "fire cell-days (S-NPP VIIRS equivalent)",
  "years": [2000, 2001, "...", 2026],
  "cells": [
    {
      "year": 2016, "month": 11, "value": 812.0,
      "raw": { "modis_terra": 120, "modis_aqua": 310, "viirs_snpp": 812, "viirs_noaa20": 640 },
      "source": "viirs_snpp",
      "k": null, "k_lo": null, "k_hi": null,
      "provisional": false,
      "anomaly": { "pct_of_median": 143.2, "robust_z": 1.1, "percentile": 92.0, "label": "unusually high" }
    }
  ],
  "climatology": [
    { "month": 1, "median": 12.0, "q25": 6.0, "q75": 20.0, "p10": 3.0, "p90": 31.0, "min": 0.0, "max": 44.0, "mean": 14.1 }
  ],
  "annual": [ { "year": 2016, "harmonized": 5120.0, "raw_modis": 1830, "raw_viirs": 5120 } ]
}
```
- `source` is one of `modis_terra_scaled`, `modis_aqua_scaled`, `viirs_snpp`, `viirs_noaa20_scaled`.
- `k` is filled in only for scaled sources.
- `anomaly.label` is `"unusually high"`, `"unusually low"`, `"normal"`, or `null` when the median is under 5.
- Months with no data at all (before Nov 2000, or in the future) are left out.

### `POST /api/summary`
```json
{
  "peak_month": 4,
  "busiest_year": { "year": 2016, "value": 5120.0 },
  "current_month": { "year": 2026, "month": 11, "value": 210.0, "median": 180.0, "pct_of_median": 116.7, "percentile": 70.0, "label": "normal", "provisional": true },
  "season": { "start_month": 3, "end_month": 5, "length_months": 3 },
  "total_cell_days": 60123.0
}
```
The fire season is the shortest run of consecutive months (wrapping around the year end is allowed) that holds at least 80% of the climatological median total.

### `POST /api/timeseries`
```json
{
  "weekly": [ { "week_start": "2024-03-04", "value": 41.0 } ],
  "ytd": [ { "year": 2024, "doy": 64, "cum": 910.0 } ]
}
```

### `POST /api/hotspots.csv`
Returns `text/csv` with `Content-Disposition: attachment; filename="hotspots_<start>_<end>.csv"`.
Columns: `latitude,longitude,acq_date,acq_time,sensor,confidence,frp,daynight,harmonization_k`.
Capped at 200,000 rows; the response header `X-Truncated: true` is set when the cap is hit.

### `GET /api/meta`
Shape (matches `frontend/src/types.ts` `MetaResponse`): `{ coverage: { <sensor>: { start, end } }, build_time, method_version, national_factors: [{ kind, block_id, month, pass, k, k_lo, k_hi, n_modis, n_viirs }], region, unit, month_source, products }`.
This is `meta.json`, plus the national calibration factors for the methods panel.

### `GET /api/health`
Returns `{"ok": true}` and is used by the keep-warm ping.

## Mock fixtures
`frontend/src/mocks/*.json` must exactly match the shapes above. The frontend uses them when `VITE_USE_MOCKS=true`.

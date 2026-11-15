"""STUB API: returns the frontend's contract-shaped mock JSON. Real implementation follows."""
import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

ROOT = Path(__file__).resolve().parents[2]
MOCKS = ROOT / "frontend" / "src" / "mocks"
app = FastAPI(title="Fire Activity Calendar API (stub)")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Truncated", "Content-Disposition"])


def mock(name):
    return json.loads((MOCKS / f"{name}.json").read_text())


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return mock("meta")


@app.post("/api/calendar")
def calendar(body: dict):
    return mock("calendar")


@app.post("/api/summary")
def summary(body: dict):
    return mock("summary")


@app.post("/api/timeseries")
def timeseries(body: dict):
    return mock("timeseries")


@app.post("/api/hotspots.csv")
def hotspots(body: dict):
    csv = "latitude,longitude,acq_date,acq_time,sensor,confidence,frp,daynight,harmonization_k\n30.9,75.8,2016-11-02,0812,viirs_snpp,nominal,5.1,D,\n"
    return Response(csv, media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="hotspots_stub.csv"', "X-Truncated": "false"})

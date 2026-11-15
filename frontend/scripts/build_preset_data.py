"""Pre-computes the API answers for each preset area, so presets open instantly on the live site.

    node --experimental-strip-types frontend/scripts/export-presets.mjs > presets.json
    .venv/Scripts/python.exe frontend/scripts/build_preset_data.py presets.json

Writes frontend/public/preset-data/<id>.json. Re-run after the data in data/serve changes.
The app only uses a file when the request matches it (same area, start, baseline and an end
date on or after the file's end), otherwise it calls the API as usual.
"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402

client = TestClient(app)
out_dir = ROOT / "frontend" / "public" / "preset-data"
out_dir.mkdir(parents=True, exist_ok=True)
end = date.today().isoformat()
for p in json.loads(Path(sys.argv[1]).read_text()):
    body = {"geometry": p["geometry"], "start": "2000-11-01", "end": end, "baseline": "all"}
    data = {"request": body}
    for route in ("calendar", "summary", "timeseries"):
        r = client.post(f"/api/{route}", json=body)
        r.raise_for_status()
        data[route] = r.json()
    path = out_dir / f"{p['id']}.json"
    path.write_text(json.dumps(data, separators=(",", ":")))
    print(f"{path.name}: {path.stat().st_size / 1024:.0f} KB")

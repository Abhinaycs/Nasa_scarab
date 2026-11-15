import { useEffect, useState } from 'react'
import { getCalendar, getMeta, USE_MOCKS } from './api'
import type { AnalysisRequest, CalendarResponse } from './types'

// Placeholder AOI (central Punjab) until /a2 adds drawing and presets.
const DEFAULT_REQUEST: AnalysisRequest = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[75.0, 30.0], [76.5, 30.0], [76.5, 31.5], [75.0, 31.5], [75.0, 30.0]]],
  },
  start: '2000-11-01',
  end: new Date().toISOString().slice(0, 10),
  baseline: 'all',
}

export default function App() {
  const [request] = useState<AnalysisRequest>(DEFAULT_REQUEST)
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [build, setBuild] = useState<string | null>(null)

  useEffect(() => {
    const ctl = new AbortController()
    setError(null)
    getCalendar(request, ctl.signal)
      .then(setCalendar)
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
    getMeta(ctl.signal)
      .then((m) => setBuild(`${m.method_version} · built ${m.build_time.slice(0, 10)}`))
      .catch(() => {})
    return () => ctl.abort()
  }, [request])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Fire Activity Calendar · India</h1>
          <div className="sub">Harmonized MODIS + VIIRS fire cell-days, 2000 to present</div>
        </div>
        {USE_MOCKS && <span className="badge" title="VITE_USE_MOCKS=true">mock data</span>}
      </header>

      <div className="body">
        <aside className="panel" aria-label="Area and dates">
          <section>
            <h2>Area of interest</h2>
            <div className="placeholder">Draw, presets and lat/lon + radius come in /a2</div>
          </section>
          <section>
            <h2>Dates &amp; baseline</h2>
            <div className="placeholder">
              {request.start} → {request.end}
              <br />
              baseline: {request.baseline}
            </div>
          </section>
        </aside>

        <main className="main">
          <div className="card map-wrap">
            <div className="placeholder">Map (MapLibre) comes in /a2</div>
          </div>

          <div className="charts">
            {error && <div className="msg error">{error}</div>}
            <div className="card">
              <h3>Burning calendar</h3>
              <div className="placeholder">
                {calendar
                  ? `${calendar.cells.length} months loaded · ${calendar.years[0]}–${calendar.years.at(-1)} · ${calendar.aoi.area_km2.toLocaleString()} km² · ${calendar.unit}`
                  : error
                    ? 'No data'
                    : 'Loading…'}
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="footer">
        <span>Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m)</span>
        <span>{build ?? ''}</span>
      </footer>
    </div>
  )
}

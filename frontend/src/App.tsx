import { useEffect, useMemo, useRef, useState } from 'react'
import area from '@turf/area'
import { getCalendar, getMeta, getSummary, getTimeseries, USE_MOCKS } from './api'
import type {
  AnalysisRequest,
  Baseline,
  CalendarResponse,
  PolygonGeometry,
  SummaryResponse,
  TimeseriesResponse,
} from './types'
import MapView, { type DrawMode, type MapHandle } from './components/MapView'
import AoiPanel from './components/AoiPanel'

export type Status = 'idle' | 'loading' | 'error' | 'ready'

export interface Results {
  calendar: CalendarResponse
  summary: SummaryResponse
  timeseries: TimeseriesResponse
  request: AnalysisRequest
  label: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function App() {
  const mapRef = useRef<MapHandle>(null)
  const [aoi, setAoi] = useState<PolygonGeometry | null>(null)
  const [aoiLabel, setAoiLabel] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawMode | null>(null)
  const [start, setStart] = useState('2000-11-01')
  const [end, setEnd] = useState(today())
  const [baseline, setBaseline] = useState<Baseline>('all')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [fitKey, setFitKey] = useState(0)
  const [build, setBuild] = useState<string | null>(null)
  const inflight = useRef<AbortController | null>(null)

  const areaKm2 = useMemo(
    () => (aoi ? area({ type: 'Feature', properties: {}, geometry: aoi }) / 1e6 : null),
    [aoi],
  )

  useEffect(() => {
    const ctl = new AbortController()
    getMeta(ctl.signal)
      .then((m) => setBuild(`${m.method_version} · built ${m.build_time.slice(0, 10)}`))
      .catch(() => {})
    return () => ctl.abort()
  }, [])

  const setAoiFrom = (g: PolygonGeometry | null, label: string | null, fit: boolean) => {
    setAoi(g)
    setAoiLabel(label)
    if (fit && g) setFitKey((k) => k + 1)
  }

  const analyze = async () => {
    if (!aoi) return
    inflight.current?.abort()
    const ctl = new AbortController()
    inflight.current = ctl
    const request: AnalysisRequest = { geometry: aoi, start, end, baseline }
    setStatus('loading')
    setError(null)
    setFitKey((k) => k + 1)
    try {
      const [calendar, summary, timeseries] = await Promise.all([
        getCalendar(request, ctl.signal),
        getSummary(request, ctl.signal),
        getTimeseries(request, ctl.signal),
      ])
      if (ctl.signal.aborted) return
      setResults({ calendar, summary, timeseries, request, label: aoiLabel ?? 'Drawn area' })
      setStatus('ready')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message || 'Request failed')
      setStatus('error')
    }
  }

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
          <AoiPanel
            aoi={aoi}
            aoiLabel={aoiLabel}
            areaKm2={areaKm2}
            drawing={drawing}
            start={start}
            end={end}
            baseline={baseline}
            loading={status === 'loading'}
            onStartDraw={(m) => mapRef.current?.startDraw(m)}
            onCancelDraw={() => mapRef.current?.cancelDraw()}
            onSetAoi={setAoiFrom}
            getMapCenter={() => mapRef.current?.getCenter() ?? { lat: 22.5, lon: 78.9 }}
            onStart={setStart}
            onEnd={setEnd}
            onBaseline={setBaseline}
            onAnalyze={analyze}
          />
        </aside>

        <main className="main">
          <div className="card map-wrap">
            <MapView
              ref={mapRef}
              aoi={aoi}
              fitKey={fitKey}
              onDrawn={(g) => setAoiFrom(g, 'Drawn area', false)}
              onDrawingChange={setDrawing}
            />
          </div>

          <div className="charts" aria-live="polite">
            {status === 'error' && <div className="msg error" role="alert">{error}</div>}
            {status === 'idle' && (
              <div className="placeholder">Pick an area on the left and press Analyze to see its burning calendar.</div>
            )}
            {status === 'loading' && <div className="placeholder">Loading calendar…</div>}
            {status === 'ready' && results && (
              <div className="card">
                <h3>{results.label}</h3>
                <div className="placeholder">
                  {results.calendar.cells.length} months · {results.calendar.years[0]}–{results.calendar.years.at(-1)} ·{' '}
                  {results.calendar.aoi.area_km2.toLocaleString()} km² · peak month {results.summary.peak_month} ·{' '}
                  {results.timeseries.weekly.length} weeks. Charts come in /a3.
                </div>
              </div>
            )}
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

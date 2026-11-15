import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import area from '@turf/area'
import { getCalendar, getMeta, getSummary, getTimeseries, onServerWaking, USE_MOCKS } from './api'
import type {
  AnalysisRequest,
  Baseline,
  CalendarResponse,
  MetaResponse,
  PolygonGeometry,
  SummaryResponse,
  TimeseriesResponse,
} from './types'
import MapView, { type DrawMode, type MapHandle } from './components/MapView'
import AoiPanel from './components/AoiPanel'
import ResultsView from './components/ResultsView'
import type { SelectedMonth } from './components/BurningCalendar'
import MethodsPanel from './components/MethodsPanel'

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
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [methodsOpen, setMethodsOpen] = useState(false)
  const [waking, setWaking] = useState(false)
  const [selected, setSelected] = useState<SelectedMonth | null>(null)
  const inflight = useRef<AbortController | null>(null)

  const areaKm2 = useMemo(
    () => (aoi ? area({ type: 'Feature', properties: {}, geometry: aoi }) / 1e6 : null),
    [aoi],
  )

  useEffect(() => {
    onServerWaking(setWaking)
    const ctl = new AbortController()
    getMeta(ctl.signal)
      .then(setMeta)
      .catch(() => {})
    return () => {
      ctl.abort()
      onServerWaking(null)
    }
  }, [])

  const closeMethods = useCallback(() => setMethodsOpen(false), [])

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
      setSelected(null)
      setStatus('ready')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message || 'Request failed')
      setWaking(false)
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
        <div className="header-actions">
          {USE_MOCKS && <span className="badge" title="VITE_USE_MOCKS=true">mock data</span>}
          <button type="button" className="btn" onClick={() => setMethodsOpen(true)} aria-haspopup="dialog">
            About the data
          </button>
        </div>
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

          <div className="charts">
            {status === 'error' && <div className="msg error" role="alert">{error}</div>}
            {status === 'idle' && (
              <div className="placeholder empty-state">
                <strong>Draw an area or pick a preset</strong>
                <span>then press Analyze to see its burning calendar from 2000 to today.</span>
              </div>
            )}
            {waking && (
              <div className="msg warn" role="status">
                Waking up the server… The free host sleeps when idle; this can take up to a minute.
              </div>
            )}
            {status === 'loading' && <Skeleton />}
            {results && status !== 'loading' && (
              <ResultsView
                label={results.label}
                request={results.request}
                calendar={results.calendar}
                summary={results.summary}
                timeseries={results.timeseries}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </div>
        </main>
      </div>

      <footer className="footer">
        <span>Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m)</span>
        <span>
          {meta?.method_version && <>method {meta.method_version}</>}
          {(meta?.build_time ?? meta?.built_utc) && <> · data built {(meta?.build_time ?? meta?.built_utc ?? '').slice(0, 10)}</>}
        </span>
      </footer>
      <MethodsPanel open={methodsOpen} onClose={closeMethods} meta={meta} />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="results" aria-busy="true" aria-label="Loading results">
      <div className="stats">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="stat skeleton" style={{ height: 78 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 420 }} />
      <div className="card skeleton" style={{ height: 260 }} />
    </div>
  )
}

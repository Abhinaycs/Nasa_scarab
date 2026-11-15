import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import area from '@turf/area'
import { getCalendar, getHotspots, getMeta, getPresetResults, getSummary, getTimeseries, onServerWaking, USE_MOCKS } from './api'
import { PRESETS } from './presets'
import type {
  AnalysisRequest,
  Baseline,
  CalendarResponse,
  MetaResponse,
  PolygonGeometry,
  SummaryResponse,
  TimeseriesResponse,
} from './types'
import MapView, { type DrawMode, type FiresGeoJSON, type MapHandle } from './components/MapView'
import { MONTHS_LONG, fmtInt } from './format'
import AoiPanel from './components/AoiPanel'
import ResultsView from './components/ResultsView'
import type { SelectedMonth } from './components/BurningCalendar'
import MethodsPanel from './components/MethodsPanel'
import ExplodedView from './components/ExplodedView'

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
  const [fires, setFires] = useState<{ month: SelectedMonth; data: FiresGeoJSON; truncated: boolean } | null>(null)
  const [firesLoading, setFiresLoading] = useState(false)
  const mapWrapRef = useRef<HTMLDivElement>(null)
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

  // Selected calendar month → load that month's detections and show them on the map.
  useEffect(() => {
    if (!selected || !results) {
      setFires(null)
      return
    }
    const ctl = new AbortController()
    const { year, month } = selected
    const pad = (n: number) => String(n).padStart(2, '0')
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    setFiresLoading(true)
    getHotspots(
      { ...results.request, start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` },
      ctl.signal,
    )
      .then(({ points, truncated }) => {
        setFires({
          month: selected,
          truncated,
          data: {
            type: 'FeatureCollection',
            features: points.map((p) => ({
              type: 'Feature',
              properties: { sensor: p.sensor, frp: p.frp, daynight: p.daynight, date: p.date },
              geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            })),
          },
        })
      })
      .catch((e: Error) => e.name !== 'AbortError' && setFires(null))
      .finally(() => !ctl.signal.aborted && setFiresLoading(false))
    return () => ctl.abort()
  }, [selected, results])

  const showMap = useCallback(() => mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), [])
  const firesSummary = fires
    ? (() => {
        const n = fires.data.features.length
        const viirs = fires.data.features.filter((f) => !f.properties.sensor.includes('modis')).length
        return { n, viirs, modis: n - viirs }
      })()
    : null

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
      // Presets come from a pre-computed file when it matches the request; everything else asks the API.
      const preset = PRESETS.find((p) => JSON.stringify(p.geometry) === JSON.stringify(aoi))
      const cached = preset ? await getPresetResults(preset.id, request, ctl.signal) : null
      const [calendar, summary, timeseries] = cached
        ? [cached.calendar, cached.summary, cached.timeseries]
        : await Promise.all([
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
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="1" y="1" width="4" height="4" rx="1" opacity=".55" />
              <rect x="7" y="1" width="4" height="4" rx="1" opacity=".8" />
              <rect x="13" y="1" width="4" height="4" rx="1" opacity=".4" />
              <rect x="1" y="7" width="4" height="4" rx="1" opacity=".4" />
              <rect x="7" y="7" width="4" height="4" rx="1" />
              <rect x="13" y="7" width="4" height="4" rx="1" opacity=".8" />
              <rect x="1" y="13" width="4" height="4" rx="1" opacity=".8" />
              <rect x="7" y="13" width="4" height="4" rx="1" opacity=".4" />
              <rect x="13" y="13" width="4" height="4" rx="1" opacity=".55" />
            </svg>
          </span>
          <div className="brand-text">
            <h1>
              Fire Activity Calendar <em>India</em>
            </h1>
            <div className="sub">Harmonized MODIS + VIIRS fire cell-days, 2000 to present</div>
          </div>
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
          <div className="card map-wrap" ref={mapWrapRef}>
            <MapView
              ref={mapRef}
              aoi={aoi}
              fitKey={fitKey}
              onDrawn={(g) => setAoiFrom(g, 'Drawn area', false)}
              onDrawingChange={setDrawing}
              fires={fires?.data ?? null}
            />
            {(firesLoading || fires) && selected && (
              <div className="map-overlay" role="status" aria-live="polite">
                {firesLoading ? (
                  <>Loading fires for {MONTHS_LONG[selected.month - 1]} {selected.year}…</>
                ) : fires && firesSummary ? (
                  <>
                    <strong>{MONTHS_LONG[fires.month.month - 1]} {fires.month.year}:</strong>{' '}
                    {fmtInt(firesSummary.n)} fire detections{fires.truncated && ' (first 200,000)'}
                    <span className="map-legend">
                      {firesSummary.modis > 0 && (
                        <span><i style={{ background: '#3b5bdb' }} /> MODIS {fmtInt(firesSummary.modis)}</span>
                      )}
                      {firesSummary.viirs > 0 && (
                        <span><i style={{ background: '#e8590c' }} /> VIIRS {fmtInt(firesSummary.viirs)}</span>
                      )}
                    </span>
                    <button type="button" className="link" onClick={() => setSelected(null)}>clear</button>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div className="charts">
            {status === 'error' && <div className="msg error" role="alert">{error}</div>}
            {status === 'idle' && (
              <HowItWorks />
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
                onShowMap={showMap}
                firesCount={fires && selected && fires.month === selected ? firesSummary?.n ?? null : null}
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

/** First-screen explainer: what the app does, in three steps. */
function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Pick an area',
      text: 'Draw on the map, enter a point and radius, or choose a preset such as Punjab.',
    },
    {
      n: '2',
      title: 'We harmonize 25 years',
      text: 'NASA MODIS (2000→) and VIIRS (2012→) fire detections are counted on one grid and calibrated into a single series.',
    },
    {
      n: '3',
      title: 'See what is unusual',
      text: 'A month-by-year burning calendar, anomalies against the usual, the fire season, and fires on the map.',
    },
  ]
  return (
    <section className="how" aria-labelledby="how-h">
      <div className="how-text">
        <div className="eyebrow">25 years · two satellite generations · one record</div>
        <h2 id="how-h">
          One consistent fire record <em>for any area in India.</em>
        </h2>
        <p className="how-sub">
          Satellites have tracked fires since 2000, but two generations of sensors count them differently. This app
          joins them into one burning calendar, so you can see when an area burns and whether this month is unusual.
        </p>
        <ol className="how-steps">
          {steps.map((st) => (
            <li key={st.n}>
              <span className="how-n" aria-hidden="true">{st.n}</span>
              <strong>{st.title}</strong>
              <span>{st.text}</span>
            </li>
          ))}
        </ol>
        <p className="how-cta">
          <strong>Try it:</strong> choose <em>Presets → Punjab</em> on the left and press <em>Analyze</em>.
        </p>
      </div>
      <figure className="how-figure">
        <ExplodedView />
        <figcaption>The method, taken apart: each layer is built from the one beneath it.</figcaption>
      </figure>
    </section>
  )
}


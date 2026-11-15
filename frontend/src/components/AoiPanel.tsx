import { useState } from 'react'
import circle from '@turf/circle'
import type { Baseline, PolygonGeometry, Position } from '../types'
import { PRESETS } from '../presets'
import type { DrawMode } from './MapView'

export const MAX_AREA_KM2 = 400_000

type Tab = 'draw' | 'circle' | 'presets'

interface Props {
  aoi: PolygonGeometry | null
  aoiLabel: string | null
  areaKm2: number | null
  drawing: DrawMode | null
  start: string
  end: string
  baseline: Baseline
  loading: boolean
  onStartDraw: (mode: DrawMode) => void
  onCancelDraw: () => void
  onSetAoi: (g: PolygonGeometry | null, label: string | null, fit: boolean) => void
  getMapCenter: () => { lat: number; lon: number }
  onStart: (v: string) => void
  onEnd: (v: string) => void
  onBaseline: (v: Baseline) => void
  onAnalyze: () => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'draw', label: 'Draw' },
  { id: 'circle', label: 'Lat/Lon + radius' },
  { id: 'presets', label: 'Presets' },
]

const MIN_DATE = '2000-11-01'
const today = () => new Date().toISOString().slice(0, 10)

export default function AoiPanel(p: Props) {
  const [tab, setTab] = useState<Tab>('presets')
  const [lat, setLat] = useState('30.9')
  const [lon, setLon] = useState('75.85')
  const [radius, setRadius] = useState('50')
  const [presetId, setPresetId] = useState<string | null>(null)

  const latN = Number(lat), lonN = Number(lon), radN = Number(radius)
  const circleError =
    lat === '' || !Number.isFinite(latN) || latN < 6 || latN > 37.5
      ? 'Latitude must be between 6 and 37.5 (India).'
      : lon === '' || !Number.isFinite(lonN) || lonN < 68 || lonN > 98
        ? 'Longitude must be between 68 and 98 (India).'
        : radius === '' || !Number.isFinite(radN) || radN < 1 || radN > 200
          ? 'Radius must be 1–200 km.'
          : null

  const applyCircle = () => {
    if (circleError) return
    const c = circle([lonN, latN], radN, { steps: 64, units: 'kilometers' })
    p.onSetAoi(
      { type: 'Polygon', coordinates: c.geometry.coordinates as Position[][] },
      `${radN} km around ${latN.toFixed(3)}, ${lonN.toFixed(3)}`,
      true,
    )
    setPresetId(null)
  }

  const useCenter = () => {
    const c = p.getMapCenter()
    setLat(c.lat.toFixed(4))
    setLon(c.lon.toFixed(4))
  }

  const tooBig = p.areaKm2 !== null && p.areaKm2 > MAX_AREA_KM2
  const dateError =
    !p.start || !p.end ? 'Pick both dates.' : p.start > p.end ? 'Start date must be before end date.' : null
  const canAnalyze = !!p.aoi && !tooBig && !dateError && !p.loading

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    setTab(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <>
      <section aria-labelledby="aoi-h">
        <h2 id="aoi-h">Area of interest</h2>
        <div className="tabs" role="tablist" aria-label="How to choose the area">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'draw' && (
          <div id="panel-draw" role="tabpanel" aria-labelledby="tab-draw" className="tabpanel">
            <div className="row">
              <button type="button" className={p.drawing === 'polygon' ? 'btn primary' : 'btn'} onClick={() => p.onStartDraw('polygon')}>
                Draw polygon
              </button>
              <button type="button" className={p.drawing === 'rectangle' ? 'btn primary' : 'btn'} onClick={() => p.onStartDraw('rectangle')}>
                Draw rectangle
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  p.onCancelDraw()
                  p.onSetAoi(null, null, false)
                  setPresetId(null)
                }}
              >
                Clear
              </button>
            </div>
            <p className="hint" aria-live="polite">
              {p.drawing === 'polygon'
                ? 'Click on the map to add points; click the first point to finish.'
                : p.drawing === 'rectangle'
                  ? 'Click one corner, then the opposite corner.'
                  : 'Choose a shape, then draw on the map.'}
            </p>
          </div>
        )}

        {tab === 'circle' && (
          <form
            id="panel-circle"
            role="tabpanel"
            aria-labelledby="tab-circle"
            className="tabpanel"
            onSubmit={(e) => {
              e.preventDefault()
              applyCircle()
            }}
          >
            <div className="grid2">
              <label>
                Latitude
                <input type="number" step="any" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
              </label>
              <label>
                Longitude
                <input type="number" step="any" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
              </label>
            </div>
            <label>
              Radius (km)
              <input type="number" min={1} max={200} step="any" value={radius} onChange={(e) => setRadius(e.target.value)} />
            </label>
            {circleError && <div className="msg warn" role="alert">{circleError}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={useCenter}>Use map centre</button>
              <button type="submit" className="btn primary" disabled={!!circleError}>Set area</button>
            </div>
          </form>
        )}

        {tab === 'presets' && (
          <div id="panel-presets" role="tabpanel" aria-labelledby="tab-presets" className="tabpanel">
            <ul className="presets">
              {PRESETS.map((pr) => (
                <li key={pr.id}>
                  <button
                    type="button"
                    className={presetId === pr.id ? 'preset active' : 'preset'}
                    aria-pressed={presetId === pr.id}
                    onClick={() => {
                      setPresetId(pr.id)
                      p.onSetAoi(pr.geometry, pr.name, true)
                    }}
                  >
                    <strong>{pr.name}</strong>
                    <span>{pr.note}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">Simplified outlines, not official boundaries.</p>
          </div>
        )}

        <div className="aoi-status" aria-live="polite">
          {p.aoi ? (
            <>
              <strong>{p.aoiLabel ?? 'Drawn area'}</strong>
              <span>{p.areaKm2 !== null ? `${Math.round(p.areaKm2).toLocaleString()} km²` : ''}</span>
            </>
          ) : (
            <span className="hint">No area selected yet.</span>
          )}
        </div>
        {tooBig && (
          <div className="msg warn" role="alert">
            This area is larger than {MAX_AREA_KM2.toLocaleString()} km². Choose a smaller area to analyse.
          </div>
        )}
      </section>

      <section aria-labelledby="dates-h">
        <h2 id="dates-h">Dates &amp; baseline</h2>
        <div className="grid2">
          <label>
            From
            <input type="date" min={MIN_DATE} max={today()} value={p.start} onChange={(e) => p.onStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" min={MIN_DATE} max={today()} value={p.end} onChange={(e) => p.onEnd(e.target.value)} />
          </label>
        </div>
        <label>
          Baseline for anomalies
          <select value={p.baseline} onChange={(e) => p.onBaseline(e.target.value as Baseline)}>
            <option value="all">All other years</option>
            <option value="2003-2022">2003–2022</option>
          </select>
        </label>
        {dateError && <div className="msg warn" role="alert">{dateError}</div>}
        <button type="button" className="btn primary analyze" disabled={!canAnalyze} onClick={p.onAnalyze}>
          {p.loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {!p.aoi && <p className="hint">Select an area to enable Analyze.</p>}
      </section>
    </>
  )
}

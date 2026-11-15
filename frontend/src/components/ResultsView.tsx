import { useState } from 'react'
import type { AnalysisRequest, CalendarResponse, SummaryResponse, TimeseriesResponse } from '../types'
import BurningCalendar, { type CalendarMode, type SelectedMonth } from './BurningCalendar'
import AnomalyCalendar from './AnomalyCalendar'
import Climatology from './Climatology'
import YtdChart from './YtdChart'
import AnnualChart, { type AnnualMode } from './AnnualChart'
import SummaryCards from './SummaryCards'
import ChartCard from './ChartCard'
import { fmtInt, MONTHS_LONG } from '../format'
import { downloadHotspotsCsv } from '../api'
import { downloadCalendarCsv, slug } from '../exports'

interface Props {
  label: string
  request: AnalysisRequest
  calendar: CalendarResponse
  summary: SummaryResponse
  timeseries: TimeseriesResponse
  selected: SelectedMonth | null
  onSelect: (s: SelectedMonth | null) => void
}

function Seg<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg no-export" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'seg-btn active' : 'seg-btn'}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ResultsView({ label, request, calendar, summary, timeseries, selected, onSelect }: Props) {
  const [mode, setMode] = useState<CalendarMode>('counts')
  const [annualMode, setAnnualMode] = useState<AnnualMode>('raw')
  const [csvState, setCsvState] = useState<{ busy: boolean; msg: string | null; error: boolean }>({ busy: false, msg: null, error: false })
  const sel = selected && calendar.cells.find((c) => c.year === selected.year && c.month === selected.month)
  const file = `${slug(label)}_${request.start}_${request.end}`
  const empty = calendar.cells.length === 0 || calendar.cells.every((c) => c.value === 0)

  const hotspots = async () => {
    setCsvState({ busy: true, msg: null, error: false })
    try {
      const { truncated } = await downloadHotspotsCsv(request)
      setCsvState({
        busy: false,
        error: false,
        msg: truncated ? 'The file was capped at 200,000 rows. Pick a smaller area or shorter period for the full list.' : null,
      })
    } catch (e) {
      setCsvState({ busy: false, error: true, msg: (e as Error).message || 'Download failed' })
    }
  }

  return (
    <div className="results">
      <div className="results-head">
        <div>
          <h2>{label}</h2>
          <span className="hint">
            {request.start} to {request.end} · {fmtInt(calendar.aoi.area_km2)} km² · {fmtInt(calendar.aoi.cells)} H3 r
            {calendar.aoi.resolution} cells · {calendar.unit}
          </span>
        </div>
        <div className="downloads" role="group" aria-label="Downloads">
          <button type="button" className="btn" onClick={hotspots} disabled={csvState.busy}>
            {csvState.busy ? 'Preparing…' : '⬇ Hotspots CSV'}
          </button>
          <button type="button" className="btn" onClick={() => downloadCalendarCsv(calendar, label, request.start, request.end)}>
            ⬇ Calendar CSV
          </button>
        </div>
      </div>
      {csvState.msg && <div className={csvState.error ? 'msg error' : 'msg warn'} role="alert">{csvState.msg}</div>}

      {empty ? (
        <div className="placeholder empty-state">
          <strong>No fires detected in this area and period.</strong>
          <span>Try a larger area, a longer date range, or one of the presets.</span>
        </div>
      ) : (
        <>
          <SummaryCards s={summary} unit={calendar.unit} />

          <ChartCard
            title="Burning calendar"
            file={`calendar-${mode}_${file}`}
            actions={
              <Seg
                label="Calendar view"
                value={mode}
                onChange={setMode}
                options={[{ id: 'counts', label: 'Counts' }, { id: 'anomalies', label: 'Anomalies' }]}
              />
            }
          >
            {/* Always rendered so selecting a month doesn't shift the calendar under the pointer */}
            <div className={sel ? 'selected' : 'selected empty'} aria-live="polite">
              {sel ? (
                <>
                  Selected: <strong>{MONTHS_LONG[sel.month - 1]} {sel.year}</strong> · {fmtInt(sel.value)} cell-days
                  {sel.anomaly.pct_of_median !== null && <> · {Math.round(sel.anomaly.pct_of_median)}% of median</>}
                  {sel.anomaly.label && sel.anomaly.label !== 'normal' && <> · {sel.anomaly.label}</>}
                  <button type="button" className="link no-export" onClick={() => onSelect(null)}>clear</button>
                </>
              ) : (
                'Click a month to select it.'
              )}
            </div>
            {mode === 'counts' ? (
              <BurningCalendar data={calendar} mode="counts" selected={selected} onSelect={onSelect} />
            ) : (
              <AnomalyCalendar data={calendar} selected={selected} onSelect={onSelect} />
            )}
          </ChartCard>

          <ChartCard
            title="Fire activity by year"
            file={`annual-${annualMode}_${file}`}
            actions={
              <Seg
                label="Raw or harmonized"
                value={annualMode}
                onChange={setAnnualMode}
                options={[{ id: 'raw', label: 'Raw sensors' }, { id: 'harmonized', label: 'Harmonized' }]}
              />
            }
          >
            <AnnualChart data={calendar} mode={annualMode} />
          </ChartCard>

          <div className="chart-grid">
            <ChartCard title="Typical year" file={`climatology_${file}`}>
              <Climatology data={calendar} />
            </ChartCard>
            <ChartCard title="Year to date" file={`ytd_${file}`}>
              <YtdChart data={timeseries} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import type { CalendarResponse, SummaryResponse, TimeseriesResponse } from '../types'
import BurningCalendar, { type CalendarMode, type SelectedMonth } from './BurningCalendar'
import AnomalyCalendar from './AnomalyCalendar'
import Climatology from './Climatology'
import YtdChart from './YtdChart'
import AnnualChart from './AnnualChart'
import SummaryCards from './SummaryCards'
import { fmtInt, MONTHS_LONG } from '../format'

interface Props {
  label: string
  calendar: CalendarResponse
  summary: SummaryResponse
  timeseries: TimeseriesResponse
  selected: SelectedMonth | null
  onSelect: (s: SelectedMonth | null) => void
}

export default function ResultsView({ label, calendar, summary, timeseries, selected, onSelect }: Props) {
  const [mode, setMode] = useState<CalendarMode>('counts')
  const sel = selected && calendar.cells.find((c) => c.year === selected.year && c.month === selected.month)

  return (
    <div className="results">
      <div className="results-head">
        <h2>{label}</h2>
        <span className="hint">
          {fmtInt(calendar.aoi.area_km2)} km² · {fmtInt(calendar.aoi.cells)} H3 r{calendar.aoi.resolution} cells ·{' '}
          {calendar.unit}
        </span>
      </div>

      <SummaryCards s={summary} unit={calendar.unit} />

      <section className="card">
        <div className="card-head">
          <h3>Burning calendar</h3>
          <div className="seg" role="tablist" aria-label="Calendar view">
            {(['counts', 'anomalies'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'seg-btn active' : 'seg-btn'}
                onClick={() => setMode(m)}
              >
                {m === 'counts' ? 'Counts' : 'Anomalies'}
              </button>
            ))}
          </div>
        </div>
        {/* Always rendered so selecting a month doesn't shift the calendar under the pointer */}
        <div className={sel ? 'selected' : 'selected empty'} aria-live="polite">
          {sel ? (
            <>
              Selected: <strong>{MONTHS_LONG[sel.month - 1]} {sel.year}</strong> · {fmtInt(sel.value)} cell-days
              {sel.anomaly.pct_of_median !== null && <> · {Math.round(sel.anomaly.pct_of_median)}% of median</>}
              {sel.anomaly.label && sel.anomaly.label !== 'normal' && <> · {sel.anomaly.label}</>}
              <button type="button" className="link" onClick={() => onSelect(null)}>clear</button>
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
      </section>

      <div className="chart-grid">
        <section className="card">
          <h3>Typical year</h3>
          <Climatology data={calendar} />
        </section>
        <section className="card">
          <h3>Year to date</h3>
          <YtdChart data={timeseries} />
        </section>
      </div>

      <section className="card">
        <h3>Fire activity by year</h3>
        <AnnualChart data={calendar} />
      </section>
    </div>
  )
}

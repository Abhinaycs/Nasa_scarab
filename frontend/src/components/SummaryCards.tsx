import type { SummaryResponse } from '../types'
import { fmtInt, fmtPct, monthRange, MONTHS, MONTHS_LONG } from '../format'

export default function SummaryCards({ s, unit }: { s: SummaryResponse; unit: string }) {
  const cm = s.current_month
  const tone = cm.label === 'unusually high' ? 'high' : cm.label === 'unusually low' ? 'low' : ''
  return (
    <div className="stats" role="list">
      <div className="stat" role="listitem">
        <div className="stat-label">Peak month</div>
        <div className="stat-value">{MONTHS_LONG[s.peak_month - 1]}</div>
        <div className="stat-sub">highest median</div>
      </div>
      <div className="stat" role="listitem">
        <div className="stat-label">Fire season</div>
        <div className="stat-value">{monthRange(s.season.start_month, s.season.end_month)}</div>
        <div className="stat-sub">
          {s.season.length_months} month{s.season.length_months === 1 ? '' : 's'} hold 80% of burning
        </div>
      </div>
      <div className={`stat ${tone}`} role="listitem">
        <div className="stat-label">
          {MONTHS[cm.month - 1]} {cm.year} vs median
          {cm.provisional && <span className="badge small">provisional</span>}
        </div>
        <div className="stat-value">{fmtPct(cm.pct_of_median)}</div>
        <div className="stat-sub">
          {fmtInt(cm.value)} vs {fmtInt(cm.median)} · {cm.label ?? 'too little to rate'}
        </div>
      </div>
      <div className="stat" role="listitem">
        <div className="stat-label">Busiest year</div>
        <div className="stat-value">{s.busiest_year.year}</div>
        <div className="stat-sub">{fmtInt(s.busiest_year.value)} cell-days</div>
      </div>
      <div className="stat" role="listitem">
        <div className="stat-label">Total</div>
        <div className="stat-value">{fmtInt(s.total_cell_days)}</div>
        <div className="stat-sub">{unit}</div>
      </div>
    </div>
  )
}

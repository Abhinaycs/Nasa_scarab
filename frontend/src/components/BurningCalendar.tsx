import { useCallback } from 'react'
import * as Plot from '@observablehq/plot'
import type { CalendarCell, CalendarResponse } from '../types'
import { contrastText, fmtCell, fmtInt, fmtPct, MONTHS, MONTHS_LONG, SOURCE_LABEL } from '../format'
import PlotFigure from './PlotFigure'
import DataTable from './DataTable'

export interface SelectedMonth {
  year: number
  month: number
}

export type CalendarMode = 'counts' | 'anomalies'

interface Props {
  data: CalendarResponse
  mode: CalendarMode
  selected: SelectedMonth | null
  onSelect: (s: SelectedMonth | null) => void
}

const ROW_H = 22
const MIN_W = 620
const SELECT_COLOR = '#e8590c'

interface Row {
  y: string
  month: number
  value: number
  cell?: CalendarCell
}

// Percent of median minus 100, clamped to ±100 (it cannot go below -100).
const anomalyValue = (c: CalendarCell) =>
  c.anomaly.pct_of_median === null ? null : Math.max(-100, Math.min(100, c.anomaly.pct_of_median - 100))

function tooltip(c: CalendarCell, unit: string): string {
  const raw = Object.entries(c.raw)
    .map(([k, v]) => `${k.replace('_', ' ')} ${fmtInt(v as number)}`)
    .join(', ')
  const lines = [
    `${MONTHS_LONG[c.month - 1]} ${c.year}${c.provisional ? ' (provisional)' : ''}`,
    `${fmtInt(c.value)} ${unit}`,
    `Source: ${SOURCE_LABEL[c.source]}`,
  ]
  if (c.k !== null) lines.push(`k = ${c.k.toFixed(2)} (90% ${c.k_lo?.toFixed(2)}–${c.k_hi?.toFixed(2)})`)
  if (raw) lines.push(`Raw: ${raw}`)
  lines.push(
    c.anomaly.label === null
      ? 'Anomaly: not rated (median under 5)'
      : `${fmtPct(c.anomaly.pct_of_median)} of median · ${Math.round(c.anomaly.percentile ?? 0)}th percentile · ${c.anomaly.label}`,
  )
  return lines.join('\n')
}

export default function BurningCalendar({ data, mode, selected, onSelect }: Props) {
  const render = useCallback(
    (width: number) => {
      const unit = 'fire cell-days'
      const years = [...data.years].map(String)
      const rows: Row[] = data.cells.map((c) => ({ y: String(c.year), month: c.month, value: c.value, cell: c }))
      const footer: Row[] = data.climatology.flatMap((m) => [
        { y: 'Median', month: m.month, value: m.median },
        { y: 'p90', month: m.month, value: m.p90 },
      ])
      const yDomain = [...years, ' ', 'Median', 'p90']
      const maxV = Math.max(1, ...rows.map((r) => r.value))

      const countColor: Plot.ScaleOptions = { type: 'symlog', scheme: 'cividis', domain: [0, maxV] }
      const anomColor: Plot.ScaleOptions = { type: 'diverging', scheme: 'PuOr', domain: [-100, 100], pivot: 0, clamp: true }
      const colorOpts = mode === 'counts' ? countColor : anomColor
      const scale = Plot.scale({ color: colorOpts })
      const fillOf = (r: Row): string | null => {
        if (mode === 'counts') return scale.apply(r.value) as string
        if (!r.cell) return FOOTER_FILL
        const a = anomalyValue(r.cell)
        return r.cell.anomaly.label === null || a === null ? null : (scale.apply(a) as string)
      }
      const NULL_FILL = '#c9ced6'
      const FOOTER_FILL = '#e9ecef'
      const textOf = (r: Row) => contrastText(fillOf(r) ?? NULL_FILL)
      const labelOf = (r: Row) => {
        if (mode === 'counts' || !r.cell) return fmtCell(r.value)
        const l = r.cell.anomaly.label
        const pct = r.cell.anomaly.pct_of_median
        if (l === null || pct === null) return '·'
        const arrow = l === 'unusually high' ? '▲' : l === 'unusually low' ? '▼' : ''
        return `${arrow}${Math.round(pct)}`
      }

      const all = [...rows, ...footer]
      const plot = Plot.plot({
        width,
        height: yDomain.length * ROW_H + 50,
        marginLeft: 52,
        marginTop: 28,
        padding: 0.06,
        style: { fontSize: '11px', background: 'transparent', color: 'var(--text)' },
        x: { type: 'band', domain: MONTHS.map((_, i) => i + 1), tickFormat: (m: number) => MONTHS[m - 1], axis: 'top', label: null },
        y: { type: 'band', domain: yDomain, label: null, tickSize: 0 },
        color: { ...colorOpts, legend: false },
        marks: [
          Plot.cell(all, {
            x: 'month',
            y: 'y',
            fill: (r: Row) => fillOf(r) ?? NULL_FILL,
            inset: 0.5,
            rx: 2,
            title: (r: Row) =>
              r.cell
                ? tooltip(r.cell, unit)
                : `${r.y} for ${MONTHS_LONG[r.month - 1]}: ${fmtInt(r.value)} ${unit}`,
            tip: { fontSize: 12 },
          }),
          Plot.text(all, {
            x: 'month',
            y: 'y',
            text: labelOf,
            fill: textOf,
          }),
          // Scaled-MODIS marker (pre-2012) in the top-left corner of the cell
          Plot.text(
            rows.filter((r) => r.cell && r.cell.source.startsWith('modis')),
            { x: 'month', y: 'y', text: () => 'M', fontSize: 7, dx: -17, dy: -6, fill: textOf, fillOpacity: 0.75 },
          ),
          // Provisional months: dashed outline
          Plot.cell(rows.filter((r) => r.cell?.provisional), {
            x: 'month', y: 'y', fill: null, stroke: 'currentColor', strokeDasharray: '3,2', strokeWidth: 1.2, inset: 1.5,
          }),
          // Selected month
          Plot.cell(
            rows.filter((r) => selected && r.cell && r.cell.year === selected.year && r.cell.month === selected.month),
            { x: 'month', y: 'y', fill: null, stroke: SELECT_COLOR, strokeWidth: 2.5, inset: 0 },
          ),
        ],
      })

      plot.addEventListener('click', () => {
        const v = (plot as unknown as { value: Row | null }).value
        if (v?.cell) onSelect({ year: v.cell.year, month: v.cell.month })
      })
      return plot
    },
    [data, mode, selected, onSelect],
  )

  const label =
    mode === 'counts'
      ? `Burning calendar: fire cell-days for each month from ${data.years[0]} to ${data.years.at(-1)}, years down, months across.`
      : `Anomaly calendar: each month as a percent of its median across other years.`

  return (
    <figure className="figure">
      {mode === 'counts' ? <CountLegend max={Math.max(1, ...data.cells.map((c) => c.value))} /> : <AnomalyLegend />}
      <PlotFigure render={render} minWidth={MIN_W} label={label} />
      <figcaption>
        {mode === 'counts'
          ? 'Each square is one month. Darker blue means few fire cell-days, brighter yellow means many. "M" marks months before 2012, which are MODIS counts scaled to VIIRS. Dashed outlines are provisional (near-real-time) months. The last two rows are the typical (median) and a high (90th percentile) month.'
          : 'Numbers are percent of the usual (median) amount for that month. Orange is more fire than usual, purple less. ▲ marks the top 10% of years, ▼ the bottom 10%. Grey months burn too little to rate.'}{' '}
        Click a month to select it.
      </figcaption>
      <DataTable
        summary="Show table"
        columns={['Year', ...MONTHS]}
        rows={[
          ...data.years.map((y) => [
            String(y),
            ...MONTHS.map((_, i) => {
              const c = data.cells.find((x) => x.year === y && x.month === i + 1)
              if (!c) return ''
              return mode === 'counts'
                ? fmtInt(c.value) + (c.provisional ? '*' : '')
                : c.anomaly.label === null
                  ? '–'
                  : `${fmtPct(c.anomaly.pct_of_median)}${c.anomaly.label !== 'normal' ? ` (${c.anomaly.label})` : ''}`
            }),
          ]),
          ['Median', ...data.climatology.map((m) => fmtInt(m.median))],
          ['p90', ...data.climatology.map((m) => fmtInt(m.p90))],
        ]}
      />
    </figure>
  )
}

function CountLegend({ max }: { max: number }) {
  const scale = Plot.scale({ color: { type: 'symlog', scheme: 'cividis', domain: [0, max] } })
  const stops = Array.from({ length: 9 }, (_, i) => scale.apply(Math.sinh((i / 8) * Math.asinh(max))) as string)
  return (
    <div className="legend">
      <span>0</span>
      <span className="ramp" style={{ background: `linear-gradient(to right, ${stops.join(',')})` }} />
      <span>{fmtInt(max)} cell-days</span>
    </div>
  )
}

function AnomalyLegend() {
  const scale = Plot.scale({ color: { type: 'diverging', scheme: 'PuOr', domain: [-100, 100], pivot: 0 } })
  const stops = Array.from({ length: 9 }, (_, i) => scale.apply(-100 + i * 25) as string)
  return (
    <div className="legend">
      <span>less than usual</span>
      <span className="ramp" style={{ background: `linear-gradient(to right, ${stops.join(',')})` }} />
      <span>more than usual</span>
    </div>
  )
}

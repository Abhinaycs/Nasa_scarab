import { useCallback, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import type { CalendarResponse } from '../types'
import { fmtInt, MONTHS } from '../format'
import PlotFigure from './PlotFigure'
import DataTable from './DataTable'

const BAND = '#8a94a3'
const CURRENT = '#e8590c'

export default function Climatology({ data }: { data: CalendarResponse }) {
  const year = useMemo(() => Math.max(...data.cells.map((c) => c.year)), [data])
  const current = useMemo(() => data.cells.filter((c) => c.year === year), [data, year])

  const render = useCallback(
    (width: number) =>
      Plot.plot({
        width,
        height: 260,
        marginLeft: 48,
        style: { background: 'transparent', color: 'var(--text)', fontSize: '11px' },
        x: { domain: [1, 12], ticks: 12, tickFormat: (m: number) => MONTHS[m - 1], label: null },
        y: { grid: true, label: 'fire cell-days', nice: true, zero: true },
        marks: [
          Plot.areaY(data.climatology, { x: 'month', y1: 'q25', y2: 'q75', fill: BAND, fillOpacity: 0.25, curve: 'monotone-x' }),
          Plot.lineY(data.climatology, { x: 'month', y: 'median', stroke: BAND, strokeWidth: 2, curve: 'monotone-x' }),
          Plot.lineY(current, { x: 'month', y: 'value', stroke: CURRENT, strokeWidth: 2.5 }),
          Plot.dot(current, {
            x: 'month', y: 'value', fill: CURRENT, r: 3.5,
            stroke: (c) => (c.provisional ? 'currentColor' : 'none'),
            title: (c) => `${MONTHS[c.month - 1]} ${c.year}: ${fmtInt(c.value)}${c.provisional ? ' (provisional)' : ''}`,
            tip: true,
          }),
          Plot.text(current.slice(-1), { x: 'month', y: 'value', text: () => String(year), dx: 8, textAnchor: 'start', fill: CURRENT, fontWeight: 600 }),
          Plot.ruleY([0]),
        ],
      }),
    [data, current, year],
  )

  return (
    <figure className="figure">
      <div className="legend">
        <span className="swatch" style={{ background: BAND, opacity: 0.6 }} /> median and middle half of years
        <span className="swatch line" style={{ background: CURRENT }} /> {year}
      </div>
      <PlotFigure render={render} label={`Monthly climatology with ${year} overlaid`} />
      <figcaption>
        The grey line is a typical year: the median for each month. The band covers the middle half of all years. The
        orange line is {year} so far.
      </figcaption>
      <DataTable
        summary="Show table"
        columns={['Month', 'Median', 'Q25', 'Q75', 'p90', String(year)]}
        rows={data.climatology.map((m) => [
          MONTHS[m.month - 1],
          fmtInt(m.median),
          fmtInt(m.q25),
          fmtInt(m.q75),
          fmtInt(m.p90),
          (() => {
            const c = current.find((x) => x.month === m.month)
            return c ? fmtInt(c.value) + (c.provisional ? '*' : '') : ''
          })(),
        ])}
      />
    </figure>
  )
}

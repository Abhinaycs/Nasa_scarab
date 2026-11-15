import { useCallback } from 'react'
import * as Plot from '@observablehq/plot'
import type { CalendarResponse } from '../types'
import { fmtInt } from '../format'
import PlotFigure from './PlotFigure'
import DataTable from './DataTable'

const BAR = '#c8501e'

export default function AnnualChart({ data }: { data: CalendarResponse }) {
  const current = Math.max(...data.annual.map((a) => a.year))
  const first = Math.min(...data.annual.map((a) => a.year))

  const render = useCallback(
    (width: number) => {
      const partial = (y: number) => y === current || y === first
      return Plot.plot({
        width,
        height: 240,
        marginLeft: 56,
        style: { background: 'transparent', color: 'var(--text)', fontSize: '11px' },
        x: { type: 'band', label: null, tickFormat: (y: number) => (y % 5 === 0 ? String(y) : ''), tickSize: 0 },
        y: { grid: true, label: 'fire cell-days per year' },
        marks: [
          Plot.barY(data.annual, {
            x: 'year',
            y: 'harmonized',
            fill: BAR,
            fillOpacity: (a) => (partial(a.year) ? 0.4 : 0.9),
            title: (a) => `${a.year}${partial(a.year) ? ' (part year)' : ''}: ${fmtInt(a.harmonized)}`,
            tip: true,
          }),
          Plot.ruleX([2012], { x: () => 2012, stroke: 'currentColor', strokeDasharray: '3,3', strokeOpacity: 0.5 }),
          Plot.ruleY([0]),
        ],
      })
    },
    [data, current, first],
  )

  return (
    <figure className="figure">
      <PlotFigure render={render} label="Harmonized annual fire cell-days by year" />
      <figcaption>
        Total harmonized fire cell-days per year. Faded bars are part years ({first} starts in November, {current} is
        still in progress). VIIRS starts in 2012; earlier years are MODIS scaled to match.
      </figcaption>
      <DataTable
        summary="Show table"
        columns={['Year', 'Harmonized', 'Raw MODIS', 'Raw VIIRS']}
        rows={data.annual.map((a) => [String(a.year), fmtInt(a.harmonized), fmtInt(a.raw_modis), fmtInt(a.raw_viirs)])}
      />
    </figure>
  )
}

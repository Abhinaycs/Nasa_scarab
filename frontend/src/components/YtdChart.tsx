import { useCallback, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import type { TimeseriesResponse } from '../types'
import { fmtInt } from '../format'
import PlotFigure from './PlotFigure'
import DataTable from './DataTable'

const CURRENT = '#e8590c'
const MAXC = '#3b5bdb'
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function YtdChart({ data }: { data: TimeseriesResponse }) {
  const { current, maxYear, finals } = useMemo(() => {
    const finals = new Map<number, number>()
    for (const p of data.ytd) finals.set(p.year, Math.max(finals.get(p.year) ?? 0, p.cum))
    const years = [...finals.keys()]
    const current = Math.max(...years)
    let maxYear = years[0]
    for (const y of years) if (y !== current && (finals.get(y) ?? 0) > (finals.get(maxYear) ?? 0)) maxYear = y
    return { current, maxYear, finals }
  }, [data])

  const render = useCallback(
    (width: number) => {
      const past = data.ytd.filter((p) => p.year !== current && p.year !== maxYear)
      const maxPts = data.ytd.filter((p) => p.year === maxYear)
      const curPts = data.ytd.filter((p) => p.year === current)
      return Plot.plot({
        width,
        height: 280,
        marginLeft: 56,
        marginRight: 84,
        style: { background: 'transparent', color: 'var(--text)', fontSize: '11px' },
        x: { domain: [1, 366], ticks: width < 500 ? MONTH_STARTS.filter((_, i) => i % 3 === 0) : MONTH_STARTS, tickFormat: (d: number) => MONTH_ABBR[MONTH_STARTS.indexOf(d)] ?? '', label: null },
        y: { grid: true, label: 'cumulative fire cell-days', zero: true },
        marks: [
          Plot.lineY(past, { x: 'doy', y: 'cum', z: 'year', stroke: '#9aa3ae', strokeOpacity: 0.45, strokeWidth: 1 }),
          Plot.lineY(maxPts, { x: 'doy', y: 'cum', stroke: MAXC, strokeWidth: 1.5 }),
          Plot.text(maxPts.slice(-1), { x: 'doy', y: 'cum', text: () => `${maxYear} (max)`, dx: 4, textAnchor: 'start', fill: MAXC }),
          Plot.lineY(curPts, { x: 'doy', y: 'cum', stroke: CURRENT, strokeWidth: 3 }),
          Plot.text(curPts.slice(-1), { x: 'doy', y: 'cum', text: () => String(current), dx: 4, textAnchor: 'start', fill: CURRENT, fontWeight: 700 }),
          Plot.tip(data.ytd, Plot.pointer({ x: 'doy', y: 'cum', title: (p) => `${p.year}, day ${p.doy}: ${fmtInt(p.cum)}` })),
        ],
      })
    },
    [data, current, maxYear],
  )

  return (
    <figure className="figure">
      <PlotFigure render={render} label={`Year-to-date cumulative fire cell-days, ${current} highlighted`} />
      <figcaption>
        Running total through each year. Grey lines are past years, blue is the busiest year ({maxYear}), and the bold
        orange line is {current} so far. A steeper line means more burning in that part of the year.
      </figcaption>
      <DataTable
        summary="Show table"
        columns={['Year', 'Total']}
        rows={[...finals.entries()].sort((a, b) => a[0] - b[0]).map(([y, v]) => [String(y), fmtInt(v) + (y === current ? ' (to date)' : '')])}
      />
    </figure>
  )
}

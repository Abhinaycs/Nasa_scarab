import { useCallback, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import type { CalendarResponse } from '../types'
import { fmtInt } from '../format'
import PlotFigure from './PlotFigure'
import DataTable from './DataTable'

export type AnnualMode = 'harmonized' | 'raw'

const BAR = '#c8501e'
const MODIS = '#3b5bdb'
const VIIRS = '#e8590c'
const VIIRS_START = 2012

interface Props {
  data: CalendarResponse
  mode: AnnualMode
}

export default function AnnualChart({ data, mode }: Props) {
  const current = Math.max(...data.annual.map((a) => a.year))
  const first = Math.min(...data.annual.map((a) => a.year))
  // A part year has fewer than 12 months of data (the November 2000 start, the current year).
  const partialYears = useMemo(() => {
    const n = new Map<number, number>()
    for (const c of data.cells) n.set(c.year, (n.get(c.year) ?? 0) + 1)
    return new Set(data.annual.map((a) => a.year).filter((y) => (n.get(y) ?? 0) < 12))
  }, [data])
  const partialList = [...partialYears].sort((a, b) => a - b).join(' and ')

  // The size of the jump a naive stitch would show: first VIIRS year vs last MODIS-only year.
  const before = data.annual.find((a) => a.year === VIIRS_START - 1)
  const after = data.annual.find((a) => a.year === VIIRS_START)
  const jump = before && after && before.raw_modis > 0 ? after.raw_viirs / before.raw_modis : null
  // Interim data: no VIIRS counts at all after 2012 (still downloading). Say so instead of claiming a jump.
  const viirsMissing = data.annual.filter((a) => a.year >= VIIRS_START).every((a) => !a.raw_viirs)

  // 90% interval per year from each scaled month's k interval: value × k_lo/k … value × k_hi/k.
  // Months measured directly by VIIRS carry no calibration uncertainty.
  const bands = useMemo(() => {
    const m = new Map<number, { lo: number; hi: number; scaled: boolean }>()
    for (const c of data.cells) {
      const b = m.get(c.year) ?? { lo: 0, hi: 0, scaled: false }
      if (c.k && c.k_lo !== null && c.k_hi !== null && c.k > 0) {
        b.lo += (c.value * c.k_lo) / c.k
        b.hi += (c.value * c.k_hi) / c.k
        b.scaled = true
      } else {
        b.lo += c.value
        b.hi += c.value
      }
      m.set(c.year, b)
    }
    return [...m.entries()].filter(([, b]) => b.scaled && b.hi > b.lo).map(([year, b]) => ({ year, ...b }))
  }, [data])

  const render = useCallback(
    (width: number) => {
      const partial = (y: number) => partialYears.has(y)
      const common = {
        width,
        height: 260,
        marginLeft: 56,
        style: { background: 'transparent', color: 'var(--text)', fontSize: '11px' },
        x: {
          type: 'band' as const,
          // Every year from first to last, so a missing year shows as a gap
          domain: Array.from({ length: current - first + 1 }, (_, i) => first + i),
          label: null, tickFormat: (y: number) => (y % 5 === 0 ? String(y) : ''), tickSize: 0 },
        y: { grid: true, label: 'fire cell-days per year' },
      }
      const sensorLine = Plot.ruleX([VIIRS_START], {
        x: () => VIIRS_START, stroke: 'currentColor', strokeDasharray: '3,3', strokeOpacity: 0.5,
      })

      if (mode === 'harmonized') {
        return Plot.plot({
          ...common,
          marks: [
            Plot.barY(data.annual, {
              x: 'year',
              y: 'harmonized',
              fill: BAR,
              fillOpacity: (a) => (partial(a.year) ? 0.4 : 0.9),
              title: (a) => `${a.year}${partial(a.year) ? ' (part year)' : ''}\nHarmonized: ${fmtInt(a.harmonized)}`,
              tip: true,
            }),
            // 90% calibration interval on the MODIS-era (scaled) years
            Plot.ruleX(bands, { x: 'year', y1: 'lo', y2: 'hi', stroke: 'currentColor', strokeWidth: 1.5, strokeOpacity: 0.75 }),
            Plot.tickY(bands, { x: 'year', y: 'lo', stroke: 'currentColor', strokeOpacity: 0.75, inset: 8 }),
            Plot.tickY(bands, { x: 'year', y: 'hi', stroke: 'currentColor', strokeOpacity: 0.75, inset: 8 }),
            sensorLine,
            Plot.ruleY([0]),
          ],
        })
      }

      // Raw: what you get by stitching the sensors naively. MODIS bars until 2011, VIIRS bars from 2012,
      // with MODIS continuing as a line so the gap between the sensors stays visible.
      const stitched = data.annual.map((a) => ({
        year: a.year,
        value: a.year < VIIRS_START ? a.raw_modis : a.raw_viirs,
        sensor: a.year < VIIRS_START ? 'MODIS' : 'VIIRS',
        raw_modis: a.raw_modis,
        raw_viirs: a.raw_viirs,
      }))
      return Plot.plot({
        ...common,
        color: { domain: ['MODIS', 'VIIRS'], range: [MODIS, VIIRS] },
        marks: [
          Plot.barY(stitched, {
            x: 'year',
            y: 'value',
            fill: 'sensor',
            fillOpacity: (a) => (partial(a.year) ? 0.4 : 0.85),
            title: (a) =>
              `${a.year}${partial(a.year) ? ' (part year)' : ''}\nRaw MODIS: ${fmtInt(a.raw_modis)}\nRaw VIIRS: ${a.year >= VIIRS_START ? fmtInt(a.raw_viirs) : 'not flying'}`,
            tip: true,
          }),
          Plot.lineY(
            data.annual.filter((a) => a.raw_modis > 0),
            { x: 'year', y: 'raw_modis', stroke: MODIS, strokeWidth: 2, marker: 'circle-stroke' },
          ),
          sensorLine,
          Plot.text([VIIRS_START], {
            x: () => VIIRS_START, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start',
            text: () => 'VIIRS starts', fill: 'currentColor', fillOpacity: 0.7,
          }),
          Plot.ruleY([0]),
        ],
      })
    },
    [data, mode, current, first, partialYears, bands],
  )

  return (
    <figure className="figure">
      {mode === 'raw' && (
        <div className="legend">
          <span className="swatch" style={{ background: MODIS }} /> MODIS (bars until 2011, line throughout)
          <span className="swatch" style={{ background: VIIRS }} /> VIIRS (from 2012)
        </div>
      )}
      <PlotFigure
        render={render}
        label={
          mode === 'raw'
            ? 'Raw annual fire counts by sensor, showing the jump at 2012 when VIIRS replaces MODIS'
            : 'Harmonized annual fire cell-days by year'
        }
      />
      <figcaption className={mode === 'raw' ? 'callout' : undefined}>
        {mode === 'raw' && viirsMissing ? (
          <>
            <strong>Raw:</strong> VIIRS data for this area is not loaded yet, so only the MODIS line is shown after
            2012. Once VIIRS is in, its bars will sit well above the MODIS line from 2012, because VIIRS sees many
            more small fires.
          </>
        ) : mode === 'raw' ? (
          <>
            <strong>Raw:</strong> VIIRS sees many more small fires than MODIS, so simply joining the two sensors makes
            fire activity look like it {jump ? <>jumped about {jump.toFixed(1)}×</> : 'jumped'} in 2012. That jump is
            a change of instrument, not a change on the ground. Switch to <strong>Harmonized</strong> to see the
            corrected series.
          </>
        ) : (
          <>
            <strong>Harmonized:</strong> MODIS years are scaled into VIIRS units using ratios fitted where both sensors
            overlap, so the series is consistent across 2012.
            {bands.length > 0 && <> Whiskers on the MODIS years show the 90% calibration interval.</>}
            {partialList && <> Faded bars ({partialList}) are part years with fewer than 12 months of data.</>}
          </>
        )}
      </figcaption>
      <DataTable
        summary="Show table"
        columns={['Year', 'Harmonized', 'Raw MODIS', 'Raw VIIRS']}
        rows={data.annual.map((a) => [String(a.year), fmtInt(a.harmonized), fmtInt(a.raw_modis), fmtInt(a.raw_viirs)])}
      />
    </figure>
  )
}

import { useCallback } from 'react'
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

  // The size of the jump a naive stitch would show: first VIIRS year vs last MODIS-only year.
  const before = data.annual.find((a) => a.year === VIIRS_START - 1)
  const after = data.annual.find((a) => a.year === VIIRS_START)
  const jump = before && after && before.raw_modis > 0 ? after.raw_viirs / before.raw_modis : null

  const render = useCallback(
    (width: number) => {
      const partial = (y: number) => y === current || y === first
      const common = {
        width,
        height: 260,
        marginLeft: 56,
        style: { background: 'transparent', color: 'var(--text)', fontSize: '11px' },
        x: { type: 'band' as const, label: null, tickFormat: (y: number) => (y % 5 === 0 ? String(y) : ''), tickSize: 0 },
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
    [data, mode, current, first],
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
        {mode === 'raw' ? (
          <>
            <strong>Raw:</strong> VIIRS sees many more small fires than MODIS, so simply joining the two sensors makes
            fire activity look like it {jump ? <>jumped about {jump.toFixed(1)}×</> : 'jumped'} in 2012. That jump is
            a change of instrument, not a change on the ground. Switch to <strong>Harmonized</strong> to see the
            corrected series.
          </>
        ) : (
          <>
            <strong>Harmonized:</strong> MODIS years are scaled into VIIRS units using ratios fitted where both sensors
            overlap, so the series is consistent across 2012. Faded bars are part years ({first} starts in November,{' '}
            {current} is still in progress).
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

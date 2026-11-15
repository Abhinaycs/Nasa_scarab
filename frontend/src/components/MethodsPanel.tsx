import { useEffect, useRef } from 'react'
import type { MetaResponse, SensorCoverage } from '../types'
import { MONTHS } from '../format'

interface Props {
  open: boolean
  onClose: () => void
  meta: MetaResponse | null
}

const SENSOR_NAME: Record<string, string> = {
  modis_terra: 'Terra MODIS (10:30 / 22:30 overpass)',
  modis_aqua: 'Aqua MODIS (13:30 / 01:30 overpass)',
  viirs_snpp: 'Suomi NPP VIIRS 375 m (13:30)',
  viirs_noaa20: 'NOAA-20 VIIRS 375 m (13:30)',
}

const KIND_NAME: Record<string, string> = {
  terra_to_aqua: 'Terra → Aqua',
  aqua_to_snpp: 'Aqua MODIS → S-NPP VIIRS',
  n20_to_snpp: 'NOAA-20 → S-NPP',
}

const coverageRange = (c: SensorCoverage): string =>
  Array.isArray(c) ? `${c[0]} to ${c[1]}` : `${c.start} to ${c.end}`

export default function MethodsPanel({ open, onClose, meta }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      ;(lastFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const built = meta?.build_time ?? meta?.built_utc
  const factors = meta?.national_factors ?? []
  const kinds = [...new Set(factors.map((f) => f.kind))]

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="methods-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2 id="methods-title">About the data</h2>
          <button ref={closeRef} type="button" className="btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="drawer-body">
          <section>
            <h3>What is counted</h3>
            <p>
              The unit is the <strong>fire cell-day</strong>: one grid cell (H3 resolution 7, about 5 km²) with at least
              one vegetation-fire detection on a given day. Counting cells instead of individual hotspots removes most of
              the difference between MODIS 1 km pixels and VIIRS 375 m pixels, because one fire lights up several VIIRS
              pixels but usually only one MODIS pixel.
            </p>
          </section>

          <section>
            <h3>Sensors</h3>
            <p>
              Active-fire detections from NASA FIRMS. Only vegetation fires are kept (FIRMS type 0); MODIS detections need
              confidence of at least 30 and VIIRS detections need nominal or high confidence.
            </p>
            {meta?.coverage && (
              <table className="mini">
                <tbody>
                  {Object.entries(meta.coverage).map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{SENSOR_NAME[k] ?? k}</th>
                      <td>{v ? coverageRange(v) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3>Harmonization</h3>
            <p>
              One reference sensor is used per period, all with an early-afternoon overpass so the numbers are comparable:
              Aqua MODIS for July 2002 to 2011, Suomi NPP VIIRS from 2012, and NOAA-20 VIIRS for 2026. Terra MODIS fills
              November 2000 to June 2002. Older sensors are scaled into VIIRS units with ratios <em>k</em> = VIIRS
              cell-days ÷ MODIS cell-days, fitted where both sensors overlap, separately for each 2° block, calendar month
              and day/night pass. Sparse blocks are pulled toward the national ratio. Each ratio comes with a 90%
              bootstrap interval.
            </p>
            {kinds.length > 0 && (
              <table className="mini">
                <thead>
                  <tr>
                    <th scope="col">National ratio</th>
                    <th scope="col">Day k (range over months)</th>
                    <th scope="col">Night k</th>
                  </tr>
                </thead>
                <tbody>
                  {kinds.map((kind) => {
                    const range = (pass: 'D' | 'N') => {
                      const ks = factors.filter((f) => f.kind === kind && f.pass === pass)
                      if (!ks.length) return '–'
                      const lo = ks.reduce((a, b) => (b.k < a.k ? b : a))
                      const hi = ks.reduce((a, b) => (b.k > a.k ? b : a))
                      return `${lo.k.toFixed(2)} (${MONTHS[lo.month - 1]}) – ${hi.k.toFixed(2)} (${MONTHS[hi.month - 1]})`
                    }
                    return (
                      <tr key={kind}>
                        <th scope="row">{KIND_NAME[kind] ?? kind}</th>
                        <td>{range('D')}</td>
                        <td>{range('N')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3>Anomalies</h3>
            <p>
              Each month is compared with the same calendar month in the other years (or 2003–2022 if you choose that
              baseline). We show the percent of the median, a robust z-score ((value − median) ÷ IQR) and the percentile
              rank. Above the 90th percentile is labelled <em>unusually high</em>, below the 10th <em>unusually low</em>.
              Months whose median is under 5 cell-days are not rated, because ratios on tiny counts mislead.
            </p>
          </section>

          <section>
            <h3>Limitations</h3>
            <ul>
              <li>Clouds and thick smoke hide fires, so wet-season and very smoky months are undercounted.</li>
              <li>Satellites see fires only at overpass time; short fires between passes are missed.</li>
              <li>These are counts of burning cells, not burned area or emissions.</li>
              <li>
                Recent months use near-real-time data and are marked <em>provisional</em>; they can change when the
                science-quality data replace them.
              </li>
              <li>Ratios are regional averages; a single small area can differ from its block's typical ratio.</li>
            </ul>
          </section>

          <p className="hint">
            Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m).
            {meta?.method_version && <> Method version {meta.method_version}.</>}
            {built && <> Built {built.slice(0, 16).replace('T', ' ')} UTC.</>}
          </p>
        </div>
      </aside>
    </div>
  )
}

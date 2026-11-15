import { toPng } from 'html-to-image'
import { saveBlob } from './api'
import type { CalendarResponse, Sensor } from './types'

const SENSORS: Sensor[] = ['modis_terra', 'modis_aqua', 'viirs_snpp', 'viirs_noaa20']

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'area'

/** One row per month with value, source, k, raw counts per sensor and the anomaly fields. */
export function downloadCalendarCsv(cal: CalendarResponse, label: string, start: string, end: string): void {
  const header = [
    'year', 'month', 'value', 'unit', 'source', 'k', 'k_lo', 'k_hi', 'provisional',
    ...SENSORS.map((s) => `raw_${s}`),
    'pct_of_median', 'robust_z', 'percentile', 'anomaly_label',
  ]
  const lines = [header.join(',')]
  for (const c of cal.cells) {
    lines.push(
      [
        c.year, c.month, c.value, cal.unit, c.source, c.k, c.k_lo, c.k_hi, c.provisional,
        ...SENSORS.map((s) => c.raw[s]),
        c.anomaly.pct_of_median, c.anomaly.robust_z, c.anomaly.percentile, c.anomaly.label,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })
  saveBlob(blob, `calendar_${slug(label)}_${start}_${end}.csv`)
}

/** Saves a PNG of a chart container at 2x, on the page's current background colour. */
export async function downloadPng(node: HTMLElement, filename: string): Promise<void> {
  const bg = getComputedStyle(node).backgroundColor
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : getComputedStyle(document.body).backgroundColor,
    // Leave out buttons, the table fallback and anything marked as UI-only
    filter: (el) => !(el instanceof HTMLElement && (el.classList.contains('no-export') || el.tagName === 'DETAILS')),
  })
  const blob = await (await fetch(dataUrl)).blob()
  saveBlob(blob, filename)
}

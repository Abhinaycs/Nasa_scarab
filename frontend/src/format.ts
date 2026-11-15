import type { Source } from './types'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const SOURCE_LABEL: Record<Source, string> = {
  modis_terra_scaled: 'Terra MODIS, scaled to VIIRS',
  modis_aqua_scaled: 'Aqua MODIS, scaled to VIIRS',
  viirs_snpp: 'S-NPP VIIRS',
  viirs_noaa20_scaled: 'NOAA-20 VIIRS, scaled to S-NPP',
}

export const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

/** Short form that fits in a calendar cell. */
export const fmtCell = (v: number) =>
  v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))

export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`)

/** Parses `rgb(r, g, b)` or `#rrggbb` and picks black or white text, whichever has the higher WCAG contrast. */
export function contrastText(color: string | undefined): string {
  if (!color) return '#000'
  let r = 0, g = 0, b = 0
  const m = /rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(color)
  if (m) [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else if (/^#[0-9a-f]{6}$/i.test(color)) [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // contrast with black = (L+0.05)/0.05, with white = 1.05/(L+0.05)
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000' : '#fff'
}

/** "Mar–May" from 1-based months. */
export const monthRange = (a: number, b: number) => (a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`)

// Generates src/mocks/*.json matching docs/CONTRACT.md.
// Punjab-like seasonality: wheat-residue peak Apr–May, paddy-residue peak Oct–Nov.
// Run: node scripts/make-mocks.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks')
mkdirSync(outDir, { recursive: true })

// Deterministic PRNG (mulberry32)
let seed = 20261115
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const noise = (sd) => {
  // Box–Muller
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd
}
const r1 = (x) => Math.round(x * 10) / 10

const SEASON = [8, 6, 14, 120, 260, 40, 6, 3, 10, 380, 610, 70] // Jan..Dec, cell-days
const END = { year: 2026, month: 11 } // current (partial) month
const START = { year: 2000, month: 11 }

// Long-term pattern: rising to a 2016 peak, then decline after enforcement drives
const trend = (y) => (y <= 2016 ? 0.88 + 0.12 * ((y - 2000) / 16) : 1.0 - 0.012 * (y - 2016))
// A few deliberate extremes so the anomaly view has something to show
const SPIKES = { '2016-11': 1.7, '2012-5': 1.6, '2008-10': 1.5, '2020-4': 0.35, '2023-11': 0.45 }

const sourceFor = (y, m) => {
  if (y < 2002 || (y === 2002 && m <= 6)) return 'modis_terra_scaled'
  if (y <= 2011) return 'modis_aqua_scaled'
  if (y <= 2025) return 'viirs_snpp'
  return 'viirs_noaa20_scaled'
}
const kFor = (src, m) => {
  const base = { modis_terra_scaled: 2.9, modis_aqua_scaled: 2.6, viirs_noaa20_scaled: 1.12 }[src]
  if (!base) return null
  const k = base * (1 + 0.08 * Math.sin((m / 12) * 2 * Math.PI))
  return { k: r1(k * 100) / 100, k_lo: r1(k * 0.9 * 100) / 100, k_hi: r1(k * 1.1 * 100) / 100 }
}

const quantile = (sorted, q) => {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// 1) Harmonized values per (year, month)
const raw = []
for (let y = START.year; y <= END.year; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === START.year && m < START.month) continue
    if (y === END.year && m > END.month) continue
    const spike = SPIKES[`${y}-${m}`] ?? 1
    let v = SEASON[m - 1] * trend(y) * spike * Math.exp(noise(0.12))
    if (y === END.year && m === END.month) v *= 15 / 30 // half the month so far
    raw.push({ year: y, month: m, value: Math.max(0, Math.round(v)) })
  }
}

// 2) Anomalies: baseline is the same month in every other year
const byMonth = (m) => raw.filter((c) => c.month === m)
const cells = raw.map((c) => {
  const src = sourceFor(c.year, c.month)
  const k = kFor(src, c.month)
  const others = byMonth(c.month)
    .filter((o) => o.year !== c.year && !(o.year === END.year && o.month === END.month))
    .map((o) => o.value)
    .sort((a, b) => a - b)
  const med = quantile(others, 0.5)
  const iqr = quantile(others, 0.75) - quantile(others, 0.25)
  const pct = (others.filter((o) => o < c.value).length + 0.5 * others.filter((o) => o === c.value).length) / others.length * 100
  let label = 'normal'
  if (med < 5) label = null
  else if (pct > 90) label = 'unusually high'
  else if (pct < 10) label = 'unusually low'

  const rawCounts = {}
  const v = c.value
  if (c.year >= 2000 && !(c.year === 2000 && c.month < 11)) rawCounts.modis_terra = Math.round((v / 2.9) * (0.9 + 0.2 * rand()))
  if (c.year > 2002 || (c.year === 2002 && c.month >= 7)) rawCounts.modis_aqua = Math.round((v / 2.6) * (0.9 + 0.2 * rand()))
  if (c.year >= 2012) rawCounts.viirs_snpp = c.year <= 2025 ? v : Math.round(v * (0.95 + 0.1 * rand()))
  if (c.year >= 2018) rawCounts.viirs_noaa20 = c.year === 2026 ? Math.round(v / 1.12) : Math.round(v * (0.85 + 0.1 * rand()))

  return {
    year: c.year,
    month: c.month,
    value: v,
    raw: rawCounts,
    source: src,
    k: k?.k ?? null,
    k_lo: k?.k_lo ?? null,
    k_hi: k?.k_hi ?? null,
    provisional: c.year === END.year && c.month >= 9,
    anomaly: {
      pct_of_median: med > 0 ? r1((v / med) * 100) : null,
      robust_z: iqr > 0 ? Math.round(((v - med) / iqr) * 100) / 100 : null,
      percentile: r1(pct),
      label,
    },
  }
})

// 3) Climatology over complete months
const climatology = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1
  const vals = byMonth(m)
    .filter((c) => !(c.year === END.year && c.month === END.month))
    .map((c) => c.value)
    .sort((a, b) => a - b)
  return {
    month: m,
    median: r1(quantile(vals, 0.5)),
    q25: r1(quantile(vals, 0.25)),
    q75: r1(quantile(vals, 0.75)),
    p10: r1(quantile(vals, 0.1)),
    p90: r1(quantile(vals, 0.9)),
    min: r1(vals[0]),
    max: r1(vals[vals.length - 1]),
    mean: r1(vals.reduce((a, b) => a + b, 0) / vals.length),
  }
})

const years = []
for (let y = START.year; y <= END.year; y++) years.push(y)

const annual = years.map((y) => {
  const cs = cells.filter((c) => c.year === y)
  const sum = (f) => cs.reduce((a, c) => a + (f(c) ?? 0), 0)
  return {
    year: y,
    harmonized: r1(sum((c) => c.value)),
    raw_modis: sum((c) => c.raw.modis_aqua ?? c.raw.modis_terra),
    raw_viirs: sum((c) => c.raw.viirs_snpp ?? (c.year === 2026 ? c.raw.viirs_noaa20 : 0)),
  }
})

const calendar = {
  aoi: { area_km2: 25000.0, cells: 4810, resolution: 7 },
  unit: 'fire cell-days (S-NPP VIIRS equivalent)',
  years,
  cells,
  climatology,
  annual,
}

// 4) Summary
const medians = climatology.map((c) => c.median)
const peak_month = medians.indexOf(Math.max(...medians)) + 1
const complete = annual.filter((a) => a.year > 2000 && a.year < END.year)
const busiest = complete.reduce((a, b) => (b.harmonized > a.harmonized ? b : a))
const cur = cells[cells.length - 1]
const total = medians.reduce((a, b) => a + b, 0)
let best = { start: 1, len: 12 }
for (let s = 0; s < 12; s++) {
  let acc = 0
  for (let len = 1; len <= 12; len++) {
    acc += medians[(s + len - 1) % 12]
    if (acc >= 0.8 * total) {
      if (len < best.len) best = { start: s + 1, len }
      break
    }
  }
}
const summary = {
  peak_month,
  busiest_year: { year: busiest.year, value: busiest.harmonized },
  current_month: {
    year: cur.year,
    month: cur.month,
    value: cur.value,
    median: climatology[cur.month - 1].median,
    pct_of_median: cur.anomaly.pct_of_median,
    percentile: cur.anomaly.percentile,
    label: cur.anomaly.label,
    provisional: cur.provisional,
  },
  season: { start_month: best.start, end_month: ((best.start + best.len - 2) % 12) + 1, length_months: best.len },
  total_cell_days: r1(cells.reduce((a, c) => a + c.value, 0)),
}

// 5) Timeseries: weekly for the last 3 years, YTD cumulative for every year
const weekly = []
const ytd = []
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
for (const y of years) {
  let cum = 0
  for (let m = 1; m <= 12; m++) {
    const c = cells.find((x) => x.year === y && x.month === m)
    if (!c) continue
    const nd = y === END.year && m === END.month ? 15 : daysIn(y, m)
    const doy0 = Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(y, 0, 1)) / 86400000) + 1
    cum += c.value
    ytd.push({ year: y, doy: doy0 + nd - 1, cum: r1(cum) })
  }
}
const weekStart = new Date(Date.UTC(END.year - 2, 0, 5)) // a Monday
const endDate = Date.UTC(END.year, END.month - 1, 15)
for (let t = weekStart.getTime(); t <= endDate; t += 7 * 86400000) {
  const d = new Date(t)
  const c = cells.find((x) => x.year === d.getUTCFullYear() && x.month === d.getUTCMonth() + 1)
  const v = c ? (c.value / daysIn(d.getUTCFullYear(), d.getUTCMonth() + 1)) * 7 * Math.exp(noise(0.25)) : 0
  weekly.push({ week_start: d.toISOString().slice(0, 10), value: r1(v) })
}
const timeseries = { weekly, ytd }

// 6) Meta
const national_factors = []
for (const kind of ['aqua_to_snpp', 'terra_to_aqua', 'n20_to_snpp']) {
  const base = { aqua_to_snpp: 2.6, terra_to_aqua: 1.11, n20_to_snpp: 1.12 }[kind]
  for (let m = 1; m <= 12; m++) {
    for (const pass of ['D', 'N']) {
      const k = base * (1 + 0.08 * Math.sin((m / 12) * 2 * Math.PI)) * (pass === 'N' ? 1.25 : 1)
      national_factors.push({ kind, month: m, pass, k: Math.round(k * 100) / 100, k_lo: Math.round(k * 92) / 100, k_hi: Math.round(k * 108) / 100 })
    }
  }
}
const meta = {
  coverage: {
    modis_terra: { start: '2000-11-01', end: '2026-11-14' },
    modis_aqua: { start: '2002-07-04', end: '2026-11-14' },
    viirs_snpp: { start: '2012-01-20', end: '2025-12-31' },
    viirs_noaa20: { start: '2018-01-01', end: '2026-11-14' },
  },
  build_time: '2026-11-15T19:00:00Z',
  method_version: 'mock-0.1',
  national_factors,
}

const write = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 1) + '\n')
write('calendar.json', calendar)
write('summary.json', summary)
write('timeseries.json', timeseries)
write('meta.json', meta)
console.log(`mocks: ${cells.length} calendar cells, ${weekly.length} weeks, ${ytd.length} ytd points → ${outDir}`)
console.log('summary:', JSON.stringify(summary))

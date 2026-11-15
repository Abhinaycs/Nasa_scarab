/**
 * The method as an exploded view: each layer of the pipeline is drawn as a plate floating above
 * the one it is built from, ending in the burning calendar on top. Pure SVG, no data needed.
 * Plates are drawn flat (W x W units) and projected isometrically with one matrix.
 */
const W = 150 // plate size in flat units
const GAP = 58 // vertical distance between plates
const C = 0.866 // cos 30
const ISO = (ty: number) => `matrix(${C} 0.5 ${-C} 0.5 ${W * C} ${ty})`

// Deterministic "random" so the picture is the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// Fires cluster along a diagonal belt (like the Punjab plains) plus a few scattered ones.
function firePoints(n: number, seed: number) {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    const t = r()
    const belt = r() < 0.8
    const x = belt ? 20 + t * 110 + (r() - 0.5) * 34 : 10 + r() * 130
    const y = belt ? 120 - t * 85 + (r() - 0.5) * 34 : 10 + r() * 130
    return [Math.min(W - 6, Math.max(6, x)), Math.min(W - 6, Math.max(6, y))]
  })
}
const MODIS = firePoints(26, 7)
const VIIRS = firePoints(150, 7)

// Hex grid: a cell is lit if any VIIRS fire falls inside it.
const HEX_R = 9
const HEXES = (() => {
  const out: { cx: number; cy: number; lit: boolean }[] = []
  const dx = HEX_R * Math.sqrt(3)
  const dy = HEX_R * 1.5
  for (let row = 0; row * dy < W + HEX_R; row++) {
    for (let col = 0; col * dx < W + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0)
      const cy = row * dy
      if (cx < 4 || cx > W - 4 || cy < 4 || cy > W - 4) continue
      const lit = VIIRS.some(([x, y]) => (x - cx) ** 2 + (y - cy) ** 2 < (HEX_R * 0.9) ** 2)
      out.push({ cx, cy, lit })
    }
  }
  return out
})()
const hexPath = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join('') + 'Z'

// Calibration blocks: 3 x 3, each with its own factor (shade = size of k).
const BLOCKS = [5.8, 6.4, 7.1, 6.0, 6.35, 6.9, 5.5, 6.2, 6.6]

// Calendar: 8 years x 12 months, seasonal peak in Oct-Nov.
const CAL = (() => {
  const r = rng(3)
  const season = [0.15, 0.1, 0.25, 0.55, 0.5, 0.15, 0.05, 0.05, 0.15, 0.75, 1, 0.35]
  return Array.from({ length: 8 }, () => season.map((s) => Math.min(1, s * (0.6 + r() * 0.7))))
})()
const fireRamp = (v: number) => {
  // paper -> amber -> deep red, readable on dark
  const stops = [
    [251, 227, 196],
    [229, 138, 46],
    [200, 65, 43],
    [122, 24, 20],
  ]
  const t = v * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(t))
  const f = t - i
  const c = stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f))
  return `rgb(${c.join(',')})`
}

interface Layer {
  key: string
  step: string
  title: string
  text: string
  body: React.ReactNode
}

const LAYERS: Layer[] = [
  {
    key: 'calendar',
    step: '05',
    title: 'Burning calendar',
    text: 'One series in VIIRS units, years × months, with anomalies against the usual.',
    body: CAL.flatMap((row, y) =>
      row.map((v, m) => (
        <rect key={`${y}-${m}`} x={6 + m * 11.5} y={10 + y * 16.5} width={10} height={14.5} rx={2} fill={fireRamp(v)} />
      )),
    ),
  },
  {
    key: 'calib',
    step: '04',
    title: 'Calibrate',
    text: 'k = VIIRS ÷ MODIS on the 2012–2025 overlap, per 2° block, month and day/night.',
    body: BLOCKS.map((k, i) => (
      <rect
        key={i}
        x={4 + (i % 3) * 48}
        y={4 + Math.floor(i / 3) * 48}
        width={46}
        height={46}
        rx={4}
        fill="#7E8BE0"
        fillOpacity={0.18 + ((k - 5.4) / 1.8) * 0.55}
        stroke="#B9C1F2"
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
    )),
  },
  {
    key: 'grid',
    step: '03',
    title: 'Count fire cell-days',
    text: 'Every detection drops into an H3 cell (≈ 5 km²). A cell that burned on a day counts once.',
    body: HEXES.map((h, i) => (
      <path
        key={i}
        d={hexPath(h.cx, h.cy, HEX_R * 0.92)}
        fill={h.lit ? '#E58A2E' : 'none'}
        fillOpacity={h.lit ? 0.8 : 0}
        stroke="#CFC8B8"
        strokeOpacity={0.45}
        strokeWidth={0.7}
      />
    )),
  },
  {
    key: 'viirs',
    step: '02',
    title: 'VIIRS · 375 m · 2012 →',
    text: 'Finer pixels find many more small fires, so raw counts jump in 2012.',
    body: VIIRS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.7} fill="#F2A65A" />),
  },
  {
    key: 'modis',
    step: '01',
    title: 'MODIS · 1 km · 2000 →',
    text: 'The long record. Coarser pixels, fewer detections. NASA FIRMS, both sensors.',
    body: MODIS.map(([x, y], i) => <rect key={i} x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1} fill="#8E9BF0" />),
  },
]

export default function ExplodedView() {
  const n = LAYERS.length
  const plateH = W * 2 * 0.5 // projected height of one plate (both diagonals)
  const width = 640
  const height = plateH + GAP * (n - 1) + 24
  const labelX = W * 2 * C + 34
  return (
    <svg
      className="exploded"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby="exploded-title exploded-desc"
    >
      <title id="exploded-title">How the harmonized calendar is built, as an exploded view</title>
      <desc id="exploded-desc">
        Five layers, bottom to top: MODIS detections, VIIRS detections, an H3 hexagon grid of fire cell-days,
        calibration blocks, and the burning calendar.
      </desc>
      {/* the axis the plates are exploded along */}
      <line x1={W * C} y1={12} x2={W * C} y2={height - 12} className="exploded-axis" />
      {LAYERS.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => {
        const ty = 12 + i * GAP
        const corner = { x: W * 2 * C, y: ty + W * 0.5 } // right-hand corner of the plate
        const depth = (n - 1 - i) * GAP // how far the plate travels when the stack opens
        return (
          <g key={l.key} className="exploded-layer" style={{ ['--d' as string]: `${depth * 0.6}px`, ['--i' as string]: n - 1 - i }}>
            <g transform={ISO(ty)}>
              <rect width={W} height={W} rx={6} className="exploded-plate" />
              {l.body}
            </g>
            <line x1={corner.x + 4} y1={corner.y} x2={labelX - 8} y2={corner.y} className="exploded-leader" />
            <text x={labelX} y={corner.y - 14} className="exploded-step">{l.step}</text>
            <text x={labelX + 28} y={corner.y - 14} className="exploded-title">{l.title}</text>
            <foreignObject x={labelX} y={corner.y - 6} width={width - labelX - 4} height={44}>
              <p className="exploded-text">{l.text}</p>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}

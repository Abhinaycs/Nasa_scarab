/**
 * Start page: what the app is, one button to open it, and the credits. No login.
 * The calendar on the right is an illustration (a typical two-season pattern), not live data.
 */
interface Props {
  onStart: () => void
  onAbout: () => void
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const FIRST_YEAR = 2000
const N_YEARS = 26

// Deterministic "random" so the picture is the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}
const SEASON = [0.06, 0.05, 0.1, 0.42, 0.62, 0.12, 0.04, 0.03, 0.1, 0.72, 1, 0.3]
const CELLS = (() => {
  const r = rng(11)
  return Array.from({ length: N_YEARS }, (_, y) =>
    SEASON.map((s) => Math.min(1, s * (0.55 + r() * 0.75) * (0.85 + (y / N_YEARS) * 0.3))),
  )
})()

// night blue -> ember -> flame -> pale yellow
const STOPS = [
  [22, 40, 78],
  [122, 36, 28],
  [232, 89, 12],
  [255, 176, 59],
  [255, 236, 170],
]
function ramp(v: number) {
  const t = Math.pow(v, 0.7) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(t))
  const f = t - i
  return `rgb(${STOPS[i].map((a, k) => Math.round(a + (STOPS[i + 1][k] - a) * f)).join(',')})`
}

const FACTS = [
  { value: '25 yrs', label: 'of fire detections, Nov 2000 to today' },
  { value: '4 sensors', label: 'Terra and Aqua MODIS, S-NPP and NOAA-20 VIIRS' },
  { value: '1 record', label: 'calibrated into one consistent series' },
  { value: 'Any area', label: 'draw it anywhere over India' },
]

const REFERENCES: { text: string; href: string }[] = [
  { text: 'Giglio, Schroeder & Justice (2016). The collection 6 MODIS active fire detection algorithm and fire products.', href: 'https://doi.org/10.1016/j.rse.2016.02.054' },
  { text: 'Schroeder et al. (2014). The new VIIRS 375 m active fire detection data product.', href: 'https://doi.org/10.1016/j.rse.2013.12.008' },
  { text: 'Giglio, Csiszar & Justice (2006). Global distribution and seasonality of active fires (Terra and Aqua MODIS).', href: 'https://doi.org/10.1029/2005JG000142' },
  { text: 'Giglio (2007). Characterization of the tropical diurnal fire cycle.', href: 'https://doi.org/10.1016/j.rse.2006.11.018' },
  { text: 'Li et al. (2018). Comparison of fire radiative power estimates from VIIRS and MODIS.', href: 'https://repository.library.noaa.gov/view/noaa/49896' },
  { text: 'Chen et al. (2023). Global Fire Emissions Database, version 5 (GFED5).', href: 'https://doi.org/10.5194/essd-15-5227-2023' },
  { text: 'Wooster et al. (2021). Satellite remote sensing of active fires.', href: 'https://doi.org/10.1016/j.rse.2021.112694' },
]

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <rect x="1" y="1" width="4" height="4" rx="1" opacity=".55" />
        <rect x="7" y="1" width="4" height="4" rx="1" opacity=".8" />
        <rect x="13" y="1" width="4" height="4" rx="1" opacity=".4" />
        <rect x="1" y="7" width="4" height="4" rx="1" opacity=".4" />
        <rect x="7" y="7" width="4" height="4" rx="1" />
        <rect x="13" y="7" width="4" height="4" rx="1" opacity=".8" />
        <rect x="1" y="13" width="4" height="4" rx="1" opacity=".8" />
        <rect x="7" y="13" width="4" height="4" rx="1" opacity=".4" />
        <rect x="13" y="13" width="4" height="4" rx="1" opacity=".55" />
      </svg>
    </span>
  )
}

export default function Landing({ onStart, onAbout }: Props) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <Mark />
          <span>Fire Activity Calendar</span>
        </div>
        <span className="landing-event">NASA Space Apps Challenge 2026 · Team Scarab</span>
      </header>

      <main className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow">Harmonized MODIS + VIIRS · India</div>
          <h1>
            Twenty-five years of fire, <em>in one consistent record.</em>
          </h1>
          <p className="landing-sub">
            Two generations of satellites count fires differently. We join them into a single month-by-year burning
            calendar for any area in India, so you can see when a place burns and whether this month is unusual.
          </p>
          <div className="landing-actions">
            <button type="button" className="landing-cta" onClick={onStart} autoFocus>
              Get started
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9h12M10 4l5 5-5 5" />
              </svg>
            </button>
            <button type="button" className="landing-ghost" onClick={onAbout} aria-haspopup="dialog">
              About the data
            </button>
          </div>
          <p className="landing-note">Free and open. No account or sign-in needed.</p>
        </div>

        <figure className="landing-visual" aria-label="Illustration of a burning calendar: years down, months across, brighter cells mean more fire.">
          <div className="mosaic-card">
            <div className="mosaic-head">
              <span>Burning calendar</span>
              <span className="mosaic-tag">Illustration</span>
            </div>
            <div className="mosaic-months" aria-hidden="true">
              {MONTHS.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
            <div className="mosaic" aria-hidden="true">
              {CELLS.map((row, y) =>
                row.map((v, m) => (
                  <i
                    key={`${y}-${m}`}
                    className={v > 0.6 ? 'hot' : undefined}
                    style={{ background: ramp(v), animationDelay: `${y * 28 + m * 14}ms, ${(y * 7 + m * 13) % 17 * 180}ms` }}
                  />
                )),
              )}
            </div>
            <div className="mosaic-foot" aria-hidden="true">
              <span>{FIRST_YEAR}</span>
              <span className="mosaic-ramp" />
              <span>{FIRST_YEAR + N_YEARS - 1}</span>
            </div>
          </div>
        </figure>
      </main>

      <ul className="landing-facts">
        {FACTS.map((f) => (
          <li key={f.value}>
            <strong>{f.value}</strong>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <footer className="landing-credits" aria-labelledby="credits-h">
        <h2 id="credits-h">Credits and references</h2>
        <div className="credits-grid">
          <section>
            <h3>Data</h3>
            <p>
              Active-fire detections from{' '}
              <a href="https://www.earthdata.nasa.gov/data/tools/firms" target="_blank" rel="noreferrer">NASA FIRMS</a>{' '}
              (Fire Information for Resource Management System): MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m
              (Suomi NPP, NOAA-20). We acknowledge the use of data from NASA's FIRMS, part of NASA's Earth Science Data
              and Information System (ESDIS).
            </p>
          </section>
          <section>
            <h3>Maps and software</h3>
            <p>
              Basemap by <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>, ©{' '}
              <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a>, data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>{' '}
              contributors. Built with MapLibre GL JS, Terra Draw, Observable Plot, Turf.js, React, H3, DuckDB and
              FastAPI. Typeface: Inter.
            </p>
          </section>
          <section>
            <h3>Team and AI use</h3>
            <p>
              Team Scarab: Sravani (data and API) and Abhinay (frontend, deployment and demo).{' '}
              <a href="https://github.com/sravani6130/Nasa_scarab" target="_blank" rel="noreferrer">Source code on GitHub</a>.
              Claude Code (Anthropic) assisted with planning, code and documentation; the team reviewed, ran and tested
              all of it. No AI-generated images, video or audio are used.
            </p>
          </section>
        </div>
        <details className="credits-refs">
          <summary>Scientific references</summary>
          <ol>
            {REFERENCES.map((r) => (
              <li key={r.href}>
                {r.text}{' '}
                <a href={r.href} target="_blank" rel="noreferrer">{r.href.replace('https://', '')}</a>
              </li>
            ))}
          </ol>
        </details>
        <p className="credits-disclaimer">
          Made for the NASA Space Apps Challenge 2026. This is an independent student project; it is not affiliated with,
          sponsored by or endorsed by NASA. Fire counts are an index of burning activity, not burned area.
        </p>
      </footer>
    </div>
  )
}

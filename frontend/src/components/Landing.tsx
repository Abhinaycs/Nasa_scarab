import ExplodedView from './ExplodedView'

/** Start page: black on white. What the app is, one centred button to open it, the method, and the credits. No login. */
interface Props {
  onStart: () => void
  onAbout: () => void
}

const SATELLITES = [
  { name: 'Terra', sensor: 'MODIS · 1 km', since: 'in orbit since 1999' },
  { name: 'Aqua', sensor: 'MODIS · 1 km', since: 'in orbit since 2002' },
  { name: 'Suomi NPP', sensor: 'VIIRS · 375 m', since: 'in orbit since 2011' },
  { name: 'NOAA-20', sensor: 'VIIRS · 375 m', since: 'in orbit since 2017' },
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

/** A generic Earth-observing satellite in line art (our own drawing), looking down along its scan. */
function Satellite() {
  const panel = (x: number) => (
    <g>
      <rect x={x} y={30} width={50} height={26} rx={2} />
      <line x1={x + 12.5} y1={30} x2={x + 12.5} y2={56} />
      <line x1={x + 25} y1={30} x2={x + 25} y2={56} />
      <line x1={x + 37.5} y1={30} x2={x + 37.5} y2={56} />
      <line x1={x} y1={43} x2={x + 50} y2={43} />
    </g>
  )
  return (
    <svg className="satellite" viewBox="0 0 200 150" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="satellite-craft">
        {panel(10)}
        {panel(140)}
        <line x1={60} y1={43} x2={84} y2={43} />
        <line x1={116} y1={43} x2={140} y2={43} />
        <rect x={84} y={27} width={32} height={32} rx={3} />
        <line x1={84} y1={37} x2={116} y2={37} />
        <path d="M92 59 L88 69 H112 L108 59" />
        <line x1={100} y1={27} x2={100} y2={16} />
        <circle cx={100} cy={12.5} r={3.5} />
        <path d="M108 27 q4 -9 13 -7" />
      </g>
      <g className="satellite-beam" strokeDasharray="2 5" strokeWidth="1.2">
        <line x1={92} y1={72} x2={62} y2={148} />
        <line x1={100} y1={72} x2={100} y2={148} />
        <line x1={108} y1={72} x2={138} y2={148} />
      </g>
    </svg>
  )
}

export default function Landing({ onStart, onAbout }: Props) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <img className="landing-logo" src={`${import.meta.env.BASE_URL}scarab.png`} alt="Team Scarab" />
        <span className="landing-event">NASA Space Apps Challenge 2026</span>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-eyebrow">Fire Activity Calendar · India</p>
          <h1>Twenty-five years of fire, one consistent record.</h1>
          <p className="landing-sub">
            Two generations of NASA satellites count fires differently. We join them into a single burning calendar for
            any area in India.
          </p>
          <button type="button" className="landing-cta" onClick={onStart} autoFocus>
            Get started
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9h12M10 4l5 5-5 5" />
            </svg>
          </button>
          <p className="landing-note">
            No sign-in needed ·{' '}
            <button type="button" className="landing-link" onClick={onAbout} aria-haspopup="dialog">About the data</button>
          </p>
        </section>

        <section className="landing-method" aria-labelledby="method-h">
          <h2 id="method-h">From orbit to calendar</h2>
          <figure className="landing-figure">
            <Satellite />
            <ExplodedView />
            <figcaption>Each layer is built from the one beneath it: detections, grid cells, calibration, calendar.</figcaption>
          </figure>
        </section>

        <section className="landing-sats" aria-labelledby="sats-h">
          <h2 id="sats-h">The satellites behind the record</h2>
          <ul>
            {SATELLITES.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                <span>{s.sensor}</span>
                <span>{s.since}</span>
              </li>
            ))}
          </ul>
          <p>
            Active-fire data from NASA FIRMS. Terra and Aqua are NASA missions; Suomi NPP and NOAA-20 are joint NASA and
            NOAA missions.
          </p>
        </section>
      </main>

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
              Team Scarab: Sravani, Samay, Charitha and Abhinay.{' '}
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
          Made for the NASA Space Apps Challenge 2026. An independent project, not affiliated with, sponsored by or
          endorsed by NASA. The satellite drawing is our own illustration. Fire counts are an index of burning activity,
          not burned area.
        </p>
      </footer>
    </div>
  )
}

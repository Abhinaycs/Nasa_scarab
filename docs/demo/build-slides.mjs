// Prints docs/demo/slides.html to docs/demo/slides.pdf (one 1280x720 page per slide) with headless Chrome.
//   node docs/demo/build-slides.mjs
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const CHROME =
  process.env.CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find((p) => existsSync(p))
if (!CHROME) throw new Error('Chrome not found; set CHROME=/path/to/chrome')

const profile = join(tmpdir(), `fc-slides-${Date.now()}`)
const out = join(here, 'slides.pdf')
const r = spawnSync(CHROME, [
  '--headless=new',
  `--user-data-dir=${profile}`,
  '--no-pdf-header-footer',
  '--allow-file-access-from-files',
  '--virtual-time-budget=5000',
  `--print-to-pdf=${out}`,
  pathToFileURL(join(here, 'slides.html')).href,
], { encoding: 'utf8' })
rmSync(profile, { recursive: true, force: true })
if (r.status !== 0 || !existsSync(out)) {
  console.error(r.stderr)
  process.exit(1)
}
console.log('wrote', out)

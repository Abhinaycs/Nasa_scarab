// Takes the demo screenshots for the slides, from the local or the live app.
//   node docs/demo/screenshots.mjs <app-url> [preset]
//   e.g. node docs/demo/screenshots.mjs https://fire-calendar.onrender.com Punjab
// Needs Google Chrome installed (set CHROME to its path if it is not in the default place).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const [url = 'http://localhost:5173', preset = 'Punjab'] = process.argv.slice(2)
const out = join(dirname(fileURLToPath(import.meta.url)), 'screens')
mkdirSync(out, { recursive: true })
const CHROME =
  process.env.CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find((p) => existsSync(p))
if (!CHROME) throw new Error('Chrome not found; set CHROME=/path/to/chrome')

const profile = join(tmpdir(), `fc-shots-${Date.now()}`)
const PORT = 9400 + Math.floor(Math.random() * 100)
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=1440,1000', `--user-data-dir=${profile}`, 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 60 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json() } catch { await sleep(250) }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const click = (sel, text) => js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true })()`)
const waitFor = async (expr, ms = 90000) => {
  const t = Date.now()
  while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(300) }
  throw new Error(`timed out waiting for ${expr}`)
}
const viewport = async (w, h, mobile = false) =>
  send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile })

/** Screenshot of one element (by CSS selector + optional heading text), or the viewport. */
async function shot(name, selector, heading, fixedClip) {
  let clip = fixedClip ? { ...fixedClip, scale: 1 } : undefined
  if (!clip && selector) {
    const r = await js(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = ${heading ? `els.find(e => e.querySelector('h3')?.textContent === ${JSON.stringify(heading)})` : 'els[0]'};
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height };
    })()`)
    if (!r) throw new Error(`no element for ${selector} ${heading ?? ''}`)
    clip = { ...r, scale: 1 }
  }
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip } : {}) })
  writeFileSync(join(out, name), Buffer.from(res.result.data, 'base64'))
  console.log('saved', name)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await viewport(1440, 3400) // tall, so element shots never need captureBeyondViewport (that resizes the page and charts redraw tiny)
await send('Page.navigate', { url })
await waitFor(`!!document.querySelector('button.preset')`)
await sleep(2500) // let map tiles load

await click('button.preset', preset)
await sleep(1500)
await click('button', 'Analyze')
await waitFor(`!!document.querySelector('.results .stat-value')`)
await sleep(2500)
const FIRST_SCREEN = { x: 0, y: 0, width: 1440, height: 1000 }
await shot('01-app.png', null, null, FIRST_SCREEN) // first screen: panel, map, summary

await shot('02-calendar.png', 'section.card', 'Burning calendar')
await click('button.seg-btn', 'Anomalies')
await sleep(800)
await shot('03-anomalies.png', 'section.card', 'Burning calendar')
await click('button.seg-btn', 'Counts')

await click('button.seg-btn', 'Raw sensors')
await sleep(800)
await shot('04-annual-raw.png', 'section.card', 'Fire activity by year')
await click('button.seg-btn', 'Harmonized')
await sleep(800)
await shot('05-annual-harmonized.png', 'section.card', 'Fire activity by year')

await shot('06-climatology.png', 'section.card', 'Typical year')
await shot('07-ytd.png', 'section.card', 'Year to date')
await shot('08-summary.png', '.stats')

await click('button', 'About the data')
await sleep(600)
await shot('09-methods.png', null, null, FIRST_SCREEN)
await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

// Phone view
await viewport(390, 844, true)
  // phone: viewport-sized shot only
await send('Page.reload')
await waitFor(`!!document.querySelector('button.preset')`)
await sleep(2000)
await click('button.preset', preset)
await sleep(800)
await click('button', 'Analyze')
await waitFor(`!!document.querySelector('.results .stat-value')`)
await sleep(2000)
await js(`document.querySelector('.results').scrollIntoView()`)
await sleep(500)
await shot('10-phone.png')

ws.close()
chrome.kill()
await sleep(500)
rmSync(profile, { recursive: true, force: true })
console.log('done →', out)

import type {
  AnalysisRequest,
  CalendarResponse,
  MetaResponse,
  SummaryResponse,
  TimeseriesResponse,
} from './types'

export const API_URL: string = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true'

export class ApiError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function mock<T>(load: () => Promise<{ default: unknown }>): Promise<T> {
  await delay(300)
  return (await load()).default as T
}

async function errorFrom(res: Response): Promise<ApiError> {
  let detail = `${res.status} ${res.statusText}`
  try {
    const body = await res.json()
    if (body && typeof body.detail === 'string') detail = body.detail
    else if (body && body.detail) detail = JSON.stringify(body.detail)
  } catch {
    /* not JSON; keep status text */
  }
  if (res.status === 413 && !detail) detail = 'Area too large (limit 400,000 km²).'
  return new ApiError(res.status, detail)
}

// The free Render API sleeps when idle. A cold start shows up as a network error or a 502/503/504,
// so we tell the UI and retry every 3 s, up to 3 times.
const RETRIES = 3
const RETRY_MS = 3000
let wakeListener: ((waking: boolean) => void) | null = null
export function onServerWaking(fn: ((waking: boolean) => void) | null): void {
  wakeListener = fn
}

function abortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

async function request(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null
    try {
      res = await fetch(url, init)
    } catch (e) {
      if ((e as Error).name === 'AbortError' || attempt >= RETRIES) {
        wakeListener?.(false)
        if ((e as Error).name === 'AbortError') throw e
        throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
      }
    }
    if (res && ![502, 503, 504].includes(res.status)) {
      wakeListener?.(false)
      if (!res.ok) throw await errorFrom(res)
      return res
    }
    if (attempt >= RETRIES) {
      wakeListener?.(false)
      throw res ? await errorFrom(res) : new ApiError(0, 'Server unavailable.')
    }
    wakeListener?.(true)
    await abortable(RETRY_MS, init.signal ?? undefined)
  }
}

function post(path: string, body: AnalysisRequest, signal?: AbortSignal): Promise<Response> {
  return request(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export async function getCalendar(req: AnalysisRequest, signal?: AbortSignal): Promise<CalendarResponse> {
  if (USE_MOCKS) return mock(() => import('./mocks/calendar.json'))
  return (await post('/calendar', req, signal)).json()
}

export async function getSummary(req: AnalysisRequest, signal?: AbortSignal): Promise<SummaryResponse> {
  if (USE_MOCKS) return mock(() => import('./mocks/summary.json'))
  return (await post('/summary', req, signal)).json()
}

export async function getTimeseries(req: AnalysisRequest, signal?: AbortSignal): Promise<TimeseriesResponse> {
  if (USE_MOCKS) return mock(() => import('./mocks/timeseries.json'))
  return (await post('/timeseries', req, signal)).json()
}

export async function getMeta(signal?: AbortSignal): Promise<MetaResponse> {
  if (USE_MOCKS) return mock(() => import('./mocks/meta.json'))
  return (await request(`${API_URL}/api/meta`, { signal })).json()
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fetches the hotspot CSV and saves it. Returns whether the server truncated it at 200,000 rows. */
export async function downloadHotspotsCsv(req: AnalysisRequest): Promise<{ truncated: boolean }> {
  const filename = `hotspots_${req.start}_${req.end}.csv`
  if (USE_MOCKS) {
    await delay(300)
    const csv =
      'latitude,longitude,acq_date,acq_time,sensor,confidence,frp,daynight,harmonization_k\n' +
      '30.712,75.842,2016-11-02,0812,viirs_snpp,n,12.4,D,\n' +
      '30.455,76.101,2008-10-28,0830,modis_aqua,78,21.7,D,2.61\n'
    saveBlob(new Blob([csv], { type: 'text/csv' }), filename)
    return { truncated: false }
  }
  const res = await post('/hotspots.csv', req)
  const cd = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(cd)
  saveBlob(await res.blob(), match?.[1] ?? filename)
  return { truncated: res.headers.get('X-Truncated') === 'true' }
}

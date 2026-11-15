// Mirrors docs/CONTRACT.md exactly. Change both together.

export type Sensor = 'modis_terra' | 'modis_aqua' | 'viirs_snpp' | 'viirs_noaa20'

export type Source =
  | 'modis_terra_scaled'
  | 'modis_aqua_scaled'
  | 'viirs_snpp'
  | 'viirs_noaa20_scaled'

export type Baseline = 'all' | '2003-2022'

export type Position = [number, number]

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type AoiGeometry = PolygonGeometry | MultiPolygonGeometry

/** Body of every analysis POST. Dates are ISO `YYYY-MM-DD`. */
export interface AnalysisRequest {
  geometry: AoiGeometry
  start: string
  end: string
  baseline: Baseline
}

export type AnomalyLabel = 'unusually high' | 'unusually low' | 'normal' | null

export interface Anomaly {
  pct_of_median: number | null
  robust_z: number | null
  percentile: number | null
  label: AnomalyLabel
}

export interface CalendarCell {
  year: number
  month: number
  value: number
  raw: Partial<Record<Sensor, number>>
  source: Source
  k: number | null
  k_lo: number | null
  k_hi: number | null
  provisional: boolean
  anomaly: Anomaly
}

export interface ClimatologyMonth {
  month: number
  median: number
  q25: number
  q75: number
  p10: number
  p90: number
  min: number
  max: number
  mean: number
}

export interface AnnualTotal {
  year: number
  harmonized: number
  raw_modis: number
  raw_viirs: number
}

export interface AoiInfo {
  area_km2: number
  cells: number
  resolution: 5 | 7
}

export interface CalendarResponse {
  aoi: AoiInfo
  unit: string
  years: number[]
  cells: CalendarCell[]
  climatology: ClimatologyMonth[]
  annual: AnnualTotal[]
}

export interface SummaryResponse {
  peak_month: number
  busiest_year: { year: number; value: number }
  current_month: {
    year: number
    month: number
    value: number
    median: number
    pct_of_median: number | null
    percentile: number | null
    label: AnomalyLabel
    provisional: boolean
  }
  season: { start_month: number; end_month: number; length_months: number }
  total_cell_days: number
}

export interface TimeseriesResponse {
  weekly: { week_start: string; value: number }[]
  ytd: { year: number; doy: number; cum: number }[]
}

export interface SensorCoverage {
  start: string
  end: string
}

export interface NationalFactor {
  kind: 'aqua_to_snpp' | 'terra_to_aqua' | 'n20_to_snpp'
  month: number
  pass: 'D' | 'N'
  k: number
  k_lo: number
  k_hi: number
}

/** `GET /api/meta`: meta.json plus national calibration factors. */
export interface MetaResponse {
  coverage: Partial<Record<Sensor, SensorCoverage>>
  build_time: string
  method_version: string
  national_factors: NationalFactor[]
}

import type { PolygonGeometry, Position } from './types'

// Simplified outlines (a dozen vertices each). Good enough for regional burning
// calendars; not official boundaries.
export interface Preset {
  id: string
  name: string
  note: string
  geometry: PolygonGeometry
}

const poly = (ring: Position[]): PolygonGeometry => ({
  type: 'Polygon',
  coordinates: [[...ring, ring[0]]],
})

export const PRESETS: Preset[] = [
  {
    id: 'punjab',
    name: 'Punjab',
    note: 'Paddy residue burning, Oct–Nov',
    geometry: poly([
      [75.6, 32.5], [75.9, 32.45], [76.2, 31.95], [76.5, 31.5], [76.9, 31.0],
      [76.8, 30.6], [76.3, 30.0], [75.9, 29.6], [75.3, 29.55], [74.5, 29.55],
      [73.9, 30.05], [74.1, 30.45], [74.5, 30.95], [74.55, 31.45], [74.6, 31.85],
      [75.05, 32.05], [75.35, 32.3],
    ]),
  },
  {
    id: 'haryana',
    name: 'Haryana',
    note: 'Paddy residue burning, Oct–Nov',
    geometry: poly([
      [76.85, 30.9], [77.45, 30.45], [77.55, 29.6], [77.15, 28.85], [77.45, 28.25],
      [77.2, 27.75], [76.6, 27.8], [76.2, 28.15], [75.4, 28.75], [74.5, 29.15],
      [74.6, 29.85], [75.25, 29.6], [75.9, 29.95], [76.45, 30.4],
    ]),
  },
  {
    id: 'odisha',
    name: 'Odisha',
    note: 'Forest fires, Feb–May',
    geometry: poly([
      [81.4, 17.8], [82.3, 18.3], [83.5, 18.8], [84.75, 19.1], [85.9, 19.8],
      [86.75, 20.4], [87.45, 21.5], [86.95, 22.05], [86.05, 22.45], [85.0, 22.35],
      [84.0, 22.55], [83.05, 22.1], [82.4, 21.3], [82.35, 20.3], [81.95, 19.6], [81.4, 18.7],
    ]),
  },
  {
    id: 'mizoram',
    name: 'Mizoram',
    note: 'Shifting cultivation (jhum), Mar–Apr',
    geometry: poly([
      [92.3, 24.15], [92.75, 24.5], [93.1, 24.25], [93.35, 23.9], [93.45, 23.1],
      [93.2, 22.45], [92.95, 21.95], [92.6, 21.95], [92.45, 22.6], [92.3, 23.3],
    ]),
  },
  {
    id: 'madhya-pradesh',
    name: 'Madhya Pradesh',
    note: 'Wheat residue Apr–May, forest fires Mar–May',
    geometry: poly([
      [74.05, 22.6], [74.6, 23.7], [75.15, 24.6], [75.8, 25.0], [77.2, 25.05],
      [77.9, 26.7], [78.9, 26.85], [79.5, 25.25], [80.6, 25.2], [81.6, 24.9],
      [82.6, 24.35], [82.75, 23.35], [81.6, 22.5], [80.6, 21.65], [79.0, 21.55],
      [77.5, 21.35], [76.2, 21.15], [74.6, 21.6],
    ]),
  },
]

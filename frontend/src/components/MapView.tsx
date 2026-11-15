import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { PolygonGeometry, Position } from '../types'

// MapLibre v6 runs its tile worker from a separate file; point it at the bundled copy.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const FALLBACK_STYLE_URL = 'https://demotiles.maplibre.org/style.json'
const INDIA_CENTER: [number, number] = [78.9, 22.5]
const AOI_COLOR = '#d9480f'

export type DrawMode = 'polygon' | 'rectangle'

export interface MapHandle {
  startDraw: (mode: DrawMode) => void
  cancelDraw: () => void
  getCenter: () => { lat: number; lon: number }
}

interface Props {
  ref?: Ref<MapHandle>
  aoi: PolygonGeometry | null
  /** Changing this number fits the map to the AOI. */
  fitKey: number
  onDrawn: (geometry: PolygonGeometry) => void
  onDrawingChange?: (mode: DrawMode | null) => void
}

const emptyFC = { type: 'FeatureCollection' as const, features: [] }

function boundsOf(g: PolygonGeometry): LngLatBoundsLike {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  for (const [x, y] of g.coordinates[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return [[minX, minY], [maxX, maxY]]
}

export default function MapView({ ref, aoi, fitKey, onDrawn, onDrawingChange }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const aoiRef = useRef(aoi)
  const cb = useRef({ onDrawn, onDrawingChange })
  cb.current = { onDrawn, onDrawingChange }
  aoiRef.current = aoi

  const setAoiData = (map: maplibregl.Map, g: PolygonGeometry | null) => {
    const src = map.getSource('aoi') as GeoJSONSource | undefined
    src?.setData(g ? { type: 'Feature', properties: {}, geometry: g } : emptyFC)
  }

  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: INDIA_CENTER,
      zoom: 4,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    let usedFallback = false
    map.on('error', () => {
      if (!usedFallback && !map.isStyleLoaded()) {
        usedFallback = true
        map.setStyle(FALLBACK_STYLE_URL)
      }
    })

    // (Re)add our AOI layers whenever a style finishes loading.
    map.on('style.load', () => {
      if (!map.getSource('aoi')) map.addSource('aoi', { type: 'geojson', data: emptyFC })
      if (!map.getLayer('aoi-fill'))
        map.addLayer({ id: 'aoi-fill', type: 'fill', source: 'aoi', paint: { 'fill-color': AOI_COLOR, 'fill-opacity': 0.12 } })
      if (!map.getLayer('aoi-line'))
        map.addLayer({ id: 'aoi-line', type: 'line', source: 'aoi', paint: { 'line-color': AOI_COLOR, 'line-width': 2 } })
      setAoiData(map, aoiRef.current)

      if (!drawRef.current) {
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new TerraDrawPolygonMode({
              styles: { fillColor: AOI_COLOR, outlineColor: AOI_COLOR, fillOpacity: 0.15, closingPointColor: AOI_COLOR },
            }),
            new TerraDrawRectangleMode({
              styles: { fillColor: AOI_COLOR, outlineColor: AOI_COLOR, fillOpacity: 0.15 },
            }),
          ],
        })
        draw.start()
        draw.on('finish', (id) => {
          const f = draw.getSnapshotFeature(id)
          if (f && f.geometry.type === 'Polygon') {
            cb.current.onDrawn({ type: 'Polygon', coordinates: f.geometry.coordinates as Position[][] })
          }
          // Our own 'aoi' layer shows the result; reset the drawing layer.
          setTimeout(() => {
            draw.clear()
            draw.setMode('static')
            cb.current.onDrawingChange?.(null)
          }, 0)
        })
        drawRef.current = draw
      }
    })

    return () => {
      drawRef.current?.stop()
      drawRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    // Don't gate on isStyleLoaded(): it is false while tiles stream in. If our source exists, update it;
    // otherwise the 'style.load' handler adds it with the latest AOI.
    if (map?.getSource('aoi')) setAoiData(map, aoi)
  }, [aoi])

  useEffect(() => {
    const map = mapRef.current
    if (map && fitKey > 0 && aoiRef.current) {
      map.fitBounds(boundsOf(aoiRef.current), { padding: 40, maxZoom: 10, duration: 800 })
    }
  }, [fitKey])

  useImperativeHandle(ref, () => ({
    startDraw(mode) {
      const draw = drawRef.current
      if (!draw) return
      draw.clear()
      draw.setMode(mode)
      cb.current.onDrawingChange?.(mode)
    },
    cancelDraw() {
      const draw = drawRef.current
      if (!draw) return
      draw.clear()
      draw.setMode('static')
      cb.current.onDrawingChange?.(null)
    },
    getCenter() {
      const c = mapRef.current?.getCenter() ?? { lat: INDIA_CENTER[1], lng: INDIA_CENTER[0] }
      return { lat: c.lat, lon: c.lng }
    },
  }))

  return (
    <div
      ref={container}
      className="map"
      role="region"
      aria-label="Map of India. Use the panel to draw or choose an area."
    />
  )
}

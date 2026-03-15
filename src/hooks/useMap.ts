import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface UseMapOptions {
  container: React.RefObject<HTMLDivElement | null>
  /** 初始中心点 [lng, lat] */
  center?: [number, number]
  zoom?: number
  /** 使用离线协议时传入 'map-data://tiles/{z}/{x}/{y}.pbf'，否则使用线上 OSM */
  tileUrl?: string
}

interface UseMapReturn {
  map: React.MutableRefObject<maplibregl.Map | null>
  flyTo: (lng: number, lat: number, zoom?: number) => void
  addMarker: (id: string, lng: number, lat: number, color?: string, onClick?: () => void) => void
  removeMarker: (id: string) => void
  resetNorth: () => void
  getMarkerIds: () => string[]
}

// 默认使用 OpenFreeMap Bright 样式（免费在线 OSM 矢量底图）
const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export function useMap({
  container,
  center = [116.3912, 39.9073], // 北京天安门，兜底坐标
  zoom = 12,
  tileUrl,
}: UseMapOptions): UseMapReturn {
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map())

  useEffect(() => {
    if (!container.current || map.current) return

    const styleUrl = tileUrl
      ? buildOfflineStyle(tileUrl)
      : DEFAULT_STYLE

    map.current = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: false,
    })

    // 微动效：地图加载完成后短暂 fade-in
    map.current.once('load', () => {
      if (!container.current) return
      container.current.style.opacity = '0'
      container.current.style.transition = 'opacity 400ms ease'
      // 强制 reflow
      void container.current.offsetHeight
      container.current.style.opacity = '1'
    })

    return () => {
      map.current?.remove()
      map.current = null
      markers.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flyTo = useCallback((lng: number, lat: number, zoom = 15) => {
    map.current?.flyTo({ center: [lng, lat], zoom, duration: 800 })
  }, [])

  const addMarker = useCallback(
    (id: string, lng: number, lat: number, color = '#3B82F6', onClick?: () => void) => {
      if (!map.current) return
      // 移除已有同 id 的 marker
      markers.current.get(id)?.remove()

      const el = document.createElement('div')
      el.className = 'poi-marker-container'
      el.style.width = '32px'
      el.style.height = '32px'
      
      const inner = document.createElement('div')
      const svgColor = encodeURIComponent(color)
      const svgIcon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${svgColor}" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 15.007 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3" fill="%23ffffff"/></svg>`
      
      inner.style.cssText = `
        width: 100%; height: 100%;
        background-image: url('${svgIcon}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center bottom;
        cursor: pointer;
        transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-origin: bottom center;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
      `
      el.appendChild(inner)

      el.onmouseenter = () => { inner.style.transform = 'scale(1.2)' }
      el.onmouseleave = () => { inner.style.transform = 'scale(1)' }
      if (onClick) {
        el.onclick = (e) => {
          e.stopPropagation()
          onClick()
        }
      }

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map.current)

      markers.current.set(id, marker)
    },
    []
  )

  const removeMarker = useCallback((id: string) => {
    markers.current.get(id)?.remove()
    markers.current.delete(id)
  }, [])

  const resetNorth = useCallback(() => {
    map.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 })
  }, [])

  const getMarkerIds = useCallback(() => Array.from(markers.current.keys()), [])

  return { map, flyTo, addMarker, removeMarker, resetNorth, getMarkerIds }
}

// ── 离线底图 Style 构建 ───────────────────────────────────
function buildOfflineStyle(tileUrl: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sprite: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
    sources: {
      'offline-osm': {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: 0,
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f4f0' },
      },
    ],
  }
}

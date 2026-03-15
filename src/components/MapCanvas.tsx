import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { Compass, Layers, LocateFixed, Plus } from 'lucide-react'
import { useMap } from '../hooks/useMap'
import { useGeolocation } from '../hooks/useGeolocation'
import './MapCanvas.css'

interface MapCanvasProps {
  onAddPoi?: (lng: number, lat: number) => void
}

export function MapCanvas({ onAddPoi }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { map, flyTo, resetNorth } = useMap({ container: containerRef })
  const { position, isLocating, locate } = useGeolocation()

  // 首次定位成功后，跳转地图到用户位置
  useEffect(() => {
    if (position && map.current) {
      flyTo(position.lng, position.lat, 14)
    }
  }, [position, flyTo, map])

  // 定位按钮处理
  const handleLocate = async () => {
    const pos = await locate()
    if (pos) flyTo(pos.lng, pos.lat, 16)
  }

  // 长按地图添加 POI（桌面用 dblclick 模拟）
  useEffect(() => {
    const m = map.current
    if (!m) return

    const handleLongPress = (e: maplibregl.MapMouseEvent) => {
      onAddPoi?.(e.lngLat.lng, e.lngLat.lat)
    }

    m.on('dblclick', handleLongPress)
    return () => { m.off('dblclick', handleLongPress) }
  }, [map, onAddPoi])

  const handleFabClick = () => {
    if (position) {
      onAddPoi?.(position.lng, position.lat)
    } else {
      // 未获取到位置时，使用地图当前中心
      const center = map.current?.getCenter()
      if (center) onAddPoi?.(center.lng, center.lat)
    }
  }

  return (
    <div className="map-canvas-root">
      {/* 底图容器 */}
      <div ref={containerRef} className="map-container" />

      {/* 顶部搜索栏 */}
      <div className="map-search-bar">
        <input
          id="map-search-input"
          className="search-input"
          placeholder="搜索点位 / 备注…"
          readOnly
          onClick={() => {/* TODO: 打开搜索页 */}}
        />
        <div className="avatar-btn" id="avatar-btn">
          <span>G</span>
        </div>
      </div>

      {/* 右侧工具链 */}
      <div className="map-tool-chain">
        <button id="btn-layers" className="icon-btn" aria-label="图层切换" title="底图图层">
          <Layers size={18} />
        </button>
        <button
          id="btn-compass"
          className="icon-btn"
          aria-label="重置朝向"
          title="重置朝向"
          onClick={resetNorth}
        >
          <Compass size={18} />
        </button>
      </div>

      {/* 右下角核心操作区 */}
      <div className="map-bottom-right">
        <button
          id="btn-locate"
          className={`icon-btn locate-btn ${isLocating ? 'locating' : ''}`}
          aria-label="回到当前位置"
          title="回到当前位置"
          onClick={handleLocate}
        >
          <LocateFixed size={18} />
        </button>

        <button
          id="btn-add-poi"
          className="fab"
          aria-label="新增 POI"
          title="新增地点"
          onClick={handleFabClick}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}

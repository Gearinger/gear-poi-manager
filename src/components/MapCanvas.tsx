import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { Compass, Layers, LocateFixed, Plus } from 'lucide-react'
import { useMap } from '../hooks/useMap'
import { useGeolocation } from '../hooks/useGeolocation'
import type { Poi } from '../lib/database.types'
import './MapCanvas.css'

interface MapCanvasProps {
  pois?: Poi[]
  onAddPoi?: (lng: number, lat: number) => void
  onPoiClick?: (poi: Poi) => void
}

export function MapCanvas({ pois = [], onAddPoi, onPoiClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { map, flyTo, addMarker, resetNorth } = useMap({ container: containerRef })
  const { position, isLocating, locate } = useGeolocation()

  // 同步渲染 POI
  useEffect(() => {
    if (!map.current) return
    
    // 简单粗暴先清理，实际场景可能会做 diff 优化
    // 这里依赖 useMap 的 `addMarker` 自动覆盖同 id marker，我们直接遍历添加即可
    pois.forEach(poi => {
      // 颜色根据 category 返回个伪随机或固定色
      const color = poi.category === 'food' ? '#F59E0B' 
                  : poi.category === 'photo' ? '#10B981'
                  : poi.category === 'todo' ? '#EF4444' 
                  : '#3B82F6'

      addMarker(poi.id, poi.lng, poi.lat, color, () => {
        onPoiClick?.(poi)
      })
    })
  }, [pois, addMarker, onPoiClick, map])

  // 首次定位成功后，跳转地图到用户位置
  useEffect(() => {
    if (position && map.current) {
      flyTo(position.lng, position.lat, 14)
    }
  }, [position, flyTo, map])

  // 定位按钮处理
  const handleLocate = async () => {
    if (position) {
      flyTo(position.lng, position.lat, 16)
    }
    const pos = await locate()
    if (pos) {
      flyTo(pos.lng, pos.lat, 16)
    } else {
      alert('获取真实位置失败，请检查系统定位权限和设备 GPS 开关。')
    }
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

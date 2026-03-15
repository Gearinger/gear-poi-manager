import { useRef, useEffect, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { Compass, Layers, LocateFixed, Plus, Search, MapPin } from 'lucide-react'
import { useMap } from '../hooks/useMap'
import { useGeolocation } from '../hooks/useGeolocation'
import type { Poi } from '../lib/database.types'
import './MapCanvas.css'

interface MapCanvasProps {
  pois?: Poi[]
  onAddPoi?: (lng: number, lat: number) => void
  onPoiClick?: (poi: Poi) => void
  isPicking?: boolean
  onPickConfirm?: (lng: number, lat: number) => void
  onPickCancel?: () => void
}

export function MapCanvas({ 
  pois = [], 
  onAddPoi, 
  onPoiClick, 
  isPicking, 
  onPickConfirm, 
  onPickCancel 
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { map, flyTo, addMarker, removeMarker, getMarkerIds, resetNorth } = useMap({ container: containerRef })
  const { position, isLocating, locate } = useGeolocation()

  const [searchKey, setSearchKey] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // 搜索过滤
  const searchResults = useMemo(() => {
    if (!searchKey.trim()) return []
    const kw = searchKey.toLowerCase()
    return pois.filter(p => 
      p.name.toLowerCase().includes(kw) || 
      (p.notes || '').toLowerCase().includes(kw)
    )
  }, [searchKey, pois])

  // 同步渲染 POI 和清理被删除的 POI
  useEffect(() => {
    if (!map.current) return
    
    const newIds = new Set<string>()

    pois.forEach(poi => {
      newIds.add(poi.id)
      const color = poi.category === 'food' ? '#F59E0B' 
                  : poi.category === 'photo' ? '#10B981'
                  : poi.category === 'todo' ? '#EF4444' 
                  : '#3B82F6'

      addMarker(poi.id, poi.lng, poi.lat, color, () => {
        onPoiClick?.(poi)
      })
    })

    // 对比当前存在的 IDs，清理已经被删掉的点位
    const existingIds = getMarkerIds()
    existingIds.forEach(eid => {
      if (!newIds.has(eid)) {
        removeMarker(eid)
      }
    })
  }, [pois, addMarker, removeMarker, getMarkerIds, onPoiClick, map])

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

      {/* 拾取模式特有：屏幕中心十字准星 */}
      {isPicking && (
        <div className="map-picking-crosshair">
          <div className="crosshair-v" />
          <div className="crosshair-h" />
          <div className="crosshair-center">
            <MapPin size={28} color="var(--color-primary)" fill="#ffffff" />
          </div>
        </div>
      )}

      {/* 顶部栏（平常是搜索框，选点模式变为提示） */}
      {!isPicking ? (
        <div className="map-search-bar-wrapper">
          <div className="map-search-bar">
            <Search size={18} className="search-icon" />
            <input
              id="map-search-input"
              className="search-input"
              placeholder="搜索点位 / 备注…"
              value={searchKey}
              onChange={e => {
                setSearchKey(e.target.value)
                if (!isSearchOpen) setIsSearchOpen(true)
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            <div className="avatar-btn" id="avatar-btn">
              <span>G</span>
            </div>
          </div>

          {/* 搜索结果下拉面板 */}
          {isSearchOpen && searchKey.trim() && (
            <div className="search-results-panel">
              {searchResults.length === 0 ? (
                <div className="search-results-empty">无匹配结果</div>
              ) : (
                searchResults.map(poi => (
                  <div 
                    key={poi.id} 
                    className="search-result-item"
                    onClick={() => {
                      flyTo(poi.lng, poi.lat, 16)
                      onPoiClick?.(poi)
                      setIsSearchOpen(false)
                      setSearchKey('')
                    }}
                  >
                    <div className="search-result-title">{poi.name}</div>
                    <div className="search-result-desc">{poi.notes || '无备注'}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="map-picking-header">
           拖动地图选择准确位置
        </div>
      )}

      {/* 点击空白处关闭搜索面板 */}
      {isSearchOpen && !isPicking && (
        <div 
          className="search-mask" 
          onClick={() => setIsSearchOpen(false)}
        />
      )}

      {/* 右侧工具链 (选点时隐藏) */}
      {!isPicking && (
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
      )}

      {/* 底部浮动区 (根据模式展示不同操作) */}
      {isPicking ? (
        <div className="map-picking-actions">
          <button className="picking-action-btn secondary" onClick={onPickCancel}>
            取消
          </button>
          <button 
            className="picking-action-btn primary" 
            onClick={() => {
              const center = map.current?.getCenter()
              if (center) onPickConfirm?.(center.lng, center.lat)
            }}
          >
            确认当前坐标
          </button>
        </div>
      ) : (
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
      )}
    </div>
  )
}

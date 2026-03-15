import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { MapCanvas } from './components/MapCanvas'
import { AuthPage } from './components/AuthPage'
import { useAuth } from './hooks/useAuth'
import { poiService } from './lib/poiService'
import { BottomSheet } from './components/BottomSheet'
import { PoiForm } from './components/PoiForm'
import { PoiDetail } from './components/PoiDetail'
import { SettingsForm } from './components/SettingsForm' // Added import
import type { Poi } from './lib/database.types'
import './index.css'

function App() {
  const auth = useAuth()
  
  // 选择点位进行添加时的坐标状态（有值则打开底边栏表单）
  const [addingPos, setAddingPos] = useState<{ lng: number; lat: number } | null>(null)
  // 点击已有点位时的查看状态
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)

  // 是否显示设置界面
  const [showSettings, setShowSettings] = useState(false) // Added state

  // 是否正在地图上重选坐标
  const [isPickingLocation, setIsPickingLocation] = useState(false)

  // 获取 POI 列表数据（依赖于用户登录）
  const { data: pois = [] } = useQuery({
    queryKey: ['pois', auth.user?.id],
    queryFn: poiService.getPois,
    enabled: !!auth.user, // 只有在登录状态下才去请求
  })

  // 初次检查会话时，显示空白避免闪烁
  if (auth.isLoading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #EFF6FF, #F5F3FF)',
      }} />
    )
  }

  // 未登录 → 认证页
  if (!auth.user) {
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <AuthPage {...auth} onSubmit={auth.submit} onSetMode={auth.setMode} onEmailChange={auth.setEmail} onPasswordChange={auth.setPassword} />
      </div>
    )
  }

  // 已登录 → 地图主页
  const handleAddPoi = (lng: number, lat: number) => {
    setSelectedPoi(null)
    setAddingPos({ lng, lat })
  }

  const handlePoiClick = (poi: Poi) => {
    setAddingPos(null)
    setSelectedPoi(poi)
  }

  const closeBottomSheet = () => {
    setAddingPos(null)
    setSelectedPoi(null)
    setShowSettings(false)
  }

  // 调用地图导航 (Google Maps 或高德 Web URL，如果在移动端可以用 tauri-plugin-opener 打开具体 app 的 scheme)
  const handleNavigate = async (lng: number, lat: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    await openUrl(url)
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MapCanvas 
        pois={pois} 
        onAddPoi={handleAddPoi} 
        onPoiClick={handlePoiClick} 
        onSettingsClick={() => setShowSettings(true)}
        isPicking={isPickingLocation}
        onPickConfirm={(lng, lat) => {
          setAddingPos({ lng, lat })
          setIsPickingLocation(false)
        }}
        onPickCancel={() => setIsPickingLocation(false)}
      />
      
      {/* 底部滑块，可能是新增，也可能是展示详情 */}
      {/* 若处于重选坐标模式，则视觉上暂时隐藏底窗（但不卸载组件保留状态） */}
      <div style={{ display: isPickingLocation ? 'none' : 'block' }}>
        <BottomSheet isOpen={!!addingPos || !!selectedPoi || showSettings} onClose={closeBottomSheet}>
          {addingPos && (
            <PoiForm 
              initialLng={addingPos.lng} 
              initialLat={addingPos.lat} 
              onClose={closeBottomSheet} 
              onStartPicking={() => setIsPickingLocation(true)}
            />
          )}
          {selectedPoi && (
            <PoiDetail
                poi={selectedPoi}
                onClose={closeBottomSheet}
                onNavigate={handleNavigate}
            />
          )}
          {showSettings && (
            <SettingsForm onClose={closeBottomSheet} />
          )}
        </BottomSheet>
      </div>
    </div>
  )
}

export default App

import './index.css'
import { MapCanvas } from './components/MapCanvas'
import { AuthPage } from './components/AuthPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const auth = useAuth()

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
        <AuthPage
          mode={auth.mode}
          onSetMode={auth.setMode}
          email={auth.email}
          onEmailChange={auth.setEmail}
          password={auth.password}
          onPasswordChange={auth.setPassword}
          error={auth.error}
          isSubmitting={auth.isSubmitting}
          onSubmit={auth.submit}
        />
      </div>
    )
  }

  // 已登录 → 地图主页
  const handleAddPoi = (lng: number, lat: number) => {
    // TODO: 打开 POI 录入表单，传入初始坐标
    console.log('Add POI at', lng, lat)
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MapCanvas onAddPoi={handleAddPoi} />
    </div>
  )
}

export default App

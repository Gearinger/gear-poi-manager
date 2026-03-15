import { useState, useEffect } from 'react'
import { Save, X, Key, Info } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { poiService } from '../lib/poiService'
import './SettingsForm.css'

interface SettingsFormProps {
  onClose: () => void
}

export function SettingsForm({ onClose }: SettingsFormProps) {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: poiService.getSettings,
  })

  useEffect(() => {
    if (settings?.imgbbApiKey) {
      setApiKey(settings.imgbbApiKey)
    }
  }, [settings])

  const { mutate, isPending } = useMutation({
    mutationFn: poiService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      alert('设置已保存')
      onClose()
    },
    onError: (err: any) => {
      alert(err.message || '保存失败')
    }
  })

  const handleSave = () => {
    mutate(apiKey)
  }

  if (isLoading) return <div className="settings-loading">加载中...</div>

  return (
    <div className="settings-form-root">
      <div className="settings-header">
        <button className="icon-btn-text" onClick={onClose}>
          <X size={20} />
        </button>
        <span className="settings-title">系统设置</span>
        <button 
          className="icon-btn-text icon-btn-text--primary" 
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? '保存中...' : <Save size={20} />}
        </button>
      </div>

      <div className="settings-body">
        <section className="settings-section">
          <label className="settings-label">
            <Key size={16} />
            ImgBB API Key
          </label>
          <input
            className="settings-input"
            type="password"
            placeholder="在此输入您的 API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <div className="settings-hint">
            <Info size={12} />
            <span>用于存储 POI 照片。请前往 <a href="https://imgbb.com/signup" target="_blank" rel="noreferrer">ImgBB</a> 注册获取。</span>
          </div>
        </section>

        <section className="settings-section">
          <h3>关于</h3>
          <p>Gear POI Manager v0.1.0</p>
          <p>离线地图、快速记点、图片同步。</p>
        </section>
      </div>
    </div>
  )
}

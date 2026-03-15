import { useState } from 'react'
import { Camera, MapPin } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { poiService } from '../lib/poiService'
import './PoiForm.css'

const CATEGORIES = [
  { id: 'food', label: '美食', emoji: '🍔' },
  { id: 'photo', label: '出片', emoji: '📸' },
  { id: 'todo', label: '待办', emoji: '📌' },
  { id: 'life', label: '日常', emoji: '☕' },
]

interface PoiFormProps {
  initialLng: number
  initialLat: number
  onClose: () => void
  onSuccess?: () => void
  onStartPicking?: () => void
}

export function PoiForm({ initialLng, initialLat, onClose, onSuccess, onStartPicking }: PoiFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('photo')
  const [notes, setNotes] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // 获取用户设置（主要为了 API Key）
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: poiService.getSettings,
  })
  
  // 提交 Mutate
  const { mutate, isPending } = useMutation({
    mutationFn: poiService.addPoi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois'] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      alert(err.message || '保存失败！')
    }
  })

  // H5 标准拍照 / 相册选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setPendingFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsUploading(true)
    try {
      let finalUrls: string[] = []
      
      // 如果有待上传图片且配置了 API Key，则先上传
      if (pendingFile && settings?.imgbbApiKey) {
        try {
          const remoteUrl = await poiService.uploadImage(pendingFile, settings.imgbbApiKey)
          finalUrls = [remoteUrl]
        } catch (uploadErr) {
          console.error('Upload failed, falling back to no image:', uploadErr)
          if (!confirm('图片上传失败，是否继续保存文字内容？')) {
             setIsUploading(false)
             return
          }
        }
      } else if (pendingFile && !settings?.imgbbApiKey) {
        alert('未配置 ImgBB API Key，图片将不会被保存。请在设置中配置。')
      }

      mutate({
        name,
        lng: initialLng,
        lat: initialLat,
        category,
        notes,
        imgUrls: finalUrls
      })
    } finally {
      setIsUploading(false)
    }
  }

  const isSaving = isPending || isUploading

  return (
    <div className="poi-form-root">
      <div className="poi-form-header">
        <button type="button" className="icon-btn-text" onClick={onClose} disabled={isSaving}>
          取消
        </button>
        <span className="poi-form-title">记录新地点</span>
        <button 
          type="button" 
          className="icon-btn-text icon-btn-text--primary" 
          onClick={handleSubmit} 
          disabled={!name.trim() || isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="poi-form-body">
        {/* 图片采集区 (W3C Capture) */}
        <label className="poi-image-picker" htmlFor="poi-camera-input">
          {imagePreview ? (
            <img src={imagePreview} alt="预览" className="poi-image-preview" />
          ) : (
            <div className="poi-image-picker-placeholder">
              <Camera size={28} />
              <span>拍摄或选择照片</span>
            </div>
          )}
          <input
            id="poi-camera-input"
            type="file"
            accept="image/*"
            capture="environment" /* 移动端唤起相机 */
            onChange={handleFileChange}
            hidden
          />
        </label>

        {/* 字段区 */}
        <div className="poi-field">
          <input
            className="poi-input-title"
            placeholder="地点名称（必填）"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isSaving}
            autoFocus
          />
        </div>

        <div className="poi-field">
          <div className="poi-chip-group">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                className={`poi-chip ${category === c.id ? 'poi-chip--active' : ''}`}
                onClick={() => setCategory(c.id)}
                disabled={isSaving}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="poi-field">
          <textarea
            className="poi-textarea"
            placeholder="写点什么..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="poi-coord">
          <MapPin size={14} />
          <span>{initialLng.toFixed(6)}, {initialLat.toFixed(6)}</span>
          {onStartPicking && (
            <button type="button" className="poi-coord-btn" onClick={onStartPicking}>
              在地图上选点
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

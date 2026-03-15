import { Trash2, Navigation } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Poi } from '../lib/database.types'
import { poiService } from '../lib/poiService'
import './PoiDetail.css'

interface PoiDetailProps {
  poi: Poi
  onClose: () => void
  onNavigate: (lng: number, lat: number) => void
}

export function PoiDetail({ poi, onClose, onNavigate }: PoiDetailProps) {
  const queryClient = useQueryClient()

  // 删除 Mutate
  const { mutate: deleteMutate, isPending } = useMutation({
    mutationFn: poiService.deletePoi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois'] })
      onClose()
    },
    onError: (err: any) => {
      alert(err.message || '删除失败！')
    }
  })

  const handleDelete = () => {
    if (window.confirm('确定要删除这个点位吗？')) {
      deleteMutate(poi.id)
    }
  }

  const handleNavigate = () => {
    onNavigate(poi.lng, poi.lat)
  }

  const categoryLabel = {
    food: '美食',
    photo: '出片',
    todo: '待办',
    life: '日常',
  }[poi.category || ''] || '未知'

  const dateStr = new Date(poi.createdAt).toLocaleDateString()

  return (
    <div className="poi-detail-root">
      <div className="poi-detail-header">
        <h2 className="poi-detail-title">{poi.name}</h2>
        <button 
          className="poi-detail-nav-btn" 
          onClick={handleNavigate}
        >
          <Navigation size={14} />
          导航
        </button>
      </div>

      {poi.imgUrls && poi.imgUrls.length > 0 && (
        <div className="poi-detail-images">
          {poi.imgUrls.map((url, i) => (
            <img key={i} src={url} alt={`照片 ${i+1}`} />
          ))}
        </div>
      )}

      <div className="poi-detail-meta">
        <span className="poi-detail-tag">{categoryLabel}</span>
        <span className="poi-detail-date">{dateStr}</span>
      </div>

      {poi.notes && (
        <div className="poi-detail-notes">
          {poi.notes}
        </div>
      )}

      <div className="poi-detail-actions">
        <button className="poi-detail-del-btn" onClick={handleDelete} disabled={isPending}>
          <Trash2 size={16} />
          {isPending ? '删除中...' : '删除此地点'}
        </button>
      </div>
    </div>
  )
}

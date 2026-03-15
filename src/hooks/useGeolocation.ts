import { useState, useCallback, useEffect } from 'react'
import {
  getCurrentPosition,
  type Position,
} from '@tauri-apps/plugin-geolocation'

interface UseGeolocationReturn {
  position: { lng: number; lat: number } | null
  error: string | null
  isLocating: boolean
  locate: () => Promise<{ lng: number; lat: number } | null>
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<{ lng: number; lat: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  const locate = useCallback(async () => {
    setIsLocating(true)
    setError(null)
    try {
      const pos: Position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
      const result = {
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
      }
      setPosition(result)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : '无法获取位置，请检查定位权限'
      setError(msg)
      return null
    } finally {
      setIsLocating(false)
    }
  }, [])

  // 组件挂载时自动定位一次
  useEffect(() => {
    locate()
  }, [locate])

  return { position, error, isLocating, locate }
}

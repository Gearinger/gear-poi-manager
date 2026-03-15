import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  getCurrentPosition,
  checkPermissions,
  requestPermissions,
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
      // 1. 尝试检查并请求权限（桌面端等平台可能不支持权限API并抛出异常，忽略之）
      try {
        let perm = await checkPermissions()
        if (perm.location !== 'granted') {
          perm = await requestPermissions(['location', 'coarseLocation'])
          if (perm.location !== 'granted') {
            console.warn('[Geolocation] 定位权限被拒绝，可能导致原生定位失败')
          }
        }
      } catch (permErr) {
        console.warn('[Geolocation] 权限检查API不可用，直接尝试获取位置:', permErr)
      }

      // 2. 尝试原生设备定位
      let result: { lng: number; lat: number } | null = null
      try {
        const pos: Position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
        result = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        }
      } catch (nativeErr) {
        console.warn('[Geolocation] 原生定位失败（可能无硬件或系统拦截），尝试基于 IP 的粗略定位兜底:', nativeErr)
        
        // 3. 原生失败后，托底方案：通过 Tauri Rust Proxy 获取近似位置 (绕过 CORS)
        try {
          const data = await invoke<{ longitude: number; latitude: number }>('get_ip_location')
          if (data && data.latitude && data.longitude) {
            result = {
              lng: data.longitude,
              lat: data.latitude,
            }
            console.log('[Geolocation] 成功通过 Rust Proxy 获取 IP 兜底位置:', result)
          }
        } catch (proxyErr) {
          throw new Error('原生定位和 IP 粗略定位均失败: ' + proxyErr)
        }
      }

      if (result) {
        setPosition(result)
        return result
      }
      return null
    } catch (err) {
      console.error('[Geolocation Error]:', err)
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

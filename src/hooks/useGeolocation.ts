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

    // 环境检查
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    let gpsResult: { lng: number; lat: number } | null = null

    // 1. 定义 IP 定位任务 (快 - 仅在 Tauri 模式下通过 Rust 请求绕过跨域)
    const getIpLocationTask = async () => {
      if (!isTauri) return null;
      try {
        const data = await invoke<{ longitude: number; latitude: number }>('get_ip_location')
        if (data && data.latitude && data.longitude) {
          const res = { lng: data.longitude, lat: data.latitude }
          if (!gpsResult) {
            console.log('[Geolocation] 优先获取到 IP 位置:', res)
            setPosition(res)
          }
          return res
        }
      } catch (e) {
        console.warn('[Geolocation] IP 定位失败:', e)
      }
      return null
    }

    // 2. 定义 GPS/原生定位任务 (慢但准)
    const getGpsLocationTask = async () => {
      try {
        // Tauri 环境下使用插件，浏览器环境下使用原生 navigator
        if (isTauri) {
          try {
            let perm = await checkPermissions()
            if (perm.location !== 'granted') {
              await requestPermissions(['location', 'coarseLocation'])
            }
          } catch (e) { /* ignore */ }

          const pos: Position = await getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
          gpsResult = { lng: pos.coords.longitude, lat: pos.coords.latitude }
        } else {
          // 浏览器标准 fallback
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            })
          })
          gpsResult = { lng: pos.coords.longitude, lat: pos.coords.latitude }
        }

        if (gpsResult) {
          console.log('[Geolocation] 成功获取高精度位置:', gpsResult)
          setPosition(gpsResult)
          return gpsResult
        }
      } catch (e) {
        console.warn('[Geolocation] 原生/GPS 定位失败:', e)
      }
      return null
    }

    // 并发执行，IP 通常秒回
    const results = await Promise.all([getIpLocationTask(), getGpsLocationTask()])
    setIsLocating(false)

    // 返回最后的最优结果
    const finalPos = results[1] || results[0]
    if (!finalPos) {
      setError('无法获取您的位置信息')
    }
    return finalPos
  }, [])

  // 组件挂载时自动定位一次
  useEffect(() => {
    locate()
  }, [locate])

  return { position, error, isLocating, locate }
}

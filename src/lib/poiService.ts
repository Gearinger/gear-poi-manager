import { supabase } from './supabase'
import type { Database, Poi } from './database.types'

type PoiRow = Database['public']['Tables']['pois']['Row']
type PoiInsert = Database['public']['Tables']['pois']['Insert']

// 解析 PostGIS EWKB Point 为经纬度
function parseWkbPoint(hex: string): { lng: number; lat: number } {
  if (!hex || hex.length < 42) return { lng: 0, lat: 0 }
  const buf = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map((h) => parseInt(h, 16))).buffer
  const view = new DataView(buf)
  const isLittleEndian = view.getUint8(0) === 1
  // Point 类型的坐标通常在最后的 16 字节
  const offset = buf.byteLength - 16
  const lng = view.getFloat64(offset, isLittleEndian)
  const lat = view.getFloat64(offset + 8, isLittleEndian)
  return { lng, lat }
}

// 转换 Row 到前端 DTO
function mapRowToPoi(row: PoiRow): Poi {
  const { lng, lat } = parseWkbPoint(row.location)
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    lng,
    lat,
    category: row.category,
    imgUrls: row.img_urls,
    notes: row.notes,
    properties: row.properties,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const poiService = {
  async getPois() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not logged in')

    const { data, error } = await supabase
      .from('pois')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapRowToPoi)
  },

  async addPoi(params: {
    name: string
    lng: number
    lat: number
    category?: string | null
    notes?: string | null
    imgUrls?: string[]
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not logged in')

    const insertData: PoiInsert = {
      user_id: user.id,
      name: params.name,
      location: `POINT(${params.lng} ${params.lat})`, // 自动隐式转换为 PostGIS Geography
      category: params.category || null,
      notes: params.notes || null,
      sync_status: 'synced',
    } as any

    const { data, error } = await supabase
      .from('pois')
      .insert(insertData as any)
      .select()
      .single()

    if (error) throw error
    return mapRowToPoi(data)
  },

  async deletePoi(id: string) {
    const { error } = await supabase.from('pois').delete().eq('id', id)
    if (error) throw error
  }
}

// 由 Supabase CLI 自动生成（bun run supabase gen types typescript）
// 此文件手写以匹配当前的 001_init.sql 表结构

export type SyncStatus = 'synced' | 'pending' | 'failed'

export interface Database {
  public: {
    Tables: {
      pois: {
        Row: {
          id: string
          user_id: string
          name: string
          // location 字段在 JS 层表示为 GeoJSON Point 字符串，实际操作使用 lng/lat
          location: string
          category: string | null
          img_urls: string[]
          notes: string | null
          properties: Record<string, unknown>
          sync_status: SyncStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          location: string  // ST_MakePoint(lng, lat)::geography 传入时使用 Postgis 函数
          category?: string | null
          img_urls?: string[]
          notes?: string | null
          properties?: Record<string, unknown>
          sync_status?: SyncStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['pois']['Insert']>
      }
      user_settings: {
        Row: {
          user_id: string
          imgbb_api_key: string | null
          preferences: Record<string, unknown>
          updated_at: string
        }
        Insert: {
          user_id: string
          imgbb_api_key?: string | null
          preferences?: Record<string, unknown>
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_settings']['Insert']>
      }
    }
    Functions: {
      pois_near_point: {
        Args: {
          p_user_id: string
          p_lng: number
          p_lat: number
          p_radius?: number
        }
        Returns: Database['public']['Tables']['pois']['Row'][]
      }
    }
  }
}

// ─── 前端 DTO 类型 ───────────────────────────────────────────────
// 为方便前端使用，将 location 拆解为 lng/lat

export interface Poi {
  id: string
  userId: string
  name: string
  lng: number
  lat: number
  category: string | null
  imgUrls: string[]
  notes: string | null
  properties: Record<string, unknown>
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  userId: string
  imgbbApiKey: string | null
  preferences: Record<string, unknown>
  updatedAt: string
}

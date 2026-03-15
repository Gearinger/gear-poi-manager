-- ============================================================
-- POI 随手记 - Supabase 数据库初始化迁移脚本
-- Migration: 001_init.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 启用 PostGIS 扩展（支持地理空间查询）
-- ─────────────────────────────────────────────────────────────
create extension if not exists postgis with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- 2. 主表：pois
-- ─────────────────────────────────────────────────────────────
create table public.pois (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        varchar(100)  not null,
  location    geography(POINT, 4326) not null,  -- WGS-84 经纬度坐标
  category    varchar(50),                       -- 分类 key，如 "food", "todo", "photo"
  img_urls    text[]        default '{}',        -- 支持多张图片：ImgBB 返回的 URL 数组
  notes       text,                              -- 用户文字备注
  properties  jsonb         default '{}',        -- 预留扩展字段
  sync_status varchar(20)   default 'synced'     -- 'synced' | 'pending' | 'failed'
    check (sync_status in ('synced', 'pending', 'failed')),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. 自动更新 updated_at
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_pois_updated_at
  before update on public.pois
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. 空间索引（加速 ST_DWithin 等地理查询）
-- ─────────────────────────────────────────────────────────────
create index idx_pois_location
  on public.pois using gist (location);

-- 按用户 + 时间倒序查询加速
create index idx_pois_user_created
  on public.pois (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 5. 开启 Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────
alter table public.pois enable row level security;

-- 查询：用户只能看到自己的 POI
create policy "pois_select_own"
  on public.pois for select
  using (auth.uid() = user_id);

-- 插入：只允许插入自己 user_id 的记录
create policy "pois_insert_own"
  on public.pois for insert
  with check (auth.uid() = user_id);

-- 更新：只允许修改自己的记录
create policy "pois_update_own"
  on public.pois for update
  using (auth.uid() = user_id);

-- 删除：只允许删除自己的记录
create policy "pois_delete_own"
  on public.pois for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 6. 用户设置表（存储 ImgBB Key 等个人配置）
-- ─────────────────────────────────────────────────────────────
create table public.user_settings (
  user_id       uuid  primary key references auth.users(id) on delete cascade,
  imgbb_api_key text,          -- 用户自己的 ImgBB API Key（明文存储，仅用户本人可读）
  preferences   jsonb default '{}',  -- 预留：主题、语言等偏好
  updated_at    timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- 用户只能读写自己的设置行
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- 新用户注册时自动创建 user_settings 行
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_new_user_settings
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 7. 常用地理查询辅助函数
-- ─────────────────────────────────────────────────────────────

-- 查询用户在指定范围内（米）的所有 POI
-- 用法：select * from pois_near_point(user_id, lng, lat, radius_meters);
create or replace function public.pois_near_point(
  p_user_id uuid,
  p_lng     double precision,
  p_lat     double precision,
  p_radius  double precision default 5000  -- 默认 5km
)
returns setof public.pois
language sql
stable
as $$
  select *
  from public.pois
  where user_id = p_user_id
    and ST_DWithin(
      location,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius
    )
  order by ST_Distance(
    location,
    ST_MakePoint(p_lng, p_lat)::geography
  );
$$;

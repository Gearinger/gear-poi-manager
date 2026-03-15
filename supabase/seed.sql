-- ============================================================
-- POI 随手记 - 开发测试种子数据
-- 仅用于本地开发环境，请勿在生产中执行
-- ============================================================

-- 注意：seed 数据依赖真实的 auth.users 行。
-- 在 Supabase Studio > Authentication 手动创建测试账号后，
-- 将其 UUID 替换到下方 INSERT 中的 user_id 字段。

-- 示例（替换 'YOUR-USER-UUID'）：
-- insert into public.pois (user_id, name, location, category, notes)
-- values (
--   'YOUR-USER-UUID',
--   '测试咖啡馆',
--   ST_MakePoint(121.4737, 31.2304)::geography,  -- 上海外滩附近
--   'food',
--   '这里的拿铁很不错，座位宽敞'
-- );

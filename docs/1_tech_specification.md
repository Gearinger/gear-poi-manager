# 🛠️ POI 随手记：技术架构与开发规范 (Technical Specification)

## 1. 系统架构图

应用采用“前端界面 + Rust 核心逻辑 + 云端数据 + 本地空间数据”的混合驱动架构。

---

## 2. 核心技术栈 (Technology Stack)

* **跨平台框架**：Tauri 2.0 (支持 iOS/Android 原生能力调用)。
* **前端引擎**：React 18 / Vite / TypeScript。
* **包管理器与运行时**：[Bun](https://bun.sh/) (用于依赖管理、脚本运行以及打包构建)。
* **地图引擎**：MapLibre GL JS (基于 WebGL 的矢量底图高性能渲染)。
* **离线地图**：本地 SQLite 封装的 MBTiles 格式，用于存储瓦片缓存。
* **后端服务**：Supabase (Auth 鉴权、PostgreSQL、PostGIS)。
* **图片托管**：ImgBB API (用户自定义密钥方案)。

---

## 3. 离线地图实现逻辑 (MBTiles)

由于 WebView 无法直接访问系统文件系统中的二进制数据库，必须通过 Tauri 的 Rust 后端进行代理。

### 3.1 自定义协议 (Custom Protocol)

* **协议名称**：`map-data://`
* **实现细节**：
1. **读流程**：前端请求 `map-data://tiles/{z}/{x}/{y}`，Rust 后端先查本地 MBTiles 表（`tiles` 表）。若命中则返回 BLOB；若不命中，则通过 HTTP 下载该瓦片，存入本地数据库并返回。
2. **写流程 (主动下载)**：Rust 开启异步下载任务，根据用户选定的 Bounds 计算 XYZ 瓦片清单，循环下载 0~12 级数据并写入 SQLite。
3. **数据类型**：支持矢量瓦片 (`.pbf`) 的 gzip 解压与转发。



### 3.2 样式化 (Style Specification)

* **Style JSON**：必须包含本地化的 `glyphs` (字体) 和 `sprite` (图标) 路径。
* **配置示例**：
```json
{
  "sources": {
    "osm-tiles": {
      "type": "vector",
      "tiles": ["map-data://tiles/{z}/{x}/{y}.pbf"]
    }
  }
}

```



---

## 4. 数据库设计 (Supabase / PostGIS)

启用 `postgis` 扩展以支持高效的地理空间查询。

### 4.1 表结构：`pois`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键，默认 `gen_random_uuid()` |
| `user_id` | `uuid` | 引用 `auth.users` |
| `name` | `varchar(100)` | POI 名称 |
| `location` | `geography(POINT, 4326)` | 空间坐标点 (经纬度) |
| `category` | `varchar(50)` | 分类 Key |
| `img_url` | `text` | 外部图床返回的完整 URL |
| `properties` | `jsonb` | 动态属性 (自定义字段) |
| `created_at` | `timestamptz` | 创建时间 |

---

## 5. 图片处理工作流 (零云端占用方案)

为减少 Supabase 存储压力及流量成本，图片不进入 Supabase Storage。

1. **获取配置**：前端从用户设置中读取存储在本地或 Supabase 端的 ImgBB API Key。
2. **Rust 处理**：
* 利用 `image` crate 进行缩放（Max Width: 1200px）。
* 进行 WebP 格式转换，质量压缩比设为 80。
3. **上传申请**：Rust 根据 API Key 构造 `POST https://api.imgbb.com/1/upload` 请求。
4. **回填**：上传成功后，将返回的 `data.url` 写入 Supabase `pois` 表。

---

## 6. Tauri 插件配置要求

必须在 `src-tauri/capabilities/default.json` 中配置以下权限权限集：

* **定位**：`geolocation:default` (用于获取当前 POI 坐标)。
* **相机**：`camera:default` (用于录入照片)。
* **网络**：`http:default` (用于与 Supabase 及图床通信)。
* **文件系统**：`fs:default` (用于读取本地 MBTiles 文件)。

---

## 7. 开发规范与约束

### 7.1 坐标系标准

* **标准**：统一使用 **WGS-84** (EPSG:4326)。
* **转换**：若使用中国大陆底图，必须在 Rust 层集成 `coordtransform` 插件进行坐标偏转纠正（GCJ-02）。

### 7.2 性能性能指标

* **首屏加载**：地图初始渲染耗时不得超过 1.5 秒。
* **内存控制**：由于移动端 WebView 内存限制，大尺寸图片的预览必须使用缩略图，且在销毁详情页时释放内存。
* **并发处理**：地图瓦片请求必须异步并行，不得阻塞主线程。

### 7.4 编译与依赖管理

* **包管理**：禁止使用 `npm`, `yarn` 或 `pnpm`，统一使用 `bun install`。
* **脚本运行**：所有前端相关开发指令通过 `bun run <script>` 执行。
* **打包构建**：利用 Bun 高性能编译器协同 Vite 进行产物压缩。
* **单元测试**：前端逻辑测试优先使用 `bun test`。

### 7.3 安全性

* **环境变量**：所有 API Key (Supabase, 图床) 必须存储在 `.env` 中，严禁硬编码在前端。
* **RLS (Row Level Security)**：在 Supabase 开启 RLS，确保用户只能操作 `user_id` 等于其当前 Session 的数据。

---
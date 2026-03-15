# 技术方案变更：POI 架构由 GeoJSON 切换为矢量瓦片 (Vector Tiles)

## 1. 背景与动机 (Rationale)
当前项目使用 Supabase JS SDK 直接拉取所有 POI 记录并在前端渲染。随着 POI 数量增长（如达到 10,000+），将面临以下瓶颈：
- **加载负载**：一次性下载数万个点的 JSON 数据会导致首屏加载变慢，流量开销剧增。
- **渲染压力**：10,000 个 React 组件或大量点位在地图缩放时会造成主线程卡顿（尽管 WebGL 能缓解，但在低配移动端仍有压力）。
- **离线体验**：POI 无法利用现有的 MBTiles 瓦片缓存机制进行高效的分片读取。

**目标**：将 POI 转化为 **Mapbox 矢量瓦片 (MVT)** 格式，实现按需加载、极致流畅。

---

## 2. 总体架构变更 (Architecture Change)

### 2.1 变更前后对比
| 特性 | 现有架构 (GeoJSON) | **新架构 (Vector Tiles)** |
| :--- | :--- | :--- |
| **数据源** | Supabase REST API | Rust 侧 `map-data://poi/{z}/{x}/{y}` 协议 |
| **获取方式** | 一次性全量加载 | 按屏幕视野、按缩放级别 **分片加载** |
| **本地存储** | JS 内存 / WebSQL | **MBTiles (SQLite)** 中的二进制 `tiles` |
| **渲染技术** | GeoJSON Source | **Vector Source** (利用 GPU 贴图) |

---

## 3. 详细方案设计 (Detailed Design)

### 3.1 数据流转模型
1. **云端同步阶段**：
   - 客户端从云端获取更新的 POI 记录。
   - Rust 后端将记录写入本地 SQLite。
2. **请求响应阶段**：
   - 前端地图请求瓦片（如 `map-data://poi/12/3364/1628`）。
   - Rust 后端拦截请求，从 SQLite 中查询经纬度在该瓦片范围内的 POI。
   - **动态切片**：Rust 利用 `mvt` 或 `tile-grid` 库，在内存中将查询到的 POI 快速编码为 `.pbf` 格式。
   - **返回数据**：后端将二进制 PBF 流返回给 MapLibre 进行 WebGL 渲染。

### 3.2 关键技术组件
- **数据结构转换**：需要一个轻量级的动态瓦片编码器，将数据库的行记录（GeoBinary/WKB）转换为瓦片坐标空间。
- **本地缓存储存**：
  - 在 `tiles.mbtiles` 中增加一个新的层标识 `poi_layer`。
  - 对于已经生成的瓦片，可以直接在本地缓存以提高二次打开速度。
- **点击交互优化**：
  - 矢量瓦片不再支持 DOM 事件。
  - **对策**：使用 MapLibre 的 `queryRenderedFeatures` 接口，根据像素坐标捕获点击，并显示详情。

---

## 4. 实施里程碑 (Implementation Steps)

### 第一步：库选型与基建 (Rust)
- 在 `Cargo.toml` 引入矢量瓦片处理库（建议 `geozero` 或 `mvt`）。
- 扩展 `mbtiles.rs`，支持基于空间范围（BBox）的高效查询。

### 第二步：自定义协议扩展 (Tauri)
- 在 `lib.rs` 的 URI 注册逻辑中增加对 `map-data://poi/` 路径的解析。
- 实现“查询 -> 转换坐标 -> 编码 PBF”的闭环函数。

### 第三步：前端重构 (React)
- 移除 `poiService.getPois` 的全量调用逻辑。
- 在 `MapCanvas.tsx` 中配置新的 `VectorSource`。
- 重写地图点击监听函数，适配矢量图层。

---

## 5. 风险与权衡 (Risks & Trade-offs)
- **实时性延迟**：新增一个 POI 后，需要立即清理该坐标所属瓦片的内存缓存，确保“即写即现”。
- **开发复杂度**：相比简单的 JSON 渲染，矢量切片涉及到坐标系转换（WGS84 -> Web Mercator）和 PBF 编码，逻辑较复杂。

---

## 6. 后续演进 (Next Steps)
1. **预切片方案**：对于几乎不更新的大规模公共点集，可以在本地预先生成完整的 MBTiles 包。
2. **多层渲染**：用户正在编辑的点依然使用 GeoJSON 覆盖层，以保证极致的操作响应速度。

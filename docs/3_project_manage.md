# 📅 POI 随手记：项目管理与开发计划 (Project Management)

## 1. 里程碑划分 (Milestones)

### 第一阶段：基础设施搭建 (MVP - Week 1-2)
* [x] 初始化 Tauri 2.0 项目 (React + TS + Rust)，**统一使用 Bun 完成依赖安装**。
* [x] Supabase 数据库表结构设计与 Auth 流程打通。
* [x] 集成 MapLibre GL JS 并实现基础在线地图显示。
* [x] 账号登录/注册页面实现。
* [ ] **待办**：接入 Google OAuth 登录（Supabase + Deep Link 适配）。

### 第二阶段：离线能力与地理功能 (Week 3-4)
* [x] Rust 侧 `map-data://` 协议实现（瓦片读取与 HTTP 代理缓存）。
* [ ] **核心**：完成基于用户选定区域的 0~12 级瓦片批量下载功能。
* [x] 实现当前位置定位、标记点添加、样式展示。

### 第三阶段：多媒体与图床 (Week 5)
* [ ] 集成相机插件。
* [ ] 实现 Rust 侧图片 WebP 压缩流。
* [ ] **核心**：完成设置页 ImgBB API Key 的存储与调用上传逻辑。

### 第四阶段：UI 抛光与移动端发布 (Week 6-7)
* [ ] 实现底部详情抽屉的三段式动效。
* [ ] 适配 Android / iOS 屏幕安全区域。
* [ ] 多设备数据同步压力测试与 Bug 修复。

### 第五阶段：POI 矢量瓦片演进 (性能优化)
* [ ] **核心**：根据 [001_vector_tile_transition.md](./update/001_vector_tile_transition.md) 实现架构迁移。
* [ ] 在 Rust 侧集成动态 MVT 编码器。
* [ ] 前端渲染逻辑重构，支持 Vector Source 消费。

---

## 2. 核心任务清单 (Backlog)

### 前端任务 (React)
- [ ] 构建 `MapCanvas` 核心组件。
- [ ] 使用 `react-query` 管理 POI 状态。
- [ ] 开发离线地图选择区域的镂空蒙层 UI。
- [ ] 开发带有 API Key 掩码功能的设置项。

### 后端/Rust 任务
- [ ] 封装 SQLite (MBTiles) 读写器，支持异步下载任务。
- [ ] 使用 `reqwest` 实现 ImgBB 上传代理。
- [ ] 实现针对图片缩放的线程池处理（防止阻塞主进程）。
- [ ] **新增**：实现基于 `geozero` 或 `mvt` 的 POI 动态切片逻辑。
- [ ] **新增**：在 `map-data://` 协议中支持针对 POI 数据的切片分发逻辑。

---

## 3. 技术风险点
1. **移动端 WebView 获取瓦片速度**：需要 Rust 侧协议响应极其优化。
2. **下载任务持久化**：App 切后台时如何保持下载进程（iOS 限制）。
3. **坐标偏转**：中国境内地图的 GCJ-02 坐标纠正。
4. **矢量瓦片交互性**：从 DOM/Marker 模式切换到像素查询模式，需要适配点击选中的视觉反馈。

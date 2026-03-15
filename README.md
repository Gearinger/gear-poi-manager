# Gear POI Manager

本项目是一个基于 **Tauri v2 + React + Rust + Supabase** 的高性能、跨平台（Win/Mac/Android/iOS）个人 POI 资产管理工具。

本文档旨在总结本项目的全生命周期开发流程，作为开发规范与经验沉淀。

---

## 🛠 开发流程全景图

我们的开发遵循 **“文档先行 -> 敏捷实施 -> 自动化发布”** 的闭环体系。

### 1. 前期策划：建立项目灵魂 (Phase 0-2)
在写下第一行代码前，我们建立了完整的文档体系以确保目标清晰：
- **[需求文档 (PRD)](./docs/0_prd.md)**：定义核心功能（地图展示、POI 记录、多端同步、离线瓦片等）与产品视觉风格。
- **[技术规范](./docs/1_tech_specification.md)**：敲定技术栈（Tauri v2 + Rust + MapLibre），规范前后端通信逻辑与数据库结构。
- **[测试规范](./docs/1_test_specification.md)**：定义端到端测试方案，确保地理定位、图片上传等核心链路的可靠性。
- **[UI/UX 指南](./docs/2_uiux_guide.md)**：确立以蓝色为主基调，兼顾毛玻璃效果（Glassmorphism）与移动端交互的美学系统。

### 2. 准备阶段：环境与基建
当文档就绪后，我们开始搭建基础环境：
- **初始化工程**：使用 `tauri-apps/cli` 初始化 v2 项目，配置 `bun` 作为包管理器。
- **云服务连接**：集成 Supabase（地理投影扩展 PostGIS），建立 `001_init.sql` 基础表结构。
- **移动端初始化**：运行 `tauri android/ios init` 生成原生工程脚手架。

### 3. 开发实施：敏捷迭代 (Phase 3)
我们采用功能模块驱动的开发模式，详细任务记录于 **[项目进度表](./docs/3_project_manage.md)** 中：
- **Frontend (TS/React)**：负责地图交互渲染、Form 表单逻辑、状态管理（React Query）。
- **Backend (Rust)**：处理计算密集型任务，如 **图片 WebP 压缩**、**MBTiles 本地瓦片服务**、**IP 定位兜底代理**（绕过浏览器 CORS）。
- **通信桥梁**：通过 `invoke` API 实现前端对 Rust 指令的原子化调用。

### 4. 成果验证：多维度测试
- **本地开发验证**：运行 `bun tauri dev` 启动桌面窗口进行 UI 与交互逻辑验证。
- **Rust 静态检查**：通过 `cargo check` 和 `cargo test` 确保内核逻辑安全。
- **真机/模拟器验证**：利用 `bun tauri android/ios build` 检查原生平台的性能表现。

### 5. 成果发布：一键全平台部署
我们构建了基于 **GitHub Actions** 的自动化流水线（CI/CD）：
- **触发方式**：通过 GitHub Actions 手动触发 `v*.*.*` 版本发布。
- **全平台构建**：
  - **Windows/macOS**：自动构建安装包并上传至 GitHub Release 页面。
  - **Android/iOS**：自动生成应用产物（APK/AAB/IPA）并聚合到同一 Release 页面下。
- **自动化流向**：每次发布会自动生成 ChangeLog 并作为草稿发布，确保版本可追溯。

---

## 🚀 核心文档索引
- [需求策划案 (PRD)](./docs/0_prd.md)
- [技术架构说明](./docs/1_tech_specification.md)
- [测试策略](./docs/1_test_specification.md)
- [UI 设计规范](./docs/2_uiux_guide.md)
- [项目进度追踪](./docs/3_project_manage.md)

---

## 💻 快速开始 (本地开发)
```bash
# 1. 安装依赖
bun install

# 2. 启动开发模式 (桌面窗口)
bun tauri dev

# 3. 构建发布版本
bun tauri build
```

---

## 📬 维护者反馈
本项目由 Antigravity 辅助设计与实施。每一个功能迭代都遵循“先调研后编码”的严谨原则，确保项目的长期可维护性。

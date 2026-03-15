# 🧪 POI 随手记：单元测试与质量保障规范

## 1. 测试策略概览

* **前端测试 (Bun Runner)**：负责 UI 组件、工具函数、图床上传逻辑。
* **后端测试 (Cargo Test)**：负责数据库查询、图片压缩算法、文件系统操作。
* **集成测试 (Mocking IPC)**：模拟前端调用 Rust 命令，确保数据链路通畅。

---

## 2. 前端测试规范 (TypeScript/Bun)

使用 **Bun 内置测试运行器**（比 Vitest/Jest 更快）。

### 2.1 核心测试点

* **坐标转换逻辑**：验证经纬度偏转算法（如 WGS-84 转 GCJ-02）的精度。
* **图床 Key 校验**：模拟 API 请求，确保 Key 验证函数在各种网络状态码下的表现。
* **状态管理**：确保 POI 列表在增删改后，前端 Store 同步更新。

### 2.2 规范要求

* **文件命名**：`src/utils/*.test.ts` 或 `src/components/*.spec.tsx`。
* **Mock 准则**：涉及网络请求（如 ImgBB API）必须使用 `mock.module` 或 `fetch` 拦截，禁止在测试环境产生真实流量。

---

## 3. 后端测试规范 (Rust/Cargo)

利用 Rust 原生的测试框架确保高性能逻辑的稳定性。

### 3.1 核心测试点

* **图片预处理**：测试 Rust 压缩算法是否能将不同格式（JPG/PNG）的图片准确压缩至 300KB 以下。
* **MBTiles 读取**：验证自定义协议是否能正确从 SQLite 数据库提取对应的二进制瓦片。
* **权限解析**：测试 `capabilities` 逻辑，确保未授权请求被拦截。

### 3.2 规范要求

* **单元测试**：直接写在 `.rs` 文件的 `mod tests` 块中。
* **示例代码**：
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_image_resize_logic() {
        // 验证图片压缩后的尺寸比例
    }
}

```



---

## 4. 集成与跨端测试 (Tauri 特色)

这是最容易出 Bug 的地方，即前端通过 `invoke` 调用 Rust 命令的环节。

### 4.1 模拟指令 (Mocking Commands)

在前端测试中，需要拦截 `window.__TAURI_INTERNALS__`，防止测试在非 WebView 环境下运行报错。

* **工具推荐**：使用 `@tauri-apps/api/mocks` 插件。

### 4.2 持续集成 (CI)

* **自动化流水线**：建议配置 GitHub Actions，在每次 Push 时：
1. 运行 `bun test` 检查前端。
2. 运行 `cargo test` 检查后端。
3. 运行 `bun run lint` 检查代码格式。



---

## 5. UI 自动化测试 (E2E) - 可选

如果你的地图交互逻辑非常复杂（例如：点击 A 位置，抽屉必须弹出并显示内容 B）：

* **推荐工具**：**Playwright**。
* **测试重点**：模拟用户在地图上的点击操作，验证底部抽屉的弹出高度和内容对齐。

---

## 6. 测试指标要求 (KPI)

| 指标 | 要求 |
| --- | --- |
| **代码覆盖率** | 核心逻辑（坐标转换、上传逻辑、数据转换）需达到 **80%**。 |
| **运行速度** | 单元测试全量运行耗时应控制在 **30 秒**以内（得益于 Bun 和 Rust）。 |
| **错误容忍度** | 必须包含针对“图床 Key 无效”和“GPS 信号丢失”的边缘情况测试。 |

---

### 💡 补全建议

在你的 `package.json` 中，建议添加以下脚本以简化流程：

```json
{
  "scripts": {
    "test": "bun test",
    "test:rust": "cargo test",
    "lint": "bun x biome check ."
  }
}

```
mod mbtiles;
mod tile_downloader;
mod commands;

use std::sync::Arc;
use tauri::{
    http::{Request, Response},
    Manager,
};

use mbtiles::MbtilesDb;
use commands::{
    clear_tile_cache, estimate_tile_download, get_cache_stats, start_tile_download, DbState,
};

// ── 保留示例 command ──────────────────────────────────────
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── 插件 ────────────────────────────────────────────
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_opener::init())
        // ── 应用初始化：打开 MBTiles 并注册协议 ─────────────
        .setup(|app| {
            // 确定 MBTiles 文件路径（存在应用数据目录下）
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("无法获取应用数据目录");
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("tiles.mbtiles");

            let db = Arc::new(MbtilesDb::open(&db_path).expect("打开 MBTiles 数据库失败"));
            app.manage::<DbState>(db);
            Ok(())
        })
        // ── 自定义协议：map-data://tiles/{z}/{x}/{y} ─────────
        .register_uri_scheme_protocol("map-data", |ctx, request| {
            handle_map_data_request(ctx, request)
        })
        // ── 暴露给前端的 Commands ────────────────────────────
        .invoke_handler(tauri::generate_handler![
            greet,
            estimate_tile_download,
            start_tile_download,
            get_cache_stats,
            clear_tile_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 处理 `map-data://tiles/{z}/{x}/{y}` 请求
/// 1. 先查本地 MBTiles 缓存
/// 2. Cache Miss → 透明代理到 OSM 瓦片服务，写入缓存后返回
fn handle_map_data_request<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let uri = request.uri().path();
    // 路径格式: /tiles/{z}/{x}/{y}
    let parts: Vec<&str> = uri.trim_start_matches('/').split('/').collect();

    if parts.len() < 4 || parts[0] != "tiles" {
        return error_response(400, "Invalid tile path");
    }

    let (z, x, y) = match (
        parts[1].parse::<u32>(),
        parts[2].parse::<u32>(),
        parts[3].trim_end_matches(".pbf").parse::<u32>(),
    ) {
        (Ok(z), Ok(x), Ok(y)) => (z, x, y),
        _ => return error_response(400, "Invalid Z/X/Y parameters"),
    };

    // 从 AppState 获取 MbtilesDb（通过 UriSchemeContext → AppHandle）
    let db = ctx.app_handle().state::<DbState>();

    // 1. 命中本地缓存 ── 直接返回
    if let Some(tile_data) = commands::get_tile_bytes(&db, z, x, y) {
        return pbf_response(tile_data);
    }

    // 2. Cache Miss ── 同步 HTTP 请求（协议处理器是同步的，使用 tokio block_in_place）
    let url = format!(
        "https://tiles.openfreemap.org/planet/{z}/{x}/{y}"
    );

    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async {
            let client = reqwest::Client::builder()
                .user_agent("gear-poi-manager/0.1")
                .build()?;
            let resp = client.get(&url).send().await?;
            if resp.status().is_success() {
                Ok(resp.bytes().await?.to_vec())
            } else {
                Err(reqwest::Error::from(resp.error_for_status().unwrap_err()))
            }
        })
    });

    match result {
        Ok(bytes) => {
            // 写入缓存（spawn_blocking 避免阻塞当前线程）
            let db_clone = Arc::clone(&*db);
            let bytes_clone = bytes.clone();
            tokio::task::spawn(async move {
                tokio::task::spawn_blocking(move || {
                    let _ = db_clone.put_tile(z, x, y, &bytes_clone);
                })
                .await
                .ok();
            });
            pbf_response(bytes)
        }
        Err(_) => error_response(502, "Tile fetch failed"),
    }
}

fn pbf_response(data: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("Content-Type", "application/x-protobuf")
        .header("Content-Encoding", "gzip")
        .header("Access-Control-Allow-Origin", "*")
        .body(data)
        .unwrap()
}

fn error_response(code: u16, msg: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(code)
        .body(msg.as_bytes().to_vec())
        .unwrap()
}

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};

use crate::mbtiles::MbtilesDb;
use crate::tile_downloader::{download_tiles, estimate_download_bytes, tiles_in_bounds};
use crate::image_processor::{compress_and_upload, UploadResult};

pub type DbState = Arc<MbtilesDb>;

/// 获取单块瓦片 —— 供自定义协议调用，不暴露为 Tauri command
pub fn get_tile_bytes(db: &MbtilesDb, z: u32, x: u32, y: u32) -> Option<Vec<u8>> {
    db.get_tile(z, x, y).ok().flatten()
}

// ── Tauri Commands ─────────────────────────────────────────

#[tauri::command]
pub async fn upload_image(
    image_bytes: Vec<u8>,
    api_key: String,
    max_width: u32,
) -> Result<UploadResult, String> {
    compress_and_upload(&image_bytes, &api_key, max_width).await
}

#[derive(Serialize, Deserialize)]
pub struct IpLocation {
    pub longitude: f64,
    pub latitude: f64,
}

#[tauri::command]
pub async fn get_ip_location() -> Result<IpLocation, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://ipapi.co/json/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json = res.json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    
    let longitude = json["longitude"].as_f64().ok_or("No longitude in IP response")?;
    let latitude = json["latitude"].as_f64().ok_or("No latitude in IP response")?;

    Ok(IpLocation { longitude, latitude })
}

#[derive(Serialize)]
pub struct EstimateResult {
    pub tile_count: u64,
    pub estimated_mb: f64,
}

/// 估算下载指定区域 0~max_zoom 级别所需的瓦片数量和大小
#[tauri::command]
pub fn estimate_tile_download(
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    max_zoom: u32,
) -> EstimateResult {
    let mut all_tiles = Vec::new();
    for z in 0..=max_zoom.min(12) {
        all_tiles.extend(tiles_in_bounds(z, west, south, east, north));
    }
    let bytes = estimate_download_bytes(&all_tiles);
    EstimateResult {
        tile_count: all_tiles.len() as u64,
        estimated_mb: bytes as f64 / 1_048_576.0,
    }
}

#[derive(Deserialize)]
pub struct DownloadArgs {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
    pub max_zoom: u32,
}

#[derive(Serialize)]
pub struct DownloadResult {
    pub success_count: u32,
    pub db_size_mb: f64,
}

/// 启动异步下载任务，将范围内 0~max_zoom 级瓦片存入本地 MBTiles
#[tauri::command]
pub async fn start_tile_download(
    db: State<'_, DbState>,
    args: DownloadArgs,
    app: tauri::AppHandle,
) -> Result<DownloadResult, String> {
    let max_zoom = args.max_zoom.min(12);
    let mut all_tiles = Vec::new();
    for z in 0..=max_zoom {
        all_tiles.extend(tiles_in_bounds(z, args.west, args.south, args.east, args.north));
    }

    let db_arc = Arc::clone(&db);
    let app_clone = app.clone();

    let success_count = download_tiles(
        db_arc,
        all_tiles,
        "https://tiles.openfreemap.org/planet/{z}/{x}/{y}",
        move |_done, total| {
            // 向前端发送进度事件
            let _ = app_clone.emit("tile-download-progress", total);
        },
    )
    .await?;

    let db_size_mb = db.file_size_bytes() as f64 / 1_048_576.0;
    Ok(DownloadResult { success_count, db_size_mb })
}

#[derive(Serialize)]
pub struct CacheStats {
    pub size_mb: f64,
}

/// 获取本地瓦片缓存大小
#[tauri::command]
pub fn get_cache_stats(db: State<'_, DbState>) -> CacheStats {
    CacheStats {
        size_mb: db.file_size_bytes() as f64 / 1_048_576.0,
    }
}

/// 清除本地瓦片缓存（删除所有 tiles 表数据）
#[tauri::command]
pub fn clear_tile_cache(db: State<'_, DbState>) -> Result<(), String> {
    db.clear_tiles().map_err(|e| e.to_string())
}

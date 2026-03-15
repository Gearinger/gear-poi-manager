use reqwest::Client;
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::mbtiles::MbtilesDb;

/// 在线 OSM 矢量瓦片模板（OpenFreeMap）
const OSM_TILE_URL: &str = "https://tiles.openfreemap.org/planet/{z}/{x}/{y}";

/// 并发下载控制：最多同时 6 个瓦片请求（避免被服务端限速）
const MAX_CONCURRENT: usize = 6;

/// 计算某缩放级别和地理范围内的所有 XYZ 瓦片坐标
/// bounds: [west_lng, south_lat, east_lng, north_lat]
pub fn tiles_in_bounds(
    z: u32,
    west: f64,
    south: f64,
    east: f64,
    north: f64,
) -> Vec<(u32, u32, u32)> {
    let n = (1u32 << z) as f64;

    let x_min = lng_to_tile_x(west, n);
    let x_max = lng_to_tile_x(east, n);
    let y_min = lat_to_tile_y(north, n); // 注意：纬度高 → tile_y 小
    let y_max = lat_to_tile_y(south, n);

    let mut tiles = Vec::new();
    for x in x_min..=x_max {
        for y in y_min..=y_max {
            tiles.push((z, x, y));
        }
    }
    tiles
}

/// 估算下载瓦片总大小（字节），用于 UI 中"预计 xx MB"提示
/// 粗略估计：Z0-6 约 3KB/tile, Z7-10 约 8KB/tile, Z11-12 约 15KB/tile
pub fn estimate_download_bytes(tiles: &[(u32, u32, u32)]) -> u64 {
    tiles.iter().map(|(z, _, _)| match z {
        0..=6  => 3_000u64,
        7..=10 => 8_000,
        _      => 15_000,
    }).sum()
}

/// 异步批量下载瓦片并写入 MBTiles 数据库
/// 返回成功下载的瓦片数量
pub async fn download_tiles(
    db: Arc<MbtilesDb>,
    tiles: Vec<(u32, u32, u32)>,
    tile_url_template: &str,
    progress_cb: impl Fn(u32, u32) + Send + Sync + 'static,
) -> Result<u32, String> {
    let client = Client::builder()
        .user_agent("gear-poi-manager/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let total = tiles.len() as u32;
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT));
    let progress_cb = Arc::new(progress_cb);
    let mut handles = Vec::with_capacity(tiles.len());

    for (z, x, y) in tiles {
        let db = Arc::clone(&db);
        let client = client.clone();
        let sem = Arc::clone(&semaphore);
        let cb = Arc::clone(&progress_cb);
        let url = tile_url_template
            .replace("{z}", &z.to_string())
            .replace("{x}", &x.to_string())
            .replace("{y}", &y.to_string());

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            // 跳过已缓存的瓦片
            if db.get_tile(z, x, y).ok().flatten().is_some() {
                return true;
            }

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = db.put_tile(z, x, y, &bytes);
                        cb(1, total);
                        true
                    } else {
                        false
                    }
                }
                _ => false,
            }
        });

        handles.push(handle);
    }

    let mut success = 0u32;
    for h in handles {
        if h.await.unwrap_or(false) {
            success += 1;
        }
    }
    Ok(success)
}

// ── 坐标转换工具 ─────────────────────────────────────────────
#[inline]
fn lng_to_tile_x(lng: f64, n: f64) -> u32 {
    ((lng + 180.0) / 360.0 * n).floor() as u32
}

#[inline]
fn lat_to_tile_y(lat: f64, n: f64) -> u32 {
    use std::f64::consts::PI;
    let lat_rad = lat.to_radians();
    let y = (1.0 - lat_rad.tan().asinh() / PI) / 2.0 * n;
    y.floor() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tiles_in_bounds_z0() {
        // z=0 全球只有 1 张瓦片
        let tiles = tiles_in_bounds(0, -180.0, -85.0, 180.0, 85.0);
        assert_eq!(tiles.len(), 1);
        assert_eq!(tiles[0], (0, 0, 0));
    }

    #[test]
    fn test_tiles_in_bounds_z1() {
        // z=1 全球 4 张
        let tiles = tiles_in_bounds(1, -180.0, -85.0, 180.0, 85.0);
        assert_eq!(tiles.len(), 4);
    }

    #[test]
    fn test_estimate_size() {
        let tiles: Vec<_> = (0..10).map(|i| (5u32, i, i)).collect();
        let size = estimate_download_bytes(&tiles);
        assert!(size > 0);
    }
}

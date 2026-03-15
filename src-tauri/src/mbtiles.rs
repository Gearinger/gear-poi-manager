use rusqlite::{Connection, OptionalExtension, Result as SqlResult};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// MBTiles 数据库封装
/// 规范：https://github.com/mapbox/mbtiles-spec
pub struct MbtilesDb {
    conn: Mutex<Connection>,
    pub path: PathBuf,
}

impl MbtilesDb {
    /// 打开或新建一个 MBTiles 数据库
    pub fn open(path: &Path) -> SqlResult<Self> {
        let conn = Connection::open(path)?;

        // 初始化表结构（符合 MBTiles 1.3 规范）
        conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;

            CREATE TABLE IF NOT EXISTS metadata (
                name  TEXT NOT NULL,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS tiles (
                zoom_level  INTEGER NOT NULL,
                tile_column INTEGER NOT NULL,
                tile_row    INTEGER NOT NULL,
                tile_data   BLOB    NOT NULL,
                PRIMARY KEY (zoom_level, tile_column, tile_row)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS tiles_idx
                ON tiles (zoom_level, tile_column, tile_row);
        ")?;

        Ok(Self {
            conn: Mutex::new(conn),
            path: path.to_owned(),
        })
    }

    /// 读取瓦片（MBTiles 的 tile_row 是 TMS 坐标，需翻转 Y）
    pub fn get_tile(&self, z: u32, x: u32, y: u32) -> SqlResult<Option<Vec<u8>>> {
        let tms_y = tms_flip_y(z, y);
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT tile_data FROM tiles WHERE zoom_level=?1 AND tile_column=?2 AND tile_row=?3",
            rusqlite::params![z, x, tms_y],
            |row| row.get::<_, Vec<u8>>(0),
        ).optional()?;
        Ok(result)
    }

    /// 写入单块瓦片
    pub fn put_tile(&self, z: u32, x: u32, y: u32, data: &[u8]) -> SqlResult<()> {
        let tms_y = tms_flip_y(z, y);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![z, x, tms_y, data],
        )?;
        Ok(())
    }

    /// 查询某缩放级别下瓦片总数
    pub fn tile_count(&self, z: u32) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tiles WHERE zoom_level=?1",
            rusqlite::params![z],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    /// 删除所有缓存瓦片
    pub fn clear_tiles(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tiles", [])?;
        Ok(())
    }

    /// 获取数据库文件大小（字节）
    pub fn file_size_bytes(&self) -> u64 {
        std::fs::metadata(&self.path)
            .map(|m| m.len())
            .unwrap_or(0)
    }
}

/// MBTiles TMS 标准：Y 轴与 XYZ 定义相反需要翻转
/// tms_y = (2^z - 1) - xyz_y
#[inline]
fn tms_flip_y(z: u32, xyz_y: u32) -> u32 {
    let n = 1u32.checked_shl(z).unwrap_or(u32::MAX);
    n.saturating_sub(1).saturating_sub(xyz_y)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tms_flip_y() {
        // z=0: 唯一一张瓦片 y=0 -> tms_y=0
        assert_eq!(tms_flip_y(0, 0), 0);
        // z=1: y=0 -> tms_y=1, y=1 -> tms_y=0
        assert_eq!(tms_flip_y(1, 0), 1);
        assert_eq!(tms_flip_y(1, 1), 0);
    }

    #[test]
    fn test_open_and_rw() {
        let tmp = tempfile_path();
        let db = MbtilesDb::open(&tmp).unwrap();
        let data = vec![0xAA, 0xBB, 0xCC];
        db.put_tile(5, 10, 20, &data).unwrap();
        let got = db.get_tile(5, 10, 20).unwrap().unwrap();
        assert_eq!(got, data);
        std::fs::remove_file(&tmp).ok();
    }

    fn tempfile_path() -> PathBuf {
        std::env::temp_dir().join(format!("test_mbtiles_{}.db", std::process::id()))
    }
}

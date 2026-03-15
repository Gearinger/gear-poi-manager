use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use image::GenericImageView;

#[derive(Serialize)]
pub struct UploadResult {
    pub url: String,
    pub width: u32,
    pub height: u32,
    pub size: usize,
}

pub async fn compress_and_upload(
    bytes: &[u8],
    api_key: &str,
    max_width: u32,
) -> Result<UploadResult, String> {
    // 1. 加载图片
    let mut img = image::load_from_memory(bytes).map_err(|e| format!("Load image error: {}", e))?;
    let (width, height) = img.dimensions();
    
    // 如果图片尺寸偏大，则进行等比缩放（限制最大宽度）
    if width > max_width {
        let ratio = max_width as f32 / width as f32;
        let nwidth = max_width;
        let nheight = (height as f32 * ratio) as u32;
        img = img.resize(nwidth, nheight, image::imageops::FilterType::Lanczos3);
    }

    // 2. 将图片缓冲重新编码为体积更小的 WebP 格式
    let mut webp_buf = Cursor::new(Vec::new());
    img.write_to(&mut webp_buf, image::ImageFormat::WebP)
       .map_err(|e| format!("WebP encode error: {}", e))?;
    
    let webp_bytes = webp_buf.into_inner();
    let file_size = webp_bytes.len();
    let (out_width, out_height) = img.dimensions();

    // 3. 上传到 ImgBB
    let client = reqwest::Client::new();
    
    // 创建 multipart 表单，将 key 和 image 都作为 part
    let part = multipart::Part::bytes(webp_bytes)
        .file_name("image.webp")
        .mime_str("image/webp")
        .map_err(|e| format!("Multipart Form part error: {}", e))?;
    
    let form = multipart::Form::new()
        .text("key", api_key.to_string())
        .part("image", part);
    
    let res = client
        .post("https://api.imgbb.com/1/upload")
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request ImgBB error: {}", e))?;
        
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    
    if !status.is_success() {
        return Err(format!("ImgBB Upload failed: [{}] {}", status, body));
    }
    
    // 极简解包 Response JSON
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Failed to parse ImgBB response JSON")?;
        
    let url = json["data"]["url"]
        .as_str()
        .ok_or("ImgBB response missing url field")?
        .to_string();

    Ok(UploadResult {
        url,
        width: out_width,
        height: out_height,
        size: file_size,
    })
}

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Serialize)]
struct PdfInfo {
    name: String,
    path: String,
    sha256: String,
    size: u64,
}

#[derive(Serialize)]
struct OpenPdfResult {
    info: PdfInfo,
    bytes: Vec<u8>,
}

#[tauri::command]
fn open_pdf(path: String) -> Result<OpenPdfResult, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err("File does not exist".into());
    }

    if !path_buf.is_file() {
        return Err("Path is not a file".into());
    }

    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "pdf" {
        return Err("Only .pdf files are allowed".into());
    }

    let metadata = std::fs::metadata(&path_buf).map_err(|e| e.to_string())?;

    let max_size: u64 = 100 * 1024 * 1024;
    if metadata.len() > max_size {
        return Err("PDF is too large. Max size is 100 MB.".into());
    }

    let bytes = std::fs::read(&path_buf).map_err(|e| e.to_string())?;

    if !bytes.starts_with(b"%PDF-") {
        return Err("Invalid PDF header".into());
    }

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let sha256 = hex::encode(hasher.finalize());

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.pdf")
        .to_string();

    Ok(OpenPdfResult {
        info: PdfInfo {
            name,
            path,
            sha256,
            size: metadata.len(),
        },
        bytes,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
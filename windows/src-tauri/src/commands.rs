use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

const CHUNK_SIZE: usize = 1024 * 1024;

#[tauri::command]
pub fn stream_copy_file(input: String, output: String) -> Result<u64, String> {
    let mut src = File::open(Path::new(&input)).map_err(|e| e.to_string())?;
    let mut dst = File::create(Path::new(&output)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut total = 0u64;
    loop {
        let n = src.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        dst.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        total += n as u64;
    }
    dst.flush().map_err(|e| e.to_string())?;
    Ok(total)
}

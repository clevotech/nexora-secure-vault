use std::{fs, path::Path};

fn main() {
    // Keep source checkouts buildable even when binary branding assets are not present.
    // Tauri's Windows resource compiler requires an ICO file; create a tiny valid
    // transparent-neutral fallback icon only when the project icon is missing.
    let icon_path = Path::new("icons/icon.ico");
    if !icon_path.exists() {
        if let Some(parent) = icon_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let mut ico: Vec<u8> = Vec::with_capacity(70);
        // ICONDIR: reserved=0, type=1 (icon), count=1.
        ico.extend_from_slice(&[0, 0, 1, 0, 1, 0]);
        // ICONDIRENTRY: 1x1, one plane, 32 bits, 48-byte image at offset 22.
        ico.extend_from_slice(&[1, 1, 0, 0, 1, 0, 32, 0]);
        ico.extend_from_slice(&48u32.to_le_bytes());
        ico.extend_from_slice(&22u32.to_le_bytes());
        // BITMAPINFOHEADER: 1x1 BGRA bitmap plus 1-row AND mask.
        ico.extend_from_slice(&40u32.to_le_bytes());
        ico.extend_from_slice(&1i32.to_le_bytes());
        ico.extend_from_slice(&2i32.to_le_bytes());
        ico.extend_from_slice(&1u16.to_le_bytes());
        ico.extend_from_slice(&32u16.to_le_bytes());
        ico.extend_from_slice(&0u32.to_le_bytes());
        ico.extend_from_slice(&4u32.to_le_bytes());
        ico.extend_from_slice(&[0; 16]);
        // Single opaque Nexora-blue pixel (BGRA), followed by a transparent mask.
        ico.extend_from_slice(&[0xD9, 0x6A, 0x20, 0xFF, 0, 0, 0, 0]);
        let _ = fs::write(icon_path, ico);
    }
    tauri_build::build()
}

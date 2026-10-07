#![cfg_attr(mobile, tauri::mobile_entry_point)]

mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![commands::stream_copy_file])
        .run(tauri::generate_context!())
        .expect("error while running Nexora Secure Vault");
}

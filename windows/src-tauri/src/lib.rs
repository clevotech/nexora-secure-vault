#![cfg_attr(mobile, tauri::mobile_entry_point)]

mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::encrypt_nsv1,
            commands::decrypt_nsv1
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexora Secure Vault");
}

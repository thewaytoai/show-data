use std::collections::HashMap;
use std::sync::Mutex;

mod commands;
mod db;
mod storage;

pub use db::ConnectionPool;

pub struct AppState {
    pub pools: Mutex<HashMap<String, ConnectionPool>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            pools: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::connection::save_connection,
            commands::connection::list_connections,
            commands::connection::delete_connection,
            commands::connection::test_connection,
            commands::connection::export_file,
            commands::query::connect,
            commands::query::disconnect,
            commands::query::get_databases,
            commands::query::get_tables,
            commands::query::get_table_columns,
            commands::query::execute_query,
            commands::query::get_table_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

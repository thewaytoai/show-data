use crate::storage::{self, ConnectionConfig};
use crate::{db, AppState};
use tauri::State;

#[tauri::command]
pub async fn export_file(filename: String, content: String) -> Result<String, String> {
    let dir = dirs::download_dir()
        .or_else(|| dirs::home_dir())
        .ok_or_else(|| "Cannot find downloads directory".to_string())?;
    let path = dir.join(&filename);
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_connection(config: ConnectionConfig) -> Result<String, String> {
    storage::upsert_connection(config)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionConfig>, String> {
    Ok(storage::load_connections())
}

#[tauri::command]
pub async fn delete_connection(id: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut pools) = state.pools.lock() {
        pools.remove(&id);
    }
    storage::remove_connection(&id)
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<String, String> {
    match config.db_type.as_str() {
        "mysql" => {
            let pool = db::mysql::create_pool(&config).await?;
            pool.close().await;
        }
        "postgres" => {
            let pool = db::postgres::create_pool(&config).await?;
            pool.close().await;
        }
        "sqlite" => {
            let pool = db::sqlite::create_pool(&config).await?;
            pool.close().await;
        }
        other => return Err(format!("Unsupported db type: {}", other)),
    }
    Ok("Connection successful".to_string())
}

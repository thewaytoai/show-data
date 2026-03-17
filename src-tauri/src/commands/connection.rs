use crate::storage::{self, ConnectionConfig};
use crate::{db, AppState};
use tauri::State;

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
        other => return Err(format!("Unsupported db type: {}", other)),
    }
    Ok("Connection successful".to_string())
}

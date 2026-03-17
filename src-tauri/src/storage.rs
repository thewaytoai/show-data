use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub db_type: String, // "mysql" | "postgres"
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: String,
}

fn connections_file() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("show-data");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("connections.json")
}

pub fn load_connections() -> Vec<ConnectionConfig> {
    let path = connections_file();
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_connections(connections: &[ConnectionConfig]) -> Result<(), String> {
    let path = connections_file();
    let json = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn upsert_connection(mut config: ConnectionConfig) -> Result<String, String> {
    let mut connections = load_connections();
    if config.id.is_empty() {
        config.id = Uuid::new_v4().to_string();
    }
    let id = config.id.clone();
    if let Some(existing) = connections.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        connections.push(config);
    }
    save_connections(&connections)?;
    Ok(id)
}

pub fn remove_connection(id: &str) -> Result<(), String> {
    let mut connections = load_connections();
    connections.retain(|c| c.id != id);
    save_connections(&connections)
}

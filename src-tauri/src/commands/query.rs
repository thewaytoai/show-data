use crate::{db, db::PoolRef, storage, AppState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableInfo {
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub affected_rows: Option<u64>,
    pub error: Option<String>,
}

fn get_pool(id: &str, state: &State<'_, AppState>) -> Result<PoolRef, String> {
    let pools = state.pools.lock().map_err(|e| e.to_string())?;
    pools
        .get(id)
        .map(|cp| cp.cloned())
        .ok_or_else(|| "Not connected. Call connect() first.".to_string())
}

fn db_type(id: &str) -> Option<String> {
    storage::load_connections()
        .into_iter()
        .find(|c| c.id == id)
        .map(|c| c.db_type)
}

#[tauri::command]
pub async fn connect(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let connections = storage::load_connections();
    let config = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| format!("Connection {} not found", id))?;

    let pool = match config.db_type.as_str() {
        "mysql" => db::ConnectionPool::MySql(db::mysql::create_pool(&config).await?),
        "postgres" => db::ConnectionPool::Postgres(db::postgres::create_pool(&config).await?),
        "sqlite" => db::ConnectionPool::Sqlite(db::sqlite::create_pool(&config).await?),
        other => return Err(format!("Unsupported db type: {}", other)),
    };

    let mut pools = state.pools.lock().map_err(|e| e.to_string())?;
    pools.insert(id, pool);
    Ok(())
}

#[tauri::command]
pub async fn disconnect(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let pool = {
        let mut pools = state.pools.lock().map_err(|e| e.to_string())?;
        pools.remove(&id).map(|cp| cp.into_ref())
    };
    if let Some(p) = pool {
        match p {
            PoolRef::MySql(p) => p.close().await,
            PoolRef::Postgres(p) => p.close().await,
            PoolRef::Sqlite(p) => p.close().await,
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_databases(id: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    match get_pool(&id, &state)? {
        PoolRef::MySql(p) => db::mysql::get_databases(&p).await,
        PoolRef::Postgres(p) => db::postgres::get_databases(&p).await,
        PoolRef::Sqlite(p) => db::sqlite::get_databases(&p).await,
    }
}

#[tauri::command]
pub async fn get_tables(
    id: String,
    database: String,
    state: State<'_, AppState>,
) -> Result<Vec<TableInfo>, String> {
    match get_pool(&id, &state)? {
        PoolRef::MySql(p) => db::mysql::get_tables(&p, &database).await,
        PoolRef::Postgres(p) => db::postgres::get_tables(&p, &database).await,
        PoolRef::Sqlite(p) => db::sqlite::get_tables(&p, &database).await,
    }
}

#[tauri::command]
pub async fn get_table_columns(
    id: String,
    database: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<ColumnInfo>, String> {
    match get_pool(&id, &state)? {
        PoolRef::MySql(p) => db::mysql::get_columns(&p, &database, &table).await,
        PoolRef::Postgres(p) => db::postgres::get_columns(&p, &database, &table).await,
        PoolRef::Sqlite(p) => db::sqlite::get_columns(&p, &database, &table).await,
    }
}

#[tauri::command]
pub async fn execute_query(
    id: String,
    database: String,
    sql: String,
    state: State<'_, AppState>,
) -> Result<QueryResult, String> {
    let pool = get_pool(&id, &state)?;
    let trimmed = sql.trim().to_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("SHOW")
        || trimmed.starts_with("EXPLAIN")
        || trimmed.starts_with("DESCRIBE")
        || trimmed.starts_with("DESC")
        || trimmed.starts_with("PRAGMA");

    Ok(match pool {
        PoolRef::MySql(_) => {
            // Create a direct connection with the target database baked in,
            // avoiding USE (not supported in prepared statement protocol, error 1295).
            let config = storage::load_connections()
                .into_iter()
                .find(|c| c.id == id)
                .ok_or_else(|| "Connection config not found".to_string())?;
            let mut conn = match db::mysql::connect_to_db(&config, &database).await {
                Ok(c) => c,
                Err(e) => return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e) }),
            };
            if is_select {
                match sqlx::query(&sql).fetch_all(&mut conn).await {
                    Ok(rows) => {
                        if rows.is_empty() {
                            return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: Some(0), error: None });
                        }
                        let columns = db::mysql::columns(&rows[0]);
                        let rows = rows.iter().map(db::mysql::row_to_json).collect();
                        QueryResult { columns, rows, affected_rows: None, error: None }
                    }
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            } else {
                match sqlx::query(&sql).execute(&mut conn).await {
                    Ok(r) => QueryResult { columns: vec![], rows: vec![], affected_rows: Some(r.rows_affected()), error: None },
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            }
        }
        PoolRef::Postgres(p) => {
            if is_select {
                match sqlx::query(&sql).fetch_all(&p).await {
                    Ok(rows) => {
                        if rows.is_empty() {
                            return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: Some(0), error: None });
                        }
                        let columns = db::postgres::columns(&rows[0]);
                        let rows = rows.iter().map(db::postgres::row_to_json).collect();
                        QueryResult { columns, rows, affected_rows: None, error: None }
                    }
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            } else {
                match sqlx::query(&sql).execute(&p).await {
                    Ok(r) => QueryResult { columns: vec![], rows: vec![], affected_rows: Some(r.rows_affected()), error: None },
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            }
        }
        PoolRef::Sqlite(p) => {
            if is_select {
                match sqlx::query(&sql).fetch_all(&p).await {
                    Ok(rows) => {
                        if rows.is_empty() {
                            return Ok(QueryResult { columns: vec![], rows: vec![], affected_rows: Some(0), error: None });
                        }
                        let columns = db::sqlite::columns(&rows[0]);
                        let rows = rows.iter().map(db::sqlite::row_to_json).collect();
                        QueryResult { columns, rows, affected_rows: None, error: None }
                    }
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            } else {
                match sqlx::query(&sql).execute(&p).await {
                    Ok(r) => QueryResult { columns: vec![], rows: vec![], affected_rows: Some(r.rows_affected()), error: None },
                    Err(e) => QueryResult { columns: vec![], rows: vec![], affected_rows: None, error: Some(e.to_string()) },
                }
            }
        }
    })
}

#[tauri::command]
pub async fn get_table_data(
    id: String,
    database: String,
    table: String,
    page: i64,
    page_size: i64,
    sort_col: Option<String>,
    sort_dir: Option<String>,
    state: State<'_, AppState>,
) -> Result<QueryResult, String> {
    let offset = (page - 1) * page_size;
    let db_t = db_type(&id).unwrap_or_default();
    let is_mysql = db_t == "mysql";
    let is_sqlite = db_t == "sqlite";

    let order_clause = sort_col
        .filter(|c| !c.is_empty())
        .map(|c| {
            let dir = if sort_dir.as_deref().unwrap_or("asc").to_lowercase() == "desc" {
                "DESC"
            } else {
                "ASC"
            };
            if is_mysql {
                format!(" ORDER BY `{}` {}", c, dir)
            } else {
                format!(" ORDER BY \"{}\" {}", c, dir)
            }
        })
        .unwrap_or_default();

    let sql = if is_mysql {
        format!(
            "SELECT * FROM `{}`.`{}`{} LIMIT {} OFFSET {}",
            database, table, order_clause, page_size, offset
        )
    } else if is_sqlite {
        // SQLite has no schema prefix; use double-quote identifier quoting
        format!(
            "SELECT * FROM \"{}\"{}  LIMIT {} OFFSET {}",
            table, order_clause, page_size, offset
        )
    } else {
        format!(
            "SELECT * FROM \"{}\".\"{}\"{}  LIMIT {} OFFSET {}",
            database, table, order_clause, page_size, offset
        )
    };
    execute_query(id, database, sql, state).await
}

use crate::storage::ConnectionConfig;
use serde_json::Value;
use sqlx::{sqlite::SqliteRow, Column, Row, TypeInfo};

pub async fn create_pool(config: &ConnectionConfig) -> Result<sqlx::SqlitePool, String> {
    let url = if config.database.trim() == ":memory:" {
        "sqlite::memory:".to_string()
    } else {
        format!("sqlite://{}", config.database.trim())
    };
    sqlx::SqlitePool::connect(&url)
        .await
        .map_err(|e| e.to_string())
}

pub async fn get_databases(_pool: &sqlx::SqlitePool) -> Result<Vec<String>, String> {
    Ok(vec!["main".to_string()])
}

pub async fn get_tables(
    pool: &sqlx::SqlitePool,
    _database: &str,
) -> Result<Vec<crate::commands::query::TableInfo>, String> {
    let rows = sqlx::query(
        "SELECT name, type FROM sqlite_master \
         WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' \
         ORDER BY type, name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            let name: String = r.try_get(0).map_err(|e| e.to_string())?;
            let t: String = r.try_get(1).map_err(|e| e.to_string())?;
            let table_type = if t == "view" { "view" } else { "table" }.to_string();
            Ok(crate::commands::query::TableInfo { name, table_type })
        })
        .collect()
}

pub async fn get_columns(
    pool: &sqlx::SqlitePool,
    _database: &str,
    table: &str,
) -> Result<Vec<crate::commands::query::ColumnInfo>, String> {
    let sql = format!("PRAGMA table_info(\"{}\")", table);
    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            let name: String = r.try_get("name").map_err(|e| e.to_string())?;
            let data_type: String = r.try_get("type").map_err(|e| e.to_string())?;
            let notnull: i32 = r.try_get("notnull").map_err(|e| e.to_string())?;
            let dflt_value: Option<String> = r.try_get("dflt_value").ok().flatten();
            let pk: i32 = r.try_get("pk").map_err(|e| e.to_string())?;
            Ok(crate::commands::query::ColumnInfo {
                name,
                data_type,
                nullable: notnull == 0,
                default_value: dflt_value,
                is_primary_key: pk > 0,
            })
        })
        .collect()
}

pub fn columns(row: &SqliteRow) -> Vec<String> {
    row.columns().iter().map(|c| c.name().to_string()).collect()
}

pub fn row_to_json(row: &SqliteRow) -> Vec<Value> {
    (0..row.columns().len())
        .map(|i| decode(row, i))
        .collect()
}

fn decode(row: &SqliteRow, i: usize) -> Value {
    let tn = row.columns()[i].type_info().name().to_uppercase();

    if tn == "INTEGER" || tn == "INT" {
        return match row.try_get::<Option<i64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Number(v.into()),
            Err(_) => Value::Null,
        };
    }

    if tn == "REAL" || tn == "FLOAT" || tn == "DOUBLE" || tn == "NUMERIC" {
        return match row.try_get::<Option<f64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => serde_json::Number::from_f64(v)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            Err(_) => Value::Null,
        };
    }

    if tn == "BLOB" {
        return match row.try_get::<Option<Vec<u8>>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(bytes)) => {
                let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
                Value::String(format!("0x{}", hex))
            }
            Err(_) => Value::Null,
        };
    }

    // TEXT and everything else (SQLite is flexible with types)
    match row.try_get::<Option<String>, _>(i) {
        Ok(None) => Value::Null,
        Ok(Some(v)) => Value::String(v),
        Err(_) => {
            if let Ok(Some(v)) = row.try_get::<Option<i64>, _>(i) {
                return Value::Number(v.into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<f64>, _>(i) {
                if let Some(n) = serde_json::Number::from_f64(v) {
                    return Value::Number(n);
                }
            }
            Value::Null
        }
    }
}

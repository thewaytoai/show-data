use crate::storage::ConnectionConfig;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use serde_json::Value;
use sqlx::{mysql::MySqlRow, Column, Row, TypeInfo};

// MySQL 8 information_schema 的字符串列会被 sqlx 报告为 VARBINARY，
// 需要先尝试 String，失败则读 Vec<u8> 转 UTF-8。
fn get_str(row: &MySqlRow, idx: usize) -> Result<String, String> {
    row.try_get::<String, _>(idx).or_else(|_| {
        row.try_get::<Vec<u8>, _>(idx)
            .map_err(|e| e.to_string())
            .and_then(|b| String::from_utf8(b).map_err(|e| e.to_string()))
    })
}

fn get_opt_str(row: &MySqlRow, idx: usize) -> Option<String> {
    row.try_get::<Option<String>, _>(idx)
        .ok()
        .flatten()
        .or_else(|| {
            row.try_get::<Option<Vec<u8>>, _>(idx)
                .ok()
                .flatten()
                .and_then(|b| String::from_utf8(b).ok())
        })
}

fn bytes_to_value(bytes: Vec<u8>) -> Value {
    String::from_utf8(bytes.clone())
        .map(Value::String)
        .unwrap_or_else(|_| {
            let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
            Value::String(format!("0x{}", hex))
        })
}

pub async fn create_pool(config: &ConnectionConfig) -> Result<sqlx::MySqlPool, String> {
    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );
    sqlx::MySqlPool::connect(&url)
        .await
        .map_err(|e| e.to_string())
}

/// Create a single connection to a specific database (avoids USE statement).
pub async fn connect_to_db(
    config: &ConnectionConfig,
    database: &str,
) -> Result<sqlx::MySqlConnection, String> {
    use sqlx::ConnectOptions;
    use sqlx::mysql::MySqlConnectOptions;
    let mut opts = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password);
    if !database.is_empty() {
        opts = opts.database(database);
    }
    opts.connect().await.map_err(|e| e.to_string())
}

pub async fn get_databases(pool: &sqlx::MySqlPool) -> Result<Vec<String>, String> {
    // 用 information_schema 代替 SHOW DATABASES，避免 VARBINARY 列问题
    let rows = sqlx::query(
        "SELECT schema_name FROM information_schema.SCHEMATA ORDER BY schema_name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    rows.iter().map(|r| get_str(r, 0)).collect()
}

pub async fn get_tables(
    pool: &sqlx::MySqlPool,
    database: &str,
) -> Result<Vec<crate::commands::query::TableInfo>, String> {
    let sql = format!(
        "SELECT TABLE_NAME, TABLE_TYPE \
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{}'",
        database
    );
    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|r| {
            let name = get_str(r, 0)?;
            let raw = get_str(r, 1)?;
            let table_type = if raw.contains("VIEW") { "view" } else { "table" }.to_string();
            Ok(crate::commands::query::TableInfo { name, table_type })
        })
        .collect()
}

pub async fn get_columns(
    pool: &sqlx::MySqlPool,
    database: &str,
    table: &str,
) -> Result<Vec<crate::commands::query::ColumnInfo>, String> {
    let sql = format!(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY \
         FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}' \
         ORDER BY ORDINAL_POSITION",
        database, table
    );
    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|r| {
            Ok(crate::commands::query::ColumnInfo {
                name: get_str(r, 0)?,
                data_type: get_str(r, 1)?,
                nullable: get_str(r, 2)? == "YES",
                default_value: get_opt_str(r, 3),
                is_primary_key: get_str(r, 4)? == "PRI",
            })
        })
        .collect()
}

pub fn columns(row: &MySqlRow) -> Vec<String> {
    row.columns().iter().map(|c| c.name().to_string()).collect()
}

pub fn row_to_json(row: &MySqlRow) -> Vec<Value> {
    (0..row.columns().len())
        .map(|i| decode(row, i))
        .collect()
}

fn decode(row: &MySqlRow, i: usize) -> Value {
    let tn = row.columns()[i].type_info().name().to_uppercase();

    // ── 整数 ──────────────────────────────────────────────────────────────────
    if tn.contains("INT") {
        if let Ok(v) = row.try_get::<Option<i64>, _>(i) {
            return v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null);
        }
        if let Ok(v) = row.try_get::<Option<u64>, _>(i) {
            return v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null);
        }
        return Value::Null;
    }

    // ── 浮点 ──────────────────────────────────────────────────────────────────
    if tn == "FLOAT" || tn == "DOUBLE" {
        return match row.try_get::<Option<f64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => serde_json::Number::from_f64(v)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            Err(_) => Value::Null,
        };
    }

    // ── 定点数（sqlx 将 DECIMAL 解码为 String）────────────────────────────────
    if tn == "DECIMAL" || tn == "NUMERIC" {
        return match row.try_get::<Option<String>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v),
            Err(_) => Value::Null,
        };
    }

    // ── 日期时间 ──────────────────────────────────────────────────────────────
    if tn == "DATETIME" || tn == "TIMESTAMP" {
        return match row.try_get::<Option<NaiveDateTime>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()),
            Err(_) => Value::Null,
        };
    }

    if tn == "DATE" {
        return match row.try_get::<Option<NaiveDate>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.to_string()),
            Err(_) => Value::Null,
        };
    }

    if tn == "TIME" {
        return match row.try_get::<Option<NaiveTime>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.to_string()),
            Err(_) => Value::Null,
        };
    }

    if tn == "YEAR" {
        return match row.try_get::<Option<u16>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Number(v.into()),
            Err(_) => Value::Null,
        };
    }

    // ── 布尔 ──────────────────────────────────────────────────────────────────
    if tn == "BOOL" || tn == "BOOLEAN" {
        return match row.try_get::<Option<bool>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Bool(v),
            Err(_) => Value::Null,
        };
    }

    // ── 二进制（BINARY / VARBINARY / *BLOB）──────────────────────────────────
    if tn.starts_with("BINARY") || tn.starts_with("VARBINARY") || tn.ends_with("BLOB") {
        return match row.try_get::<Option<Vec<u8>>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(bytes)) => bytes_to_value(bytes),
            Err(_) => Value::Null,
        };
    }

    // ── BIT ───────────────────────────────────────────────────────────────────
    if tn == "BIT" {
        return match row.try_get::<Option<u64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Number(v.into()),
            Err(_) => Value::Null,
        };
    }

    // ── JSON ──────────────────────────────────────────────────────────────────
    if tn == "JSON" {
        return match row.try_get::<Option<serde_json::Value>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => v,
            Err(_) => match row.try_get::<Option<String>, _>(i) {
                Ok(None) => Value::Null,
                Ok(Some(v)) => Value::String(v),
                Err(_) => Value::Null,
            },
        };
    }

    // ── VARCHAR / CHAR / TEXT / ENUM / SET 及其余所有类型 ────────────────────
    // 先尝试 String，失败再读 Vec<u8>（兼容 VARBINARY 误报情况）
    match row.try_get::<Option<String>, _>(i) {
        Ok(None) => Value::Null,
        Ok(Some(v)) => Value::String(v),
        Err(_) => match row.try_get::<Option<Vec<u8>>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(bytes)) => bytes_to_value(bytes),
            Err(_) => Value::Null,
        },
    }
}

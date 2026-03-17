use crate::storage::ConnectionConfig;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde_json::Value;
use sqlx::{postgres::PgRow, Column, Row, TypeInfo};

pub async fn create_pool(config: &ConnectionConfig) -> Result<sqlx::PgPool, String> {
    let url = format!(
        "postgresql://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );
    sqlx::PgPool::connect(&url)
        .await
        .map_err(|e| e.to_string())
}

pub async fn get_databases(pool: &sqlx::PgPool) -> Result<Vec<String>, String> {
    let rows =
        sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|r| r.try_get::<String, _>(0).map_err(|e| e.to_string()))
        .collect()
}

pub async fn get_tables(
    pool: &sqlx::PgPool,
    _database: &str,
) -> Result<Vec<crate::commands::query::TableInfo>, String> {
    let rows = sqlx::query(
        "SELECT table_name, table_type FROM information_schema.tables \
         WHERE table_schema = 'public' ORDER BY table_name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|r| {
            let name: String = r.try_get(0).map_err(|e| e.to_string())?;
            let raw: String = r.try_get(1).map_err(|e| e.to_string())?;
            let table_type = if raw.contains("VIEW") { "view" } else { "table" }.to_string();
            Ok(crate::commands::query::TableInfo { name, table_type })
        })
        .collect()
}

pub async fn get_columns(
    pool: &sqlx::PgPool,
    _database: &str,
    table: &str,
) -> Result<Vec<crate::commands::query::ColumnInfo>, String> {
    let sql = format!(
        "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, \
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END \
         FROM information_schema.columns c \
         LEFT JOIN ( \
           SELECT ku.column_name FROM information_schema.table_constraints tc \
           JOIN information_schema.key_column_usage ku \
             ON tc.constraint_name = ku.constraint_name \
           WHERE tc.constraint_type = 'PRIMARY KEY' AND ku.table_name = '{}' \
         ) pk ON c.column_name = pk.column_name \
         WHERE c.table_name = '{}' AND c.table_schema = 'public' \
         ORDER BY c.ordinal_position",
        table, table
    );
    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    rows.iter()
        .map(|r| {
            Ok(crate::commands::query::ColumnInfo {
                name: r.try_get(0).map_err(|e| e.to_string())?,
                data_type: r.try_get(1).map_err(|e| e.to_string())?,
                nullable: r.try_get::<String, _>(2).map_err(|e| e.to_string())? == "YES",
                default_value: r.try_get::<Option<String>, _>(3).unwrap_or(None),
                is_primary_key: r.try_get::<bool, _>(4).unwrap_or(false),
            })
        })
        .collect()
}

pub fn columns(row: &PgRow) -> Vec<String> {
    row.columns().iter().map(|c| c.name().to_string()).collect()
}

pub fn row_to_json(row: &PgRow) -> Vec<Value> {
    (0..row.columns().len())
        .map(|i| decode(row, i))
        .collect()
}

fn decode(row: &PgRow, i: usize) -> Value {
    let tn = row.columns()[i].type_info().name().to_uppercase();

    if tn == "BOOL" {
        return match row.try_get::<Option<bool>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Bool(v),
            Err(_) => Value::Null,
        };
    }

    if tn == "INT2" || tn == "INT4" || tn == "INT8" {
        return match row.try_get::<Option<i64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::Number(v.into()),
            Err(_) => Value::Null,
        };
    }

    if tn == "FLOAT4" || tn == "FLOAT8" {
        return match row.try_get::<Option<f64>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => serde_json::Number::from_f64(v)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            Err(_) => Value::Null,
        };
    }

    if tn == "TIMESTAMP" {
        return match row.try_get::<Option<NaiveDateTime>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()),
            Err(_) => Value::Null,
        };
    }

    if tn == "TIMESTAMPTZ" {
        return match row.try_get::<Option<DateTime<Utc>>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.format("%Y-%m-%d %H:%M:%S %Z").to_string()),
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

    if tn == "TIME" || tn == "TIMETZ" {
        return match row.try_get::<Option<NaiveTime>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => Value::String(v.to_string()),
            Err(_) => Value::Null,
        };
    }

    if tn == "JSON" || tn == "JSONB" {
        return match row.try_get::<Option<serde_json::Value>, _>(i) {
            Ok(None) => Value::Null,
            Ok(Some(v)) => v,
            Err(_) => Value::Null,
        };
    }

    // TEXT, VARCHAR, UUID, NUMERIC, CHAR, etc.
    match row.try_get::<Option<String>, _>(i) {
        Ok(None) => Value::Null,
        Ok(Some(v)) => Value::String(v),
        Err(_) => Value::Null,
    }
}

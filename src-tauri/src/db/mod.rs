pub mod mysql;
pub mod postgres;

pub enum ConnectionPool {
    MySql(sqlx::MySqlPool),
    Postgres(sqlx::PgPool),
}

impl ConnectionPool {
    pub fn cloned(&self) -> PoolRef {
        match self {
            ConnectionPool::MySql(p) => PoolRef::MySql(p.clone()),
            ConnectionPool::Postgres(p) => PoolRef::Postgres(p.clone()),
        }
    }

    pub fn into_ref(self) -> PoolRef {
        match self {
            ConnectionPool::MySql(p) => PoolRef::MySql(p),
            ConnectionPool::Postgres(p) => PoolRef::Postgres(p),
        }
    }
}

pub enum PoolRef {
    MySql(sqlx::MySqlPool),
    Postgres(sqlx::PgPool),
}

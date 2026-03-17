export type DbType = "mysql" | "postgres";

export interface ConnectionConfig {
  id: string;
  name: string;
  db_type: DbType;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface TableInfo {
  name: string;
  table_type: "table" | "view";
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  affected_rows?: number;
  error?: string;
}

export interface SqlEditorTab {
  id: string;
  type: "sql-editor";
  title: string;
  connectionId: string;
  database: string;
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
}

export interface TableViewerTab {
  id: string;
  type: "table-viewer";
  title: string;
  connectionId: string;
  database: string;
  table: string;
  result: QueryResult | null;
  isLoading: boolean;
  page: number;
}

export type Tab = SqlEditorTab | TableViewerTab;

export interface TreeState {
  databases: Record<string, string[]>; // dbName -> table names
  expandedDbs: Set<string>;
}

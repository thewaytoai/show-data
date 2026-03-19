import { invoke } from "@tauri-apps/api/core";
import {
  ConnectionConfig,
  QueryResult,
  TableInfo,
  ColumnInfo,
} from "../types";

export const api = {
  saveConnection: (config: ConnectionConfig) =>
    invoke<string>("save_connection", { config }),

  listConnections: () => invoke<ConnectionConfig[]>("list_connections"),

  deleteConnection: (id: string) =>
    invoke<void>("delete_connection", { id }),

  testConnection: (config: ConnectionConfig) =>
    invoke<string>("test_connection", { config }),

  connect: (id: string) => invoke<void>("connect", { id }),

  disconnect: (id: string) => invoke<void>("disconnect", { id }),

  getDatabases: (id: string) =>
    invoke<string[]>("get_databases", { id }),

  getTables: (id: string, database: string) =>
    invoke<TableInfo[]>("get_tables", { id, database }),

  getTableColumns: (id: string, database: string, table: string) =>
    invoke<ColumnInfo[]>("get_table_columns", { id, database, table }),

  executeQuery: (id: string, database: string, sql: string) =>
    invoke<QueryResult>("execute_query", { id, database, sql }),

  getTableData: (
    id: string,
    database: string,
    table: string,
    page: number,
    pageSize: number,
    sortCol?: string | null,
    sortDir?: "asc" | "desc"
  ) =>
    invoke<QueryResult>("get_table_data", {
      id,
      database,
      table,
      page,
      pageSize,
      sortCol: sortCol ?? null,
      sortDir: sortDir ?? "asc",
    }),

  exportFile: (filename: string, content: string) =>
    invoke<string>("export_file", { filename, content }),
};

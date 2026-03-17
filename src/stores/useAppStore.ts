import { create } from "zustand";
import { ConnectionConfig, Tab, QueryResult } from "../types";
import { api } from "../lib/tauri";

interface TreeNode {
  databases: string[];
  tables: Record<string, string[]>;
  expandedDbs: Set<string>;
}

interface AppState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  connectedIds: Set<string>;
  tree: Record<string, TreeNode>;
  tabs: Tab[];
  activeTabId: string | null;

  loadConnections: () => Promise<void>;
  saveConnection: (config: ConnectionConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;

  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  loadDatabases: (id: string) => Promise<void>;
  loadTables: (id: string, database: string) => Promise<void>;
  toggleDatabase: (id: string, database: string) => void;

  openSqlEditor: (connectionId: string, database: string) => void;
  openTableViewer: (
    connectionId: string,
    database: string,
    table: string
  ) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  runQuery: (tabId: string) => Promise<void>;
  loadTableData: (tabId: string, page?: number) => Promise<void>;
}

let tabCounter = 0;
function newId() {
  return `tab-${++tabCounter}-${Date.now()}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectedIds: new Set(),
  tree: {},
  tabs: [],
  activeTabId: null,

  loadConnections: async () => {
    const connections = await api.listConnections();
    set({ connections });
  },

  saveConnection: async (config) => {
    const id = await api.saveConnection(config);
    const updated = { ...config, id };
    set((s) => {
      const exists = s.connections.find((c) => c.id === id);
      return {
        connections: exists
          ? s.connections.map((c) => (c.id === id ? updated : c))
          : [...s.connections, updated],
      };
    });
  },

  deleteConnection: async (id) => {
    await api.deleteConnection(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      connectedIds: new Set([...s.connectedIds].filter((i) => i !== id)),
      tabs: s.tabs.filter((t) => t.connectionId !== id),
      activeTabId:
        s.activeTabId &&
        s.tabs.find((t) => t.id === s.activeTabId)?.connectionId === id
          ? null
          : s.activeTabId,
    }));
  },

  connect: async (id) => {
    await api.connect(id);
    set((s) => ({ connectedIds: new Set([...s.connectedIds, id]) }));
    await get().loadDatabases(id);
  },

  disconnect: async (id) => {
    await api.disconnect(id);
    set((s) => {
      const next = new Set(s.connectedIds);
      next.delete(id);
      return { connectedIds: next };
    });
  },

  loadDatabases: async (id) => {
    const databases = await api.getDatabases(id);
    set((s) => ({
      tree: {
        ...s.tree,
        [id]: {
          databases,
          tables: s.tree[id]?.tables ?? {},
          expandedDbs: s.tree[id]?.expandedDbs ?? new Set(),
        },
      },
    }));
  },

  loadTables: async (id, database) => {
    const tables = await api.getTables(id, database);
    set((s) => ({
      tree: {
        ...s.tree,
        [id]: {
          ...s.tree[id],
          tables: {
            ...s.tree[id]?.tables,
            [database]: tables.map((t) => t.name),
          },
        },
      },
    }));
  },

  toggleDatabase: (id, database) => {
    set((s) => {
      const node = s.tree[id];
      if (!node) return s;
      const next = new Set(node.expandedDbs);
      if (next.has(database)) {
        next.delete(database);
      } else {
        next.add(database);
      }
      return {
        tree: { ...s.tree, [id]: { ...node, expandedDbs: next } },
      };
    });
  },

  openSqlEditor: (connectionId, database) => {
    const conn = get().connections.find((c) => c.id === connectionId);
    const id = newId();
    const tab: Tab = {
      id,
      type: "sql-editor",
      title: `Query - ${conn?.name ?? connectionId}`,
      connectionId,
      database,
      sql: "",
      result: null,
      isRunning: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
  },

  openTableViewer: (connectionId, database, table) => {
    const existing = get().tabs.find(
      (t) =>
        t.type === "table-viewer" &&
        t.connectionId === connectionId &&
        t.database === database &&
        t.table === table
    ) as Tab | undefined;
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const id = newId();
    const tab: Tab = {
      id,
      type: "table-viewer",
      title: table,
      connectionId,
      database,
      table,
      result: null,
      isLoading: false,
      page: 1,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    get().loadTableData(id, 1);
  },

  closeTab: (tabId) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      let activeTabId = s.activeTabId;
      if (activeTabId === tabId) {
        activeTabId =
          tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
      }
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabSql: (tabId, sql) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId && t.type === "sql-editor" ? { ...t, sql } : t
      ),
    }));
  },

  runQuery: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.type !== "sql-editor") return;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isRunning: true, result: null } : t
      ),
    }));
    try {
      const result = await api.executeQuery(
        tab.connectionId,
        tab.database,
        tab.sql
      );
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isRunning: false, result } : t
        ),
      }));
    } catch (err) {
      const result: QueryResult = {
        columns: [],
        rows: [],
        error: String(err),
      };
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isRunning: false, result } : t
        ),
      }));
    }
  },

  loadTableData: async (tabId, page = 1) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.type !== "table-viewer") return;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isLoading: true, page } : t
      ),
    }));
    try {
      const result = await api.getTableData(
        tab.connectionId,
        tab.database,
        tab.table,
        page,
        100
      );
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isLoading: false, result, page } : t
        ),
      }));
    } catch (err) {
      const result: QueryResult = {
        columns: [],
        rows: [],
        error: String(err),
      };
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isLoading: false, result } : t
        ),
      }));
    }
  },
}));

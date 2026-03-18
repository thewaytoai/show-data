import { useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import { ConnectionConfig } from "../types";
import { ConnectionDialog } from "./ConnectionDialog";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { api } from "../lib/tauri";

// ── SVG icon atoms ────────────────────────────────────────────────────────────

function IconServer({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1.5" width="12" height="3.5" rx="1" stroke={color} strokeWidth="1.1" />
      <rect x="1" y="6.5" width="12" height="3.5" rx="1" stroke={color} strokeWidth="1.1" />
      <circle cx="10.5" cy="3.25" r="0.9" fill={color} />
      <circle cx="10.5" cy="8.25" r="0.9" fill={color} />
      <path d="M3 11.5h8" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <ellipse cx="6.5" cy="3.5" rx="4.5" ry="1.7" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 3.5v6c0 .94 2.01 1.7 4.5 1.7S11 10.44 11 9.5v-6" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 6.5c0 .94 2.01 1.7 4.5 1.7S11 7.44 11 6.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M0.75 4h10.5M4 0.75V11.25" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function IconView() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const {
    connections, connectedIds, tree,
    connect, disconnect, loadTables, toggleDatabase,
    openSqlEditor, openTableViewer, deleteConnection,
  } = useAppStore();

  const [showNewConn, setShowNewConn] = useState(false);
  const [editConn, setEditConn] = useState<ConnectionConfig | null>(null);

  return (
    <aside className="w-full h-full flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Connections</span>
        <button
          onClick={() => setShowNewConn(true)}
          className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
          title="New connection"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {connections.map((conn) => (
          <ConnectionNode
            key={conn.id}
            conn={conn}
            connected={connectedIds.has(conn.id)}
            tree={tree[conn.id]}
            onConnect={() => connect(conn.id)}
            onDisconnect={() => disconnect(conn.id)}
            onEdit={() => setEditConn(conn)}
            onDelete={() => deleteConnection(conn.id)}
            onToggleDb={(db) => {
              toggleDatabase(conn.id, db);
              if (!tree[conn.id]?.tables[db]) loadTables(conn.id, db);
            }}
            onOpenEditor={(db, prefill) => openSqlEditor(conn.id, db, prefill)}
            onOpenTable={(db, table) => openTableViewer(conn.id, db, table)}
            onReloadTables={(db) => loadTables(conn.id, db)}
          />
        ))}
        {connections.length === 0 && (
          <div className="text-xs text-gray-600 px-4 py-8 text-center leading-relaxed">
            No connections yet
            <br />
            <span className="text-gray-700">Click + to add one</span>
          </div>
        )}
      </div>

      {showNewConn && <ConnectionDialog onClose={() => setShowNewConn(false)} />}
      {editConn && <ConnectionDialog initial={editConn} onClose={() => setEditConn(null)} />}
    </aside>
  );
}

// ── ConnectionNode ────────────────────────────────────────────────────────────

interface ConnNodeProps {
  conn: ConnectionConfig;
  connected: boolean;
  tree: { databases: string[]; tables: Record<string, string[]>; expandedDbs: Set<string> } | undefined;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onToggleDb: (db: string) => void;
  onOpenEditor: (db: string, prefill?: string) => void;
  onOpenTable: (db: string, table: string) => void;
  onReloadTables: (db: string) => void;
}

function ConnectionNode({
  conn, connected, tree,
  onConnect, onDisconnect, onEdit, onDelete,
  onToggleDb, onOpenEditor, onOpenTable, onReloadTables,
}: ConnNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connMenu, setConnMenu] = useState<{ x: number; y: number } | null>(null);

  const toggle = async () => {
    if (!connected) {
      setIsConnecting(true);
      setError(null);
      try {
        await onConnect();
        setExpanded(true);
      } catch (err) {
        setError(String(err));
      } finally {
        setIsConnecting(false);
      }
    } else {
      setExpanded((v) => !v);
    }
  };

  const handleDisconnect = async () => {
    await onDisconnect();
    setExpanded(false);
    setError(null);
  };

  function buildConnMenuSections(): ContextMenuItem[][] {
    const firstDb = tree?.databases[0];
    return [
      [
        connected
          ? { label: "Disconnect", onClick: handleDisconnect }
          : { label: "Connect", onClick: toggle },
        {
          label: "New Query…",
          disabled: !connected || !firstDb,
          onClick: () => firstDb && onOpenEditor(firstDb, ""),
        },
      ],
      [
        { label: "Edit Connection", onClick: onEdit },
      ],
      [
        { label: "Delete Connection", danger: true, onClick: () => onDelete() },
      ],
    ];
  }

  const serverColor = conn.db_type === "mysql" ? "#60A5FA" : "#A78BFA";

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800/70 cursor-pointer group relative"
        onClick={toggle}
        onContextMenu={(e) => { e.preventDefault(); setConnMenu({ x: e.clientX, y: e.clientY }); }}
      >
        <IconServer color={serverColor} />
        <span className="flex-1 text-sm text-gray-200 truncate font-medium">{conn.name}</span>

        {isConnecting ? (
          <span className="text-[10px] text-yellow-400 animate-pulse">connecting…</span>
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-green-400" : "bg-gray-600"}`} />
        )}

        <button
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-all ml-0.5"
          onClick={(e) => { e.stopPropagation(); setConnMenu({ x: e.clientX, y: e.clientY }); }}
          title="More options"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="6" cy="2.5" r="1.1" /><circle cx="6" cy="6" r="1.1" /><circle cx="6" cy="9.5" r="1.1" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mx-3 mb-1 px-2 py-1.5 bg-red-950/50 border border-red-800/60 rounded text-[11px] text-red-400 leading-relaxed">
          {error}
        </div>
      )}

      {expanded && connected && tree && (
        <div className="ml-3 border-l border-gray-800 pl-2">
          {tree.databases.map((db) => (
            <DbNode
              key={db}
              db={db}
              connId={conn.id}
              dbType={conn.db_type}
              expanded={tree.expandedDbs.has(db)}
              tables={tree.tables[db] ?? null}
              onToggle={() => onToggleDb(db)}
              onOpenEditor={(prefill) => onOpenEditor(db, prefill)}
              onOpenTable={(t) => onOpenTable(db, t)}
              onReloadTables={() => onReloadTables(db)}
            />
          ))}
          {tree.databases.length === 0 && (
            <span className="text-[11px] text-gray-600 pl-2 py-1 block">No databases</span>
          )}
        </div>
      )}

      {connMenu && (
        <ContextMenu
          x={connMenu.x}
          y={connMenu.y}
          sections={buildConnMenuSections()}
          onClose={() => setConnMenu(null)}
        />
      )}
    </div>
  );
}

// ── DbNode ────────────────────────────────────────────────────────────────────

interface DbNodeProps {
  db: string;
  connId: string;
  dbType: string;
  expanded: boolean;
  tables: string[] | null;
  onToggle: () => void;
  onOpenEditor: (prefill?: string) => void;
  onOpenTable: (t: string) => void;
  onReloadTables: () => void;
}

function DbNode({
  db, connId, dbType, expanded, tables,
  onToggle, onOpenEditor, onOpenTable, onReloadTables,
}: DbNodeProps) {
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; table: string; isView: boolean } | null>(null);
  const [dbMenu, setDbMenu] = useState<{ x: number; y: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function q(name: string) {
    return dbType === "postgres" ? `"${name}"` : `\`${name}\``;
  }

  async function execSql(sql: string) {
    const res = await api.executeQuery(connId, db, sql);
    if (res.error) throw new Error(res.error);
  }

  function buildDbMenuSections(): ContextMenuItem[][] {
    return [
      [
        { label: "New Query", onClick: () => onOpenEditor("") },
        { label: "New Query (SELECT 1)", onClick: () => onOpenEditor("SELECT 1;") },
      ],
      [
        { label: "Refresh Tables", onClick: onReloadTables },
        { label: "Copy Database Name", onClick: () => navigator.clipboard?.writeText(db) },
      ],
    ];
  }

  function buildTableMenuSections(table: string): ContextMenuItem[][] {
    const designSql = dbType === "postgres"
      ? `SELECT column_name, data_type, is_nullable, column_default\nFROM information_schema.columns\nWHERE table_schema = 'public' AND table_name = '${table}'\nORDER BY ordinal_position;`
      : `DESCRIBE ${q(table)};`;

    return [
      [
        { label: "Open Table", onClick: () => onOpenTable(table) },
        { label: "Design Table (Show Structure)", onClick: () => onOpenEditor(designSql) },
      ],
      [
        { label: "New Query (SELECT *)", onClick: () => onOpenEditor(`SELECT * FROM ${q(table)} LIMIT 100;`) },
        { label: "New Query (empty)", onClick: () => onOpenEditor("") },
        { label: "New Query (COUNT)", onClick: () => onOpenEditor(`SELECT COUNT(*) FROM ${q(table)};`) },
      ],
      [
        { label: "Copy Table Name", onClick: () => navigator.clipboard?.writeText(table) },
        { label: "Copy Full Name", onClick: () => navigator.clipboard?.writeText(`${db}.${table}`) },
        { label: "Copy SELECT Statement", onClick: () => navigator.clipboard?.writeText(`SELECT * FROM ${q(table)} LIMIT 100;`) },
        { label: "Copy INSERT Template", onClick: () => navigator.clipboard?.writeText(`INSERT INTO ${q(table)} () VALUES ();`) },
      ],
      [
        { label: "Refresh Tables", onClick: onReloadTables },
      ],
      [
        {
          label: "Truncate Table…",
          danger: true,
          onClick: async () => {
            if (!confirm(`Truncate "${table}"? This deletes ALL rows and cannot be undone.`)) return;
            try {
              await execSql(`TRUNCATE TABLE ${q(table)}`);
              onOpenTable(table);
            } catch (e) {
              setActionError(String(e));
              setTimeout(() => setActionError(null), 5000);
            }
          },
        },
        {
          label: "Drop Table…",
          danger: true,
          onClick: async () => {
            if (!confirm(`Drop table "${table}"? This is irreversible.`)) return;
            try {
              await execSql(`DROP TABLE ${q(table)}`);
              onReloadTables();
            } catch (e) {
              setActionError(String(e));
              setTimeout(() => setActionError(null), 5000);
            }
          },
        },
      ],
    ];
  }

  return (
    <div>
      {/* Database row */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-800/70 cursor-pointer group rounded"
        onClick={onToggle}
        onContextMenu={(e) => { e.preventDefault(); setDbMenu({ x: e.clientX, y: e.clientY }); }}
      >
        <span className="text-gray-600 text-[10px] w-3 text-center flex-shrink-0">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="text-yellow-600/80"><IconDatabase /></span>
        <span className="flex-1 text-sm text-gray-300 truncate">{db}</span>
        <button
          className="opacity-0 group-hover:opacity-60 text-gray-500 hover:text-blue-400 text-[10px] flex-shrink-0 px-1"
          title="New query"
          onClick={(e) => { e.stopPropagation(); onOpenEditor(""); }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 2L5 5.5L1.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 9h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {actionError && (
        <div className="mx-2 mb-1 px-2 py-1 bg-red-950/50 border border-red-800/60 rounded text-[11px] text-red-400">
          {actionError}
        </div>
      )}

      {/* Table list */}
      {expanded && tables !== null && (
        <div className="ml-2 border-l border-gray-800/60 pl-2">
          {tables.map((t) => {
            // Tables from information_schema have a table_type but here we just have names.
            // Views aren't distinguished here; use table icon for all.
            return (
              <div
                key={t}
                className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-800/60 cursor-pointer group/row rounded"
                onClick={() => onOpenTable(t)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTableMenu({ x: e.clientX, y: e.clientY, table: t, isView: false });
                }}
              >
                <span className="text-gray-600"><IconTable /></span>
                <span className="flex-1 text-xs text-gray-400 truncate">{t}</span>
                <span className="opacity-0 group-hover/row:opacity-40 text-gray-600 text-[10px]">⋮</span>
              </div>
            );
          })}
          {tables.length === 0 && (
            <span className="text-[11px] text-gray-600 pl-2 py-0.5 block">No tables</span>
          )}
        </div>
      )}

      {expanded && tables === null && (
        <div className="pl-8 py-1">
          <span className="text-[11px] text-gray-600 animate-pulse">Loading…</span>
        </div>
      )}

      {tableMenu && (
        <ContextMenu
          x={tableMenu.x}
          y={tableMenu.y}
          sections={buildTableMenuSections(tableMenu.table)}
          onClose={() => setTableMenu(null)}
        />
      )}

      {dbMenu && (
        <ContextMenu
          x={dbMenu.x}
          y={dbMenu.y}
          sections={buildDbMenuSections()}
          onClose={() => setDbMenu(null)}
        />
      )}
    </div>
  );
}

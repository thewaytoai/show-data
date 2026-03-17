import { useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import { ConnectionConfig } from "../types";
import { ConnectionDialog } from "./ConnectionDialog";

export function Sidebar() {
  const {
    connections,
    connectedIds,
    tree,
    connect,
    disconnect,
    loadTables,
    toggleDatabase,
    openSqlEditor,
    openTableViewer,
    deleteConnection,
  } = useAppStore();

  const [showNewConn, setShowNewConn] = useState(false);
  const [editConn, setEditConn] = useState<ConnectionConfig | null>(null);

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-700">
        <span className="text-sm font-semibold text-gray-300">Connections</span>
        <button
          onClick={() => setShowNewConn(true)}
          className="text-blue-400 hover:text-blue-300 text-xl leading-none"
          title="New connection"
        >
          +
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
              if (!tree[conn.id]?.tables[db]) {
                loadTables(conn.id, db);
              }
            }}
            onOpenEditor={(db) => openSqlEditor(conn.id, db)}
            onOpenTable={(db, table) => openTableViewer(conn.id, db, table)}
          />
        ))}

        {connections.length === 0 && (
          <p className="text-xs text-gray-500 px-4 py-6 text-center">
            No connections yet.
            <br />
            Click + to add one.
          </p>
        )}
      </div>

      {showNewConn && (
        <ConnectionDialog onClose={() => setShowNewConn(false)} />
      )}
      {editConn && (
        <ConnectionDialog
          initial={editConn}
          onClose={() => setEditConn(null)}
        />
      )}
    </aside>
  );
}

interface ConnectionNodeProps {
  conn: ConnectionConfig;
  connected: boolean;
  tree:
    | {
        databases: string[];
        tables: Record<string, string[]>;
        expandedDbs: Set<string>;
      }
    | undefined;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onToggleDb: (db: string) => void;
  onOpenEditor: (db: string) => void;
  onOpenTable: (db: string, table: string) => void;
}

function ConnectionNode({
  conn,
  connected,
  tree,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onToggleDb,
  onOpenEditor,
  onOpenTable,
}: ConnectionNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setShowMenu(false);
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
    setShowMenu(false);
    await onDisconnect();
    setExpanded(false);
    setError(null);
  };

  const dbIcon = conn.db_type === "mysql" ? "🐬" : "🐘";

  return (
    <div>
      <div
        className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-800 cursor-pointer group"
        onClick={toggle}
      >
        <span className="text-xs">{dbIcon}</span>
        <span className="flex-1 text-sm text-gray-200 truncate">{conn.name}</span>
        {isConnecting ? (
          <span className="text-xs text-yellow-400 animate-pulse">…</span>
        ) : (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connected ? "bg-green-400" : "bg-gray-600"
            }`}
          />
        )}
        <button
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 text-xs ml-1"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((v) => !v);
          }}
        >
          ⋯
        </button>
      </div>

      {error && (
        <div className="mx-3 mb-1 px-2 py-1 bg-red-900/40 border border-red-700 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {showMenu && (
        <div className="mx-3 mb-1 bg-gray-700 rounded border border-gray-600 text-xs">
          {connected ? (
            <MenuItem onClick={handleDisconnect}>Disconnect</MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                setShowMenu(false);
                toggle();
              }}
            >
              Connect
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setShowMenu(false);
              onEdit();
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              setShowMenu(false);
              onDelete();
            }}
            danger
          >
            Delete
          </MenuItem>
        </div>
      )}

      {expanded && connected && tree && (
        <div className="pl-4">
          {tree.databases.map((db) => (
            <DbNode
              key={db}
              db={db}
              expanded={tree.expandedDbs.has(db)}
              tables={tree.tables[db] ?? null}
              onToggle={() => onToggleDb(db)}
              onOpenEditor={() => onOpenEditor(db)}
              onOpenTable={(t) => onOpenTable(db, t)}
            />
          ))}
          {tree.databases.length === 0 && (
            <span className="text-xs text-gray-600 pl-2">No databases</span>
          )}
        </div>
      )}
    </div>
  );
}

function DbNode({
  db,
  expanded,
  tables,
  onToggle,
  onOpenEditor,
  onOpenTable,
}: {
  db: string;
  expanded: boolean;
  tables: string[] | null;
  onToggle: () => void;
  onOpenEditor: () => void;
  onOpenTable: (t: string) => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 cursor-pointer group"
        onClick={onToggle}
      >
        <span className="text-gray-500 text-xs">{expanded ? "▾" : "▸"}</span>
        <span className="text-xs">🗄️</span>
        <span className="flex-1 text-sm text-gray-300 truncate">{db}</span>
        <button
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-400 text-xs"
          title="New query"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditor();
          }}
        >
          ▷
        </button>
      </div>
      {expanded && tables && (
        <div className="pl-4">
          {tables.map((t) => (
            <div
              key={t}
              className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800 cursor-pointer"
              onClick={() => onOpenTable(t)}
            >
              <span className="text-xs">📋</span>
              <span className="text-xs text-gray-400 truncate">{t}</span>
            </div>
          ))}
          {tables.length === 0 && (
            <span className="text-xs text-gray-600 pl-2">No tables</span>
          )}
        </div>
      )}
      {expanded && tables === null && (
        <div className="pl-6 py-1">
          <span className="text-xs text-gray-500">Loading…</span>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 hover:bg-gray-600 ${
        danger ? "text-red-400" : "text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

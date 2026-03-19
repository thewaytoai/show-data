import { useEffect, useState, useRef } from "react";
import { useAppStore } from "./stores/useAppStore";
import { Sidebar } from "./components/Sidebar";
import { TabManager } from "./components/TabManager";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { TableViewerTab } from "./types";
import { api } from "./lib/tauri";

export function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sd-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818CF8" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sd-logo-grad)" />
      <ellipse cx="16" cy="10.5" rx="8" ry="3" fill="white" fillOpacity="0.92" />
      <rect x="8" y="10.5" width="16" height="11" fill="white" fillOpacity="0.14" />
      <ellipse cx="16" cy="16" rx="8" ry="3" fill="none" stroke="white" strokeOpacity="0.42" strokeWidth="0.9" />
      <ellipse cx="16" cy="21.5" rx="8" ry="3" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 520;

// ── Platform ──────────────────────────────────────────────────────────────────

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

// ── Keyboard shortcuts data ───────────────────────────────────────────────────

const SQL_SHORTCUTS = [
  { keys: [MOD, "Enter"], desc: "Run query" },
  { keys: [MOD, "Space"], desc: "Autocomplete" },
  { keys: [MOD, "F"], desc: "Find in editor" },
  { keys: [MOD, "H"], desc: "Find & replace" },
  { keys: [MOD, "/"], desc: "Toggle line comment" },
  { keys: [MOD, "Z"], desc: "Undo" },
  { keys: [MOD, "Shift", "Z"], desc: "Redo" },
  { keys: [MOD, "A"], desc: "Select all" },
  { keys: ["Alt", "↑ / ↓"], desc: "Move line up / down" },
  { keys: [MOD, "D"], desc: "Select next occurrence" },
];

const TABLE_SHORTCUTS = [
  { keys: ["Click column header"], desc: "Sort by column (asc → desc → off)" },
  { keys: ["Double-click cell"], desc: "Edit cell inline" },
  { keys: ["Right-click cell"], desc: "Cell context menu" },
  { keys: ["Right-click row"], desc: "Row context menu (results)" },
];

// ── Helper: save file via Tauri backend ───────────────────────────────────────

async function saveFile(
  filename: string,
  content: string,
  onSaved: (path: string) => void
) {
  try {
    const path = await api.exportFile(filename, content);
    onSaved(path);
  } catch (err) {
    alert(`Export failed: ${err}`);
  }
}

function exportCSV(tab: TableViewerTab, onSaved: (path: string) => void) {
  if (!tab.result?.columns.length) return;
  const { columns, rows } = tab.result;
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  saveFile(`${tab.table}.csv`, csv, onSaved);
}

function exportJSON(tab: TableViewerTab, onSaved: (path: string) => void) {
  if (!tab.result?.columns.length) return;
  const { columns, rows } = tab.result;
  const data = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c, i) => { obj[c] = r[i]; });
    return obj;
  });
  saveFile(`${tab.table}.json`, JSON.stringify(data, null, 2), onSaved);
}

// ── ShortcutsModal ────────────────────────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-x-6">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">SQL Editor</p>
            <div className="space-y-1.5">
              {SQL_SHORTCUTS.map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400">{desc}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k) => (
                      <kbd key={k} className="px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Table Viewer</p>
            <div className="space-y-1.5">
              {TABLE_SHORTCUTS.map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400">{desc}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k) => (
                      <kbd key={k} className="px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function TBtn({
  onClick, disabled, title, children, active,
}: {
  onClick?: () => void; disabled?: boolean; title?: string;
  children: React.ReactNode; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-blue-600/30 text-blue-300 border border-blue-600/40"
          : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/60"
      }`}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded font-mono text-gray-500 leading-none">
      {children}
    </span>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-gray-700 mx-1" />;
}

function Toolbar({ onShowShortcuts, onSaved }: { onShowShortcuts: () => void; onSaved: (path: string) => void }) {
  const { tabs, activeTabId, connections, runQuery, formatSqlTab, loadTableData } = useAppStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const conn = activeTab ? connections.find((c) => c.id === activeTab.connectionId) : null;

  if (!activeTab) {
    return (
      <div className="h-9 flex items-center px-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-700">Open a connection to get started</span>
        <div className="flex-1" />
        <TBtn onClick={onShowShortcuts} title="Keyboard shortcuts">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.75" y="2.75" width="10.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M3 5.5h1M5.5 5.5h1M8 5.5h1M3 7.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Shortcuts
        </TBtn>
      </div>
    );
  }

  // ── Breadcrumb ──
  const dbType = conn?.db_type === "postgres" ? "PG" : conn?.db_type === "sqlite" ? "SQLite" : "MySQL";
  const dbColor = conn?.db_type === "postgres" ? "text-violet-400" : conn?.db_type === "sqlite" ? "text-amber-400" : "text-blue-400";

  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0 overflow-hidden">
      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 flex-shrink-0 ${dbColor}`}>
        {dbType}
      </span>
      <span className="text-gray-400 font-medium truncate">{conn?.name ?? "—"}</span>
      <span className="text-gray-700">›</span>
      <span className="text-gray-400 truncate">{activeTab.database || "—"}</span>
      {activeTab.type === "table-viewer" && (
        <>
          <span className="text-gray-700">›</span>
          <span className="text-gray-300 font-medium truncate">{activeTab.table}</span>
        </>
      )}
    </div>
  );

  // ── SQL Editor toolbar ──
  if (activeTab.type === "sql-editor") {
    return (
      <div className="h-9 flex items-center gap-1 px-3 bg-gray-900 border-b border-gray-800 flex-shrink-0 overflow-hidden">
        {breadcrumb}
        <Divider />

        <TBtn
          onClick={() => runQuery(activeTab.id)}
          disabled={activeTab.isRunning}
          title={`Run query (${MOD}+Enter)`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-green-400">
            <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
          </svg>
          Run
          <Kbd>{MOD}+Enter</Kbd>
        </TBtn>

        <TBtn
          onClick={() => formatSqlTab(activeTab.id)}
          disabled={!activeTab.sql.trim()}
          title="Format SQL keywords and layout"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 2h9M1 5h6M1 8h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Format SQL
        </TBtn>

        <TBtn
          onClick={() => navigator.clipboard?.writeText(activeTab.sql)}
          disabled={!activeTab.sql.trim()}
          title="Copy SQL to clipboard"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="3.5" y="1" width="6.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1 3.5h2M1 3.5v5.5a1 1 0 001 1h5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Copy SQL
        </TBtn>

        <TBtn
          onClick={() => {
            if (!activeTab.result) return;
            const { columns, rows } = activeTab.result;
            const escape = (v: unknown) => {
              if (v === null) return "NULL";
              const s = String(v);
              return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const csv = [columns.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
            saveFile("query-result.csv", csv, onSaved);
          }}
          disabled={!activeTab.result?.columns.length}
          title="Export current results as CSV"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v7M2.5 5.5L5.5 8.5l3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 9.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Export CSV
        </TBtn>

        {activeTab.isRunning && (
          <span className="text-xs text-yellow-400 animate-pulse ml-1">Running…</span>
        )}
        {activeTab.result && !activeTab.isRunning && !activeTab.result.error && activeTab.result.columns.length > 0 && (
          <span className="text-xs text-gray-600 ml-1">{activeTab.result.rows.length} rows</span>
        )}

        <div className="flex-1" />
        <TBtn onClick={onShowShortcuts} title="Keyboard shortcuts">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.75" y="2.75" width="10.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M3 5.5h1M5.5 5.5h1M8 5.5h1M3 7.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Shortcuts
        </TBtn>
      </div>
    );
  }

  // ── Table Viewer toolbar ──
  const tvTab = activeTab;
  const rowCount = tvTab.result?.rows.length;

  return (
    <div className="h-9 flex items-center gap-1 px-3 bg-gray-900 border-b border-gray-800 flex-shrink-0 overflow-hidden">
      {breadcrumb}
      <Divider />

      <TBtn
        onClick={() => loadTableData(tvTab.id, tvTab.page)}
        disabled={tvTab.isLoading}
        title="Reload table data"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M9.5 2A5 5 0 102 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 2.5V5.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Refresh
      </TBtn>

      <TBtn
        onClick={() => exportCSV(tvTab as TableViewerTab, onSaved)}
        disabled={!tvTab.result?.columns.length}
        title="Export current page as CSV"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v7M2.5 5.5L5.5 8.5l3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 9.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Export CSV
      </TBtn>

      <TBtn
        onClick={() => exportJSON(tvTab as TableViewerTab, onSaved)}
        disabled={!tvTab.result?.columns.length}
        title="Export current page as JSON"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v7M2.5 5.5L5.5 8.5l3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 9.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Export JSON
      </TBtn>

      {rowCount !== undefined && (
        <>
          <Divider />
          <span className="text-xs text-gray-600">{rowCount} rows — p.{tvTab.page}</span>
        </>
      )}

      <div className="flex-1" />
      <TBtn onClick={onShowShortcuts} title="Keyboard shortcuts">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="0.75" y="2.75" width="10.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M3 5.5h1M5.5 5.5h1M8 5.5h1M3 7.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        Shortcuts
      </TBtn>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const loadConnections = useAppStore((s) => s.loadConnections);
  const [showNewConn, setShowNewConn] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [toast, setToast] = useState<string | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, w: 240 });

  useEffect(() => { loadConnections(); }, [loadConnections]);

  // Global Ctrl/Cmd+Enter → run active SQL editor query
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const state = useAppStore.getState();
        const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
        if (activeTab?.type === "sql-editor" && !activeTab.isRunning) {
          e.preventDefault();
          e.stopPropagation();
          state.runQuery(activeTab.id);
        }
      }
    };
    // capture:true fires before CodeMirror sees the event
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragStart.current.x;
      setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, dragStart.current.w + delta)));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startSidebarDrag(e: React.MouseEvent) {
    dragging.current = true;
    dragStart.current = { x: e.clientX, w: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const showToast = (path: string) => setToast(`Saved to ${path}`);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <LogoIcon size={28} />
        <div className="leading-none">
          <div className="text-sm font-semibold text-white tracking-tight">Show Data</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Database Manager</div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowNewConn(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md text-white font-medium transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New Connection
        </button>
      </header>

      {/* Contextual toolbar */}
      <Toolbar onShowShortcuts={() => setShowShortcuts(true)} onSaved={showToast} />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex-shrink-0 overflow-hidden">
          <Sidebar />
        </div>
        <div
          className="w-[3px] flex-shrink-0 bg-gray-800 hover:bg-blue-500/50 cursor-col-resize transition-colors"
          onMouseDown={startSidebarDrag}
        />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TabManager />
        </main>
      </div>

      {showNewConn && <ConnectionDialog onClose={() => setShowNewConn(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Save toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg shadow-xl text-xs text-gray-200">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-emerald-400 flex-shrink-0">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 6l2 2L8.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
          <button onClick={() => setToast(null)} className="ml-1 text-gray-500 hover:text-gray-300">×</button>
        </div>
      )}
    </div>
  );
}

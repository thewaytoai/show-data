import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import { SQLEditor } from "./SQLEditor";
import { DataGrid } from "./DataGrid";
import { ResultsPanel } from "./ResultsPanel";
import { SqlEditorTab } from "../types";

const SPLIT_MIN = 15;
const SPLIT_MAX = 85;

export function TabManager() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-600">
        <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="9" fill="#1F2937" />
          <ellipse cx="16" cy="10.5" rx="8" ry="3" fill="#374151" />
          <rect x="8" y="10.5" width="16" height="11" fill="#374151" fillOpacity="0.5" />
          <ellipse cx="16" cy="16" rx="8" ry="3" fill="none" stroke="#4B5563" strokeWidth="0.9" />
          <ellipse cx="16" cy="21.5" rx="8" ry="3" fill="#374151" fillOpacity="0.8" />
        </svg>
        <div className="text-center">
          <p className="text-sm text-gray-500">Open a table or run a query</p>
          <p className="text-xs text-gray-700 mt-1">Right-click a table in the sidebar to get started</p>
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end bg-gray-950 border-b border-gray-800 overflow-x-auto flex-shrink-0 px-1 pt-1 gap-0.5">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer rounded-t-md flex-shrink-0 transition-all ${
              tab.id === activeTabId
                ? "bg-gray-900 text-white border border-b-0 border-gray-700"
                : "text-gray-500 hover:bg-gray-900/50 hover:text-gray-300"
            }`}
          >
            {tab.type === "sql-editor" ? (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-shrink-0 text-blue-400">
                <path d="M1.5 2L5 5.5L1.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 9h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-shrink-0 text-emerald-400">
                <rect x="0.75" y="0.75" width="9.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M0.75 3.75h9.5M3.75 0.75v9.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
            <span className="max-w-[120px] truncate">{tab.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className="opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-gray-600 text-gray-500 hover:text-gray-300 transition-opacity ml-0.5 flex-shrink-0"
            >
              <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                <path d="M1 1l4 4M5 1L1 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Active tab content */}
      {activeTab && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab.type === "sql-editor" ? (
            <SqlEditorLayout tab={activeTab} />
          ) : (
            <DataGrid tab={activeTab} />
          )}
        </div>
      )}
    </div>
  );
}

function SqlEditorLayout({ tab }: { tab: SqlEditorTab }) {
  const [editorPct, setEditorPct] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setEditorPct(Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, pct)));
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

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      <div style={{ height: `${editorPct}%` }} className="flex flex-col overflow-hidden min-h-0">
        <SQLEditor tab={tab} />
      </div>
      {/* Drag handle */}
      <div
        className="h-[3px] flex-shrink-0 bg-gray-800 hover:bg-blue-500/50 cursor-row-resize transition-colors"
        onMouseDown={startDrag}
      />
      <div className="flex-1 overflow-hidden bg-gray-900 min-h-0">
        <ResultsPanel result={tab.result} isLoading={tab.isRunning} />
      </div>
    </div>
  );
}

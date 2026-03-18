import { useEffect, useState, useRef } from "react";
import { useAppStore } from "./stores/useAppStore";
import { Sidebar } from "./components/Sidebar";
import { TabManager } from "./components/TabManager";
import { ConnectionDialog } from "./components/ConnectionDialog";

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

export default function App() {
  const loadConnections = useAppStore((s) => s.loadConnections);
  const [showNewConn, setShowNewConn] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, w: 240 });

  useEffect(() => { loadConnections(); }, [loadConnections]);

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

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
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

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex-shrink-0 overflow-hidden">
          <Sidebar />
        </div>
        {/* Resize handle */}
        <div
          className="w-[3px] flex-shrink-0 bg-gray-800 hover:bg-blue-500/50 cursor-col-resize transition-colors"
          onMouseDown={startSidebarDrag}
        />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TabManager />
        </main>
      </div>

      {showNewConn && <ConnectionDialog onClose={() => setShowNewConn(false)} />}
    </div>
  );
}

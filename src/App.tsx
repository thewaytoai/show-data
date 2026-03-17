import { useEffect, useState } from "react";
import { useAppStore } from "./stores/useAppStore";
import { Sidebar } from "./components/Sidebar";
import { TabManager } from "./components/TabManager";
import { ConnectionDialog } from "./components/ConnectionDialog";

export default function App() {
  const loadConnections = useAppStore((s) => s.loadConnections);
  const [showNewConn, setShowNewConn] = useState(false);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <span className="text-sm font-bold text-blue-400 mr-4">Show Data</span>
        <span className="text-xs text-gray-500">
          Cross-platform Database Manager
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowNewConn(true)}
          className="px-3 py-1.5 text-xs bg-blue-700 hover:bg-blue-600 rounded text-white"
        >
          + New Connection
        </button>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <TabManager />
        </main>
      </div>

      {showNewConn && (
        <ConnectionDialog onClose={() => setShowNewConn(false)} />
      )}
    </div>
  );
}

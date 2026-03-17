import { useAppStore } from "../stores/useAppStore";
import { SQLEditor } from "./SQLEditor";
import { DataGrid } from "./DataGrid";
import { ResultsPanel } from "./ResultsPanel";
import { SqlEditorTab } from "../types";

export function TabManager() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select a table or open a new query editor
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end bg-gray-900 border-b border-gray-700 overflow-x-auto flex-shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-gray-700 flex-shrink-0 ${
              tab.id === activeTabId
                ? "bg-gray-800 text-white border-t-2 border-t-blue-500"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-300"
            }`}
          >
            <span className="text-xs">
              {tab.type === "sql-editor" ? "▶" : "📋"}
            </span>
            <span className="max-w-[120px] truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="text-gray-600 hover:text-gray-300 leading-none"
            >
              ×
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
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Editor takes ~55% height */}
      <div className="flex-[0_0_55%] overflow-hidden border-b border-gray-700">
        <SQLEditor tab={tab} />
      </div>
      {/* Results panel takes the rest */}
      <div className="flex-1 overflow-hidden bg-gray-900">
        <ResultsPanel
          result={tab.result}
          isLoading={tab.isRunning}
        />
      </div>
    </div>
  );
}

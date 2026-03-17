import { useAppStore } from "../stores/useAppStore";
import { TableViewerTab } from "../types";
import { ResultsPanel } from "./ResultsPanel";

interface Props {
  tab: TableViewerTab;
}

export function DataGrid({ tab }: Props) {
  const loadTableData = useAppStore((s) => s.loadTableData);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-400">
          {tab.database}.<strong className="text-gray-200">{tab.table}</strong>
        </span>
        <div className="flex-1" />
        <button
          onClick={() => loadTableData(tab.id, tab.page)}
          disabled={tab.isLoading}
          className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
        >
          ↺ Refresh
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadTableData(tab.id, tab.page - 1)}
            disabled={tab.isLoading || tab.page <= 1}
            className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >
            ‹
          </button>
          <span className="text-xs text-gray-400 px-1">p.{tab.page}</span>
          <button
            onClick={() => loadTableData(tab.id, tab.page + 1)}
            disabled={tab.isLoading || (tab.result?.rows.length ?? 0) < 100}
            className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResultsPanel result={tab.result} isLoading={tab.isLoading} />
      </div>
    </div>
  );
}

import { QueryResult } from "../types";

interface Props {
  result: QueryResult | null;
  isLoading?: boolean;
}

export function ResultsPanel({ result, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <span className="animate-spin mr-2">⟳</span> Loading…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Run a query to see results
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/30 border border-red-700 rounded p-3">
          <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
            {result.error}
          </pre>
        </div>
      </div>
    );
  }

  if (result.affected_rows !== undefined && result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-green-400 text-sm">
        ✓ Query OK — {result.affected_rows} row(s) affected
      </div>
    );
  }

  if (result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No results
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 px-3 py-1 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-400">
          {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-800 sticky top-8">
            <th className="w-12 px-2 py-1.5 text-right text-gray-600 font-normal border-b border-gray-700">
              #
            </th>
            {result.columns.map((col) => (
              <th
                key={col}
                className="px-3 py-1.5 text-left text-gray-300 font-semibold border-b border-gray-700 border-r border-gray-700/50 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-gray-900" : "bg-gray-850 bg-gray-800/50"}
            >
              <td className="px-2 py-1 text-right text-gray-600 border-r border-gray-700/40 select-none">
                {ri + 1}
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1 text-gray-300 border-r border-gray-700/40 max-w-[300px] truncate"
                  title={String(cell ?? "")}
                >
                  {cell === null ? (
                    <span className="text-gray-600 italic">NULL</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

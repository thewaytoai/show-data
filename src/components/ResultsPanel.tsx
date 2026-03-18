import { useState } from "react";
import { QueryResult } from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

interface Props {
  result: QueryResult | null;
  isLoading?: boolean;
}

interface RowMenu { x: number; y: number; rowIdx: number }

export function ResultsPanel({ result, isLoading }: Props) {
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <span className="animate-spin mr-2">⟳</span> Running…
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
        <div className="bg-red-950/40 border border-red-800/60 rounded-md p-3">
          <p className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Error
          </p>
          <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{result.error}</pre>
        </div>
      </div>
    );
  }

  if (result.affected_rows !== undefined && result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-emerald-400 text-sm">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Query OK — {result.affected_rows} row(s) affected
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

  function buildRowMenuSections(rowIdx: number): ContextMenuItem[][] {
    if (!result) return [];
    const row = result.rows[rowIdx];
    return [
      [
        {
          label: "Copy Row as JSON",
          onClick: () => {
            const obj: Record<string, unknown> = {};
            result!.columns.forEach((c, i) => { obj[c] = row[i]; });
            navigator.clipboard?.writeText(JSON.stringify(obj, null, 2));
          },
        },
        {
          label: "Copy Row as CSV",
          onClick: () => {
            const vals = row.map((v) => {
              if (v === null) return "NULL";
              const s = String(v);
              return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"` : s;
            });
            navigator.clipboard?.writeText(vals.join(","));
          },
        },
        {
          label: "Copy Row as INSERT",
          onClick: () => {
            if (!result) return;
            const cols = result.columns.map((c) => `\`${c}\``).join(", ");
            const vals = row.map((v) =>
              v === null ? "NULL" : `'${String(v).replace(/'/g, "\\'")}'`
            ).join(", ");
            navigator.clipboard?.writeText(`INSERT INTO \`table\` (${cols}) VALUES (${vals});`);
          },
        },
      ],
      [
        {
          label: "Copy Column Headers (CSV)",
          onClick: () => navigator.clipboard?.writeText(result!.columns.join(",")),
        },
      ],
    ];
  }

  return (
    <div className="h-full overflow-auto">
      {/* Results toolbar */}
      <div className="sticky top-0 px-3 py-1.5 bg-gray-800 border-b border-gray-700/80 flex items-center gap-3 z-10">
        <span className="text-xs text-gray-400">
          {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
        </span>
        <button
          className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => {
            if (!result) return;
            const header = result.columns.join(",");
            const rows = result.rows.map((row) =>
              row.map((v) => {
                if (v === null) return "NULL";
                const s = String(v);
                return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
              }).join(",")
            );
            navigator.clipboard?.writeText([header, ...rows].join("\n"));
          }}
          title="Copy all as CSV"
        >
          Copy CSV
        </button>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-800 sticky top-8">
            <th className="w-10 px-2 py-1.5 text-right text-gray-600 font-normal border-b border-gray-700/80 select-none">#</th>
            {result.columns.map((col) => (
              <th
                key={col}
                className="px-3 py-1.5 text-left text-gray-300 font-semibold border-b border-gray-700/80 border-r border-gray-700/40 whitespace-nowrap"
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
              className={`${ri % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"} hover:bg-blue-900/10 cursor-default`}
              onContextMenu={(e) => {
                e.preventDefault();
                setRowMenu({ x: e.clientX, y: e.clientY, rowIdx: ri });
              }}
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

      {rowMenu && (
        <ContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          sections={buildRowMenuSections(rowMenu.rowIdx)}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  );
}

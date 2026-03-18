import { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore } from "../stores/useAppStore";
import { TableViewerTab, ColumnInfo } from "../types";
import { api } from "../lib/tauri";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { CellDetailModal } from "./CellDetailModal";
import { RowEditModal } from "./RowEditModal";

interface Props {
  tab: TableViewerTab;
}

interface CellMenu {
  x: number;
  y: number;
  displayRowIdx: number;
  colName: string;
  value: unknown;
}

/** MySQL → backtick, PostgreSQL → double-quote */
function q(ident: string, dbType: string) {
  return dbType === "postgres" ? `"${ident}"` : `\`${ident}\``;
}

/** Escape and quote a SQL value */
function sqlVal(val: string | null): string {
  if (val === null) return "NULL";
  return `'${val.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function DataGrid({ tab }: Props) {
  const { loadTableData, connections } = useAppStore();
  const conn = connections.find((c) => c.id === tab.connectionId);
  const dbType = conn?.db_type ?? "mysql";

  // Column metadata for PK detection
  const [colInfos, setColInfos] = useState<ColumnInfo[]>([]);
  useEffect(() => {
    api
      .getTableColumns(tab.connectionId, tab.database, tab.table)
      .then(setColInfos)
      .catch(() => setColInfos([]));
  }, [tab.connectionId, tab.database, tab.table]);

  const pkCol = colInfos.find((c) => c.is_primary_key)?.name;

  // ── Sorting ──────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleHeaderClick(col: string) {
    let newSortCol: string | null;
    let newSortDir: "asc" | "desc";
    if (sortCol === col) {
      if (sortDir === "asc") { newSortCol = col; newSortDir = "desc"; }
      else { newSortCol = null; newSortDir = "asc"; }
    } else {
      newSortCol = col; newSortDir = "asc";
    }
    setSortCol(newSortCol);
    setSortDir(newSortDir);
    loadTableData(tab.id, 1, newSortCol, newSortDir);
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // ── Computed display rows (filter only; sorting is server-side) ──────────
  const displayRows = useMemo(() => {
    const raw = tab.result?.rows ?? [];
    let rows = raw.map((data, origIndex) => ({ data, origIndex }));

    const active = Object.entries(filters).filter(([, v]) => v);
    if (active.length > 0 && tab.result) {
      rows = rows.filter(({ data }) =>
        active.every(([col, filter]) => {
          const idx = tab.result!.columns.indexOf(col);
          if (idx < 0) return true;
          return String(data[idx] ?? "").toLowerCase().includes(filter.toLowerCase());
        })
      );
    }

    return rows;
  }, [tab.result, filters]);

  // ── Inline cell editing ──────────────────────────────────────────────────
  const [editCell, setEditCell] = useState<{ displayRow: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (editCell) editRef.current?.focus();
  }, [editCell]);

  function startEdit(displayRow: number, col: string, currentValue: unknown) {
    if (!pkCol) {
      flash("No primary key — editing disabled", false);
      return;
    }
    setEditCell({ displayRow, col });
    setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
  }

  function flash(text: string, ok: boolean) {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg(null), ok ? 2000 : 5000);
  }

  async function commitEdit() {
    if (!editCell || !pkCol || !tab.result) { setEditCell(null); return; }
    const { displayRow, col } = editCell;
    const origRow = displayRows[displayRow];
    setEditCell(null);

    const pkIdx = tab.result.columns.indexOf(pkCol);
    const colIdx = tab.result.columns.indexOf(col);
    const pkVal = String(origRow.data[pkIdx]);
    const oldVal = origRow.data[colIdx];
    const newVal = editValue === "" ? null : editValue;

    if (String(oldVal ?? "") === (newVal ?? "")) return; // no change

    const sql = `UPDATE ${q(tab.table, dbType)} SET ${q(col, dbType)} = ${sqlVal(newVal)} WHERE ${q(pkCol, dbType)} = ${sqlVal(pkVal)}`;
    const res = await api.executeQuery(tab.connectionId, tab.database, sql);
    if (res.error) { flash(`Error: ${res.error}`, false); }
    else { flash("✓ Updated", true); loadTableData(tab.id, tab.page); }
  }

  async function saveRowEdit(updates: Record<string, string | null>, displayRowIdx: number) {
    if (!pkCol || !tab.result) throw new Error("No primary key");
    const origRow = displayRows[displayRowIdx];
    const pkIdx = tab.result.columns.indexOf(pkCol);
    const pkVal = String(origRow.data[pkIdx]);
    const setClauses = Object.entries(updates)
      .map(([col, val]) => `${q(col, dbType)} = ${sqlVal(val)}`)
      .join(", ");
    const sql = `UPDATE ${q(tab.table, dbType)} SET ${setClauses} WHERE ${q(pkCol, dbType)} = ${sqlVal(pkVal)}`;
    const res = await api.executeQuery(tab.connectionId, tab.database, sql);
    if (res.error) throw new Error(res.error);
    loadTableData(tab.id, tab.page);
  }

  // ── Cell context menu ────────────────────────────────────────────────────
  const [cellMenu, setCellMenu] = useState<CellMenu | null>(null);
  const [detailModal, setDetailModal] = useState<{ col: string; value: string | null } | null>(null);
  const [rowEditIdx, setRowEditIdx] = useState<number | null>(null);

  function handleCellCtx(e: React.MouseEvent, displayRowIdx: number, col: string, value: unknown) {
    e.preventDefault();
    e.stopPropagation();
    setCellMenu({ x: e.clientX, y: e.clientY, displayRowIdx, colName: col, value });
  }

  function buildCellMenuSections(menu: CellMenu): ContextMenuItem[][] {
    const strVal = menu.value === null || menu.value === undefined ? null : String(menu.value);
    return [
      [
        {
          label: "View Full Value",
          onClick: () => setDetailModal({ col: menu.colName, value: strVal }),
        },
        {
          label: "Edit Row…",
          onClick: () => setRowEditIdx(menu.displayRowIdx),
          disabled: !pkCol,
        },
        {
          label: "Edit Cell (inline)",
          onClick: () => startEdit(menu.displayRowIdx, menu.colName, menu.value),
          disabled: !pkCol,
        },
      ],
      [
        {
          label: "Copy Cell Value",
          onClick: () => navigator.clipboard?.writeText(strVal ?? ""),
        },
        {
          label: "Copy Row as JSON",
          onClick: () => {
            if (!tab.result) return;
            const data = displayRows[menu.displayRowIdx]?.data ?? [];
            const obj: Record<string, unknown> = {};
            tab.result.columns.forEach((c, i) => { obj[c] = data[i]; });
            navigator.clipboard?.writeText(JSON.stringify(obj, null, 2));
          },
        },
        {
          label: "Copy Row as INSERT",
          onClick: () => {
            if (!tab.result) return;
            const data = displayRows[menu.displayRowIdx]?.data ?? [];
            const cols = tab.result.columns.map((c) => q(c, dbType)).join(", ");
            const vals = data.map((v) => sqlVal(v === null || v === undefined ? null : String(v))).join(", ");
            navigator.clipboard?.writeText(
              `INSERT INTO ${q(tab.table, dbType)} (${cols}) VALUES (${vals});`
            );
          },
        },
      ],
    ];
  }

  const result = tab.result;
  const columns = result?.columns ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">
        <span className="text-xs text-gray-400">
          {tab.database}.<strong className="text-gray-200">{tab.table}</strong>
        </span>
        {result && (
          <span className="text-xs text-gray-600">
            ({displayRows.length}/{result.rows.length} rows
            {sortCol ? `, ↕ ${sortCol}` : ""}
            {Object.values(filters).some(Boolean) ? ", filtered" : ""})
          </span>
        )}

        <div className="flex-1" />

        {statusMsg && (
          <span className={`text-xs ${statusMsg.ok ? "text-green-400" : "text-red-400"}`}>
            {statusMsg.text}
          </span>
        )}

        <button
          onClick={() => { setShowFilters((v) => !v); setFilters({}); }}
          className={`px-2 py-1 text-xs border rounded transition-colors ${
            showFilters
              ? "border-blue-500 text-blue-400 bg-blue-500/10"
              : "border-gray-600 text-gray-300 hover:border-gray-400"
          }`}
          title="Toggle column filters"
        >
          ⊟ Filter
        </button>

        {sortCol && (
          <button
            onClick={() => { setSortCol(null); loadTableData(tab.id, 1, null, "asc"); }}
            className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-400 hover:border-gray-400"
          >
            ✕ Sort
          </button>
        )}

        <button
          onClick={() => loadTableData(tab.id, tab.page, sortCol, sortDir)}
          disabled={tab.isLoading}
          className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
        >
          ↺ Refresh
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => loadTableData(tab.id, tab.page - 1, sortCol, sortDir)}
            disabled={tab.isLoading || tab.page <= 1}
            className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >‹</button>
          <span className="text-xs text-gray-400 px-1">p.{tab.page}</span>
          <button
            onClick={() => loadTableData(tab.id, tab.page + 1, sortCol, sortDir)}
            disabled={tab.isLoading || (result?.rows.length ?? 0) < 100}
            className="px-2 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >›</button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {tab.isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <span className="animate-spin mr-2">⟳</span> Loading…
          </div>
        ) : !result ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No data loaded
          </div>
        ) : result.error ? (
          <div className="p-4">
            <div className="bg-red-900/30 border border-red-700 rounded p-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
              <pre className="text-xs text-red-300 whitespace-pre-wrap">{result.error}</pre>
            </div>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800">
                <th className="w-10 px-2 py-2 text-right text-gray-600 font-normal border-b border-gray-700 select-none">#</th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left border-b border-gray-700 border-r border-gray-700/40 select-none group/th"
                  >
                    <button
                      className="flex items-center gap-1 text-gray-300 font-semibold hover:text-white w-full"
                      onClick={() => handleHeaderClick(col)}
                      title="Click to sort"
                    >
                      <span className="truncate">{col}</span>
                      {sortCol === col ? (
                        <span className="text-blue-400 flex-shrink-0">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover/th:opacity-30 flex-shrink-0">↕</span>
                      )}
                    </button>
                    {showFilters && (
                      <input
                        value={filters[col] ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, [col]: e.target.value }))}
                        placeholder="filter…"
                        className="mt-1 w-full px-2 py-0.5 bg-gray-900 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayRows.map(({ data, origIndex }, ri) => (
                <tr
                  key={origIndex}
                  className={ri % 2 === 0 ? "bg-gray-900" : "bg-gray-800/40"}
                >
                  <td className="px-2 py-1 text-right text-gray-600 border-r border-gray-700/40 select-none">
                    {ri + 1}
                  </td>
                  {columns.map((col, ci) => {
                    const value = data[ci];
                    const isEditing = editCell?.displayRow === ri && editCell?.col === col;
                    return (
                      <td
                        key={col}
                        className="px-3 py-1 border-r border-gray-700/40 max-w-xs"
                        onDoubleClick={() => startEdit(ri, col, value)}
                        onContextMenu={(e) => handleCellCtx(e, ri, col, value)}
                      >
                        {isEditing ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditCell(null);
                            }}
                            className="w-full px-1 py-0.5 bg-blue-900/40 border border-blue-500 rounded text-white text-xs font-mono focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : value === null || value === undefined ? (
                          <span className="text-gray-600 italic">NULL</span>
                        ) : (
                          <span
                            className="text-gray-300 truncate block max-w-[280px]"
                            title={String(value)}
                          >
                            {String(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="text-center py-8 text-gray-600"
                  >
                    No rows match the current filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Context menu */}
      {cellMenu && (
        <ContextMenu
          x={cellMenu.x}
          y={cellMenu.y}
          sections={buildCellMenuSections(cellMenu)}
          onClose={() => setCellMenu(null)}
        />
      )}

      {/* Cell detail modal */}
      {detailModal && (
        <CellDetailModal
          column={detailModal.col}
          value={detailModal.value}
          onClose={() => setDetailModal(null)}
        />
      )}

      {/* Row edit modal */}
      {rowEditIdx !== null && result && (
        <RowEditModal
          rowData={displayRows[rowEditIdx]?.data ?? []}
          columns={columns}
          colInfos={colInfos}
          onSave={(updates) => saveRowEdit(updates, rowEditIdx)}
          onClose={() => setRowEditIdx(null)}
        />
      )}
    </div>
  );
}

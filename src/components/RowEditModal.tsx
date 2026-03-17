import { useState } from "react";
import { ColumnInfo } from "../types";

interface Props {
  rowData: unknown[];
  columns: string[];
  colInfos: ColumnInfo[];
  onSave: (updates: Record<string, string | null>) => Promise<void>;
  onClose: () => void;
}

export function RowEditModal({ rowData, columns, colInfos, onSave, onClose }: Props) {
  const initial: Record<string, string | null> = {};
  columns.forEach((col, i) => {
    const v = rowData[i];
    initial[col] = v === null || v === undefined ? null : String(v);
  });

  const [values, setValues] = useState<Record<string, string | null>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkCol = colInfos.find((c) => c.is_primary_key)?.name;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, string | null> = {};
      columns.forEach((col) => {
        if (values[col] !== initial[col]) updates[col] = values[col];
      });
      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }
      await onSave(updates);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[580px] max-h-[85vh] rounded-lg bg-gray-800 border border-gray-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Edit Row</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!pkCol && (
            <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-400">
              No primary key detected — changes may affect multiple rows.
            </div>
          )}

          {columns.map((col) => {
            const info = colInfos.find((c) => c.name === col);
            const isPk = info?.is_primary_key;
            const isNull = values[col] === null;

            return (
              <div key={col}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-300">{col}</span>
                  {isPk && <span className="text-yellow-400 text-xs" title="Primary Key">🔑</span>}
                  {info && (
                    <span className="text-xs text-gray-600">{info.data_type}</span>
                  )}
                  {!isPk && (
                    <button
                      onClick={() =>
                        setValues((v) => ({
                          ...v,
                          [col]: isNull ? "" : null,
                        }))
                      }
                      className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${
                        isNull
                          ? "border-orange-500 text-orange-400 bg-orange-900/20"
                          : "border-gray-600 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      NULL
                    </button>
                  )}
                </div>

                {isPk || isNull ? (
                  <div className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-xs font-mono text-gray-500">
                    {isNull ? "(NULL)" : (values[col] ?? "(NULL)")}
                  </div>
                ) : (
                  <textarea
                    value={values[col] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [col]: e.target.value }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mx-4 mb-3 px-3 py-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-700 rounded text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

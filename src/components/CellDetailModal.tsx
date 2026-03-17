interface Props {
  column: string;
  value: string | null;
  onClose: () => void;
}

export function CellDetailModal({ column, value, onClose }: Props) {
  const display = value === null ? "(NULL)" : value;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[80vh] rounded-lg bg-gray-800 border border-gray-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white font-mono">{column}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono break-all leading-relaxed">
            {display}
          </pre>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={() => navigator.clipboard?.writeText(display)}
            className="px-3 py-1.5 text-xs border border-gray-600 rounded text-gray-300 hover:border-gray-400"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-blue-700 rounded text-white hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

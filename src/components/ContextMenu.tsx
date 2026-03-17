import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  /** sections 内的每组之间自动渲染分隔线 */
  sections: ContextMenuItem[][];
  onClose: () => void;
}

export function ContextMenu({ x, y, sections, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // 防止超出视口右边 / 底部
  const left = Math.min(x, window.innerWidth - 192);
  const top = Math.min(y, window.innerHeight - 40 * sections.flat().length - 16);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, zIndex: 9999 }}
      className="bg-gray-800 border border-gray-600 rounded shadow-2xl min-w-[192px] py-1 text-xs"
      onContextMenu={(e) => e.preventDefault()}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="border-t border-gray-700 my-1" />}
          {section.map((item, ii) => (
            <button
              key={ii}
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onClick();
              }}
              className={`w-full text-left px-4 py-1.5 transition-colors
                ${item.danger
                  ? "text-red-400 hover:bg-red-900/30"
                  : "text-gray-300 hover:bg-gray-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";
import { useAppStore } from "../stores/useAppStore";
import { SqlEditorTab } from "../types";

interface Props {
  tab: SqlEditorTab;
}

const readOnlyCompartment = new Compartment();

export function SQLEditor({ tab }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const runQuery = useAppStore((s) => s.runQuery);
  const updateTabSql = useAppStore((s) => s.updateTabSql);

  useEffect(() => {
    if (!editorRef.current) return;

    const runCmd = () => {
      runQuery(tab.id);
      return true;
    };

    const state = EditorState.create({
      doc: tab.sql,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        sql(),
        oneDark,
        autocompletion(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          { key: "Ctrl-Enter", run: runCmd },
          { key: "Mod-Enter", run: runCmd },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            updateTabSql(tab.id, update.state.doc.toString());
          }
        }),
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only init once per tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

  // Sync readOnly when running
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(tab.isRunning)
      ),
    });
  }, [tab.isRunning]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-400">{tab.database}</span>
        <div className="flex-1" />
        <button
          onClick={() => runQuery(tab.id)}
          disabled={tab.isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded"
        >
          {tab.isRunning ? (
            <>
              <span className="animate-spin">⟳</span> Running…
            </>
          ) : (
            <>▶ Run (Ctrl+Enter)</>
          )}
        </button>
      </div>
      <div ref={editorRef} className="flex-1 overflow-hidden" />
    </div>
  );
}

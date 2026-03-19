import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
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

  // Create editor once per tab.id
  useEffect(() => {
    if (!editorRef.current) return;

    const runCmd = () => { runQuery(tab.id); return true; };

    const state = EditorState.create({
      doc: tab.sql,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        history(),
        sql(),
        oneDark,
        autocompletion(),
        search({ top: true }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

  // Sync external SQL changes (e.g., from Format SQL) into CodeMirror
  useEffect(() => {
    if (!viewRef.current) return;
    const currentDoc = viewRef.current.state.doc.toString();
    if (tab.sql !== currentDoc) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: tab.sql },
      });
    }
  }, [tab.sql]);

  // Sync readOnly state when query is running
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(tab.isRunning)
      ),
    });
  }, [tab.isRunning]);

  return (
    <div className="flex flex-col h-full">
      <div ref={editorRef} className="flex-1 overflow-hidden" />
    </div>
  );
}

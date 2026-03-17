# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Show Data** is an open-source, cross-platform database management tool (Navicat alternative) built with:
- **Desktop framework**: Tauri 2 (Rust backend)
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS
- **SQL editor**: CodeMirror 6 with SQL language support
- **State management**: Zustand
- **Database drivers**: sqlx 0.8 (MySQL + PostgreSQL, via AnyPool)
- **Release**: GitHub Actions + tauri-action

## Project Structure

```
show-data/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ConnectionDialog.tsx  # New/edit connection modal
│   │   ├── Sidebar.tsx           # Left tree: connections → databases → tables
│   │   ├── TabManager.tsx        # Multi-tab manager + tab bar
│   │   ├── SQLEditor.tsx         # CodeMirror SQL editor
│   │   ├── DataGrid.tsx          # Table data viewer with pagination
│   │   └── ResultsPanel.tsx      # Query results / error display
│   ├── stores/useAppStore.ts     # Zustand global state
│   ├── types/index.ts            # Shared TypeScript types
│   ├── lib/tauri.ts              # Tauri invoke wrappers
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Tauri builder + command registration
│   │   ├── storage.rs            # Connection config persistence (JSON)
│   │   ├── commands/
│   │   │   ├── connection.rs     # save/list/delete/test connection
│   │   │   └── query.rs          # connect/disconnect/get_databases/get_tables/execute_query
│   │   └── db/
│   │       ├── mod.rs            # ConnectionPool enum wrapper
│   │       ├── mysql.rs          # MySQL-specific queries
│   │       └── postgres.rs       # PostgreSQL-specific queries
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── .github/workflows/release.yml # CI/CD: builds Mac .dmg + Windows .msi on tag push
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── index.html
```

## Development Commands

```bash
# Install frontend dependencies
npm install

# Start development server (hot reload)
npm run tauri:dev

# Build for production
npm run tauri:build

# Frontend only (no Tauri)
npm run dev
```

## Releasing

Push a version tag to trigger GitHub Actions:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This builds:
- macOS: universal `.dmg` (Apple Silicon + Intel)
- Windows: `.msi` + `.exe`

Artifacts are uploaded as a draft GitHub Release.

## Key Architecture Notes

### Connection pool management
Pools are stored in `Tauri managed state` as `Mutex<HashMap<String, ConnectionPool>>`. Call `connect(id)` to create a pool, then all query commands look it up by id.

### Connection config storage
Saved to `%LOCALAPPDATA%/show-data/connections.json` (Windows) or `~/.local/share/show-data/connections.json` (Mac/Linux) via the `dirs` crate.

### sqlx AnyPool
`sqlx::any::install_default_drivers()` must be called before connecting. The AnyPool abstraction allows the same query code to run on both MySQL and PostgreSQL.

### Tab system
Two tab types: `sql-editor` (CodeMirror + results panel) and `table-viewer` (DataGrid with pagination). State lives in Zustand; CodeMirror instances are managed via React refs in `SQLEditor.tsx`.

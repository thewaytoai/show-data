# Show Data

开源的跨平台数据库管理工具，支持 MySQL 和 PostgreSQL，可替代 Navicat。

基于 Tauri 2 + React + TypeScript 构建，提供原生桌面体验，安装包体积小。

## 功能特性

- 多连接管理 — 保存、编辑、测试 MySQL / PostgreSQL 连接
- 左侧树形导航 — 连接 → 数据库 → 表，一键展开
- SQL 编辑器 — CodeMirror 6，语法高亮、自动补全，`Ctrl+Enter` 执行
- 多标签页 — 同时打开多个查询和表视图
- 表数据浏览 — 分页查看，支持翻页刷新
- 跨平台发布 — macOS (universal) + Windows，通过 GitHub Actions 自动打包

## 截图

> _开发中，截图待补充_

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 (Rust) |
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS |
| SQL 编辑器 | CodeMirror 6 + @codemirror/lang-sql |
| 状态管理 | Zustand |
| 数据库驱动 | sqlx 0.8 (MySQL + PostgreSQL) |
| 打包发布 | tauri-action + GitHub Actions |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) stable

### 安装 Rust（首次）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 安装依赖

```bash
npm install --legacy-peer-deps
```

### 启动开发模式

```bash
npm run tauri:dev
```

### 生产构建

```bash
npm run tauri:build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 发布新版本

推送版本 tag 即可触发 GitHub Actions 自动构建并创建 Draft Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

构建产物：
- macOS：`.dmg`（Apple Silicon + Intel 通用二进制）
- Windows：`.msi` + `.exe`

## 项目结构

```
show-data/
├── src/                        # React 前端
│   ├── components/             # UI 组件
│   ├── stores/useAppStore.ts   # Zustand 全局状态
│   ├── types/index.ts          # TypeScript 类型定义
│   └── lib/tauri.ts            # Tauri invoke 封装
├── src-tauri/
│   ├── src/
│   │   ├── commands/           # Tauri 命令（连接管理、SQL 执行）
│   │   ├── db/                 # MySQL / PostgreSQL 驱动实现
│   │   └── storage.rs          # 连接配置持久化
│   └── tauri.conf.json
└── .github/workflows/
    └── release.yml             # CI/CD 发布流程
```

## License

MIT

# Ritedown

[![CI](https://github.com/duichuai/ritedown/actions/workflows/ci.yml/badge.svg)](https://github.com/duichuai/ritedown/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open-source Markdown editor that supports the **latest Markdown standards** — a free alternative to Typora. 开源的 Markdown 读写编辑器，支持最新 Markdown 标准。

> rite (write) + down (markdown) — write it down.

- Homepage / 官网: <https://duichuai.com>
- Repository: <https://github.com/duichuai/ritedown>

## Features / 功能

**Editing / 编辑**

- Source editing with a live split preview (CodeMirror 6 + Vue 3)
- WYSIWYG rendering: bold/italic/strikethrough/inline-code markers hide when the cursor leaves them; fenced code blocks render Shiki-highlighted, GFM tables render as real tables, task list checkboxes are clickable — cursor in, source back
- Multi-tab documents with per-tab dirty state, unsaved-close confirmation and cursor restore
- Folder workspace: file tree (lazy loading), documents remembered across sessions, restore with one click
- Workspace-wide search: literal or regex, case toggle, streamed results, click a hit to jump to the line
- Drag & drop `.md` files to open; paste or drop images to embed them next to the document
- Bidirectional scroll sync, document outline, word/character/line counts
- Light / dark / follow-system theme (Shiki & Mermaid follow along), 中英双语界面 (zh / en)

**Rendering / 渲染** — via the framework-agnostic [@ritedown/core](packages/core) pipeline

- CommonMark 0.31.2 + GFM (tables, task lists, strikethrough, autolinks)
- Math (KaTeX), Mermaid diagrams, Shiki syntax highlighting
- Front matter rendered as a table, emoji shortcodes (`:smile:` → 😄)

**Export / 导出**

- Self-contained single-file HTML export (KaTeX fonts inlined — works offline)

## Browser support / 浏览器支持

Chrome / Edge / Opera (Chromium). Opening, saving, the folder workspace and
image embedding rely on the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API);
Firefox / Safari fall back to read-only opens and Save-As pickers.
A Tauri 2 desktop shell is planned after v1.0.

## Getting started / 快速开始

```bash
corepack pnpm install
corepack pnpm dev        # start the editor (apps/editor)
corepack pnpm demo       # render a sample document through the core pipeline
corepack pnpm test
corepack pnpm build
```

## Structure / 结构

pnpm monorepo:

```
packages/core        # framework-agnostic kernel: parse + render + editor core (@ritedown/core)
packages/transformer # syntax extensions: gfm / math / mermaid / ...
apps/editor          # web app (Vue 3 + Vite)
apps/desktop         # Tauri 2 desktop shell (planned)
docs/                # docs (zh / en)
```

## Roadmap / 路线图

- ~~M1: source editing + live split preview~~ ✅
- ~~M2: Math / Mermaid / Shiki, WYSIWYG inline rendering~~ ✅
- ~~M3: workspace (file tree, tabs, global search), WYSIWYG block rendering~~ ✅ (v1.0)
- M4: Tauri 2 desktop shell, docx export, plugin system, mobile

See [docs/方案评估.md](docs/方案评估.md) for the full proposal and [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT © duichuai

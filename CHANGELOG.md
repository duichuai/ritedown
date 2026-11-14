# Changelog

All notable changes to Ritedown are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0-beta.0] - 2026-11-14

Plugin system and mobile web.

### Plugin system

- `RitedownPlugin` interface and `builtinPlugins` registry in
  `@ritedown/core`; editor-side plugins (gemoji, math, front matter,
  line markers…) join the same registry, and the preview pipeline is
  assembled from enabled ids — canonical order preserved
- Settings panel (⚙ in the titlebar): toggle every registered plugin;
  disabled ids persist as a diff list, so newly shipped plugins stay
  enabled for existing users
- GFM Alerts (`> [!NOTE]` …) is now actually wired into the preview
  pipeline — previously the default document and styles referenced it
  but the extension was never enabled

### Mobile web (PWA)

- PWA baseline: web manifest, installable icons, hand-rolled service
  worker (precached navigation shell + stale-while-revalidate runtime
  cache for hashed assets)
- Responsive layout at ≤720px: single-column editor/preview toggle,
  sidebar becomes a fixed drawer, titlebar buttons collapse into an
  overflow menu
- Opening files falls back to a hidden `<input type=file>` in browsers
  without the File System Access API (iOS Safari, Android Chrome);
  saving/exporting already had download fallbacks

## [2.0.0-beta.1] - 2026-11-14

First beta of the desktop era: the same editor now ships as a native
Tauri 2 app (Windows / macOS / Linux) alongside the browser build, plus
Word export.

### Desktop (Tauri 2)

- Native desktop shell (`apps/desktop`): ~10 MB installers, system
  open/save dialogs with automatic filesystem scope — no permission
  prompts, folder workspaces fully supported
- FileProvider abstraction: one editor codebase talks to the File System
  Access API on the web and the Tauri fs/dialog plugins on desktop
- Window title follows the active tab with a dirty marker
  (`● name — Ritedown`); closing with unsaved changes asks for confirmation
- CI workflow builds three-platform bundles on `v*` tags

### Export

- Word (.docx) export via the `docx` pipeline: headings, inline marks,
  links, nested / task / ordered lists, code blocks, blockquotes, tables,
  thematic breaks; emoji shortcodes resolve; math stays as literal LaTeX,
  images embed when fetchable (placeholder text otherwise)

### Fixed

- `parse()` in `@ritedown/core` now runs transformer-phase plugins
  (e.g. emoji shortcodes) while staying in mdast

## [1.0.0] - 2026-11-13

First public release: a browser-based Markdown editor for Chromium
(Chrome / Edge / Opera) built on CodeMirror 6, Vue 3 and the
framework-agnostic `@ritedown/core` pipeline.

### Editing

- Source editor (CodeMirror 6) with live split preview and bidirectional scroll sync
- WYSIWYG inline rendering: bold / italic / strikethrough / inline-code
  markers hide while the cursor is outside them (toggleable, remembered)
- WYSIWYG block rendering: fenced code blocks render Shiki-highlighted
  (dual theme), GFM tables render as real tables, list markers render as
  bullets / numbers, task checkboxes toggle the `[ ]`/`[x]` source in place
- Multi-tab documents: per-tab dirty state, unsaved-close confirmation,
  cursor position restored on tab switch
- Folder workspace: file tree with lazy directory loading, workspace handle
  persisted in IndexedDB and restorable across sessions
- Workspace global search: literal / regex, case toggle, streamed results,
  click a hit to open the document and jump to the matching line
- Drag & drop to open `.md` files; paste or drop images to copy them into
  an `assets/` folder next to the document and insert a markdown reference
- Document outline (TOC), word / character / line counts
- Light / dark / follow-system theme, persisted preference
- Chinese / English interface, one-click toggle

### Rendering (`@ritedown/core`)

- CommonMark 0.31.2 + GFM tables / task lists / strikethrough / autolinks
- Math via KaTeX, diagrams via Mermaid, syntax highlighting via Shiki
- Front matter rendered as a table
- Emoji shortcodes via remark-gemoji
- `@ritedown/gfm-alerts` extension (`> [!NOTE]` etc.)

### Export

- Self-contained single-file HTML export (KaTeX woff2 fonts inlined,
  Mermaid / Shiki assets embedded — opens offline)

### Platform

- File System Access API for open / save / folder workspace (Chromium);
  graceful fallback for Firefox / Safari (Save-As, embedded image data URIs)

## [0.1.0] - 2026-11-13

Project bootstrap: monorepo layout, `@ritedown/core` render pipeline and
the first editor prototype.

[2.0.0-beta.1]: https://github.com/duichuai/ritedown/releases/tag/v2.0.0-beta.1
[1.0.0]: https://github.com/duichuai/ritedown/releases/tag/v1.0.0
[0.1.0]: https://github.com/duichuai/ritedown/releases/tag/v0.1.0

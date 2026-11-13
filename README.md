# Ritedown

[![CI](https://github.com/duichuai/ritedown/actions/workflows/ci.yml/badge.svg)](https://github.com/duichuai/ritedown/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open-source Markdown editor that supports the **latest Markdown standards** — a free alternative to Typora. 开源的 Markdown 读写编辑器，支持最新 Markdown 标准。

> rite (write) + down (markdown) — write it down.

- Homepage / 官网: <https://duichuai.com>
- Repository: <https://github.com/duichuai/ritedown>

## Status / 状态

Project bootstrap. See [docs/方案评估.md](docs/方案评估.md) for the full proposal (architecture, roadmap, milestones).

- **M1 (current)**: source editing + live split preview, CommonMark 0.31.2 + GFM rendering
- **M2**: Math / Mermaid / Shiki highlight, WYSIWYG inline rendering
- **M3**: workspace (folder tree, tabs, global search)
- **M4**: plugin system, mobile

## Structure / 结构

pnpm monorepo:

```
packages/core        # framework-agnostic kernel: parse + render + editor core (@ritedown/core)
packages/transformer # syntax extensions: gfm / math / mermaid / ...
apps/editor          # web app (Vue 3 + Vite)
apps/desktop         # Tauri 2 desktop shell
docs/                # docs (zh / en)
```

## Development / 开发

```bash
corepack pnpm install
corepack pnpm demo    # render a sample document through the core pipeline
corepack pnpm test
corepack pnpm build
```

## License

MIT © duichuai

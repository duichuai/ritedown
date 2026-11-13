# Ritedown

An open-source Markdown editor that supports the **latest Markdown standards** — a free alternative to Typora. 开源的 Markdown 读写编辑器，支持最新 Markdown 标准。

> rite (write) + down (markdown) — write it down.

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

> 本机若把仓库放在 CIFS/SMB 挂载盘上，Node 的异步文件读取会随机 `EINVAL`（tsc/Vite/vitest 启动即崩）。
> 解决：把仓库放到本地 ext4 并 bind mount 回原路径，见 [scripts/dev-mount.sh](scripts/dev-mount.sh)。

## License

MIT

import type { EditorView } from 'codemirror'

/**
 * Editor <-> preview scroll sync based on source line markers stamped by
 * remarkLineMarkers (`data-md-line` attributes in the rendered preview).
 */

interface LineEntry {
  line: number
  el: HTMLElement
}

export function collectLineMap(root: ParentNode): LineEntry[] {
  const entries: LineEntry[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-md-line]')) {
    const line = Number(el.dataset.mdLine)
    if (Number.isFinite(line) && line > 0) entries.push({ line, el })
  }
  return entries.sort((a, b) => a.line - b.line)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** Scroll the preview so the block matching the editor's top line aligns. */
export function syncEditorToPreview(view: EditorView, host: HTMLElement): void {
  const map = collectLineMap(host)
  if (!map.length) return

  const topPos = view.posAtCoords({
    x: 0,
    y: view.scrollDOM.getBoundingClientRect().top + 2,
  })
  if (topPos == null) return

  const block = view.lineBlockAt(topPos)
  const fraction = block.height
    ? clamp((view.scrollDOM.scrollTop - block.top) / block.height, 0, 1)
    : 0
  const line = view.state.doc.lineAt(block.from).number
  const entry = [...map].reverse().find((m) => m.line <= line) ?? map[0]

  const hostRect = host.getBoundingClientRect()
  const rect = entry.el.getBoundingClientRect()
  const elTop = rect.top - hostRect.top + host.scrollTop
  host.scrollTop = elTop + fraction * rect.height
}

/** Scroll the editor so the line matching the preview's top block aligns. */
export function syncPreviewToEditor(view: EditorView, host: HTMLElement): void {
  const map = collectLineMap(host)
  if (!map.length) return

  const hostRect = host.getBoundingClientRect()
  let entry = map[0]
  for (const m of map) {
    if (m.el.getBoundingClientRect().top < hostRect.top + 2) entry = m
    else break
  }

  const rect = entry.el.getBoundingClientRect()
  const fraction = rect.height
    ? clamp((hostRect.top - rect.top) / rect.height, 0, 1)
    : 0
  const lineNo = clamp(entry.line, 1, view.state.doc.lines)
  const block = view.lineBlockAt(view.state.doc.line(lineNo).from)
  view.scrollDOM.scrollTop = block.top + fraction * block.height
}

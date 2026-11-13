/**
 * WYSIWYG phase 2: block-level hybrid rendering. While the cursor is outside
 * a block, fenced code blocks render highlighted (Shiki), GFM tables render
 * as real <table>s, list markers render as bullets/numbers and task markers
 * as checkboxes. Moving the cursor into the block reveals the source. All
 * widget interactions dispatch back into the document — decoration only,
 * except checkbox toggles which rewrite the [ ]/[x] marker.
 */

import { syntaxTree } from '@codemirror/language'
import {
  RangeSet,
  StateField,
  type EditorState,
  type Extension,
  type Range,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { highlightCodeToHtml } from './highlight'

/**
 * Widget interactions dispatch through the editor view found from the widget
 * DOM (block decorations must live in a StateField, where no view exists).
 */
function withView(el: HTMLElement, run: (view: EditorView) => void): void {
  const view = EditorView.findFromDOM(el)
  if (view) run(view)
}

/** dispatch a cursor move that lands *inside* the block (revealing source) */
function revealAt(el: HTMLElement, pos: number): void {
  withView(el, (view) => {
    view.dispatch({ selection: { anchor: pos } })
    view.focus()
  })
}

/** rewrite a doc range in place (task checkbox toggle) */
function replaceRange(el: HTMLElement, from: number, to: number, text: string): void {
  withView(el, (view) => view.dispatch({ changes: { from, to, insert: text } }))
}

// --- widgets ---------------------------------------------------------------

export class CodeBlockWidget extends WidgetType {
  constructor(
    private revealPos: number,
    private code: string,
    private lang: string,
  ) {
    super()
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      other.code === this.code && other.lang === this.lang
    )
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-codeblock'
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = this.code
    pre.appendChild(code)
    wrap.appendChild(pre)
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      revealAt(wrap, this.revealPos)
    })
    // upgrade to Shiki once resolved (unknown langs keep the plain pre)
    void highlightCodeToHtml(this.code, this.lang).then((html) => {
      if (!html || !wrap.isConnected) return
      const tmpl = document.createElement('template')
      tmpl.innerHTML = html
      const rendered = tmpl.content.firstElementChild
      if (rendered) {
        rendered.classList.add('cm-md-codeblock-shiki')
        wrap.replaceChildren(rendered)
      }
    })
    return wrap
  }

  ignoreEvent(): boolean {
    return true // the widget dispatches cursor moves itself
  }
}

export class TableWidget extends WidgetType {
  constructor(
    private revealPos: number,
    private cells: string[][],
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return JSON.stringify(other.cells) === JSON.stringify(this.cells)
  }

  toDOM(): HTMLElement {
    const table = document.createElement('table')
    table.className = 'cm-md-table'
    const [header, ...rows] = this.cells
    const thead = table.createTHead()
    const headRow = thead.insertRow()
    for (const text of header) {
      headRow.insertCell().textContent = text
    }
    const tbody = table.createTBody()
    for (const row of rows) {
      const tr = tbody.insertRow()
      for (const text of row) {
        tr.insertCell().textContent = text
      }
    }
    table.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      revealAt(table, this.revealPos)
    })
    return table
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class ListMarkerWidget extends WidgetType {
  constructor(
    private revealPos: number,
    private label: string,
  ) {
    super()
  }

  eq(other: ListMarkerWidget): boolean {
    return other.label === this.label
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-md-listmark'
    span.textContent = this.label
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      revealAt(span, this.revealPos)
    })
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class TaskCheckboxWidget extends WidgetType {
  constructor(
    private from: number,
    private to: number,
    private checked: boolean,
  ) {
    super()
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from
  }

  toDOM(): HTMLElement {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'cm-md-taskbox'
    box.checked = this.checked
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // toggling rewrites the [ ]/[x] source marker in place
      replaceRange(box, this.from, this.to, this.checked ? '[ ]' : '[x]')
    })
    return box
  }

  ignoreEvent(): boolean {
    return true
  }
}

// --- tree helpers -----------------------------------------------------------

/** 1-based ordinal of a ListItem within its parent list */
function ordinalOf(item: SyntaxNode): number {
  let count = 0
  for (let prev = item.prevSibling; prev; prev = prev.prevSibling) count++
  return count + 1
}

/** cell text of a table: header row first, then body rows */
function tableCells(table: SyntaxNode, state: EditorState): string[][] {
  const rows: string[][] = []
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name !== 'TableHeader' && child.name !== 'TableRow') continue
    const cells: string[] = []
    for (let cell = child.firstChild; cell; cell = cell.nextSibling) {
      if (cell.name === 'TableCell') {
        cells.push(state.sliceDoc(cell.from, cell.to).trim())
      }
    }
    rows.push(cells)
  }
  return rows
}

// --- decoration builder (pure, unit-testable) --------------------------------

/** Build block decorations: replace every block the selection doesn't touch
 * with its rendered widget. */
export function blockFormatDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const overlaps = (from: number, to: number): boolean =>
    state.selection.ranges.some((r) => r.to > from && r.from < to)

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      // +1 puts the revealed cursor *inside* the block so it stays revealed
      const revealPos = node.from + 1
      switch (node.name) {
        case 'FencedCode': {
          if (overlaps(node.from, node.to)) return false
          const info = node.node.getChild('CodeInfo')
          const text = node.node.getChild('CodeText')
          const lang = info ? state.sliceDoc(info.from, info.to) : ''
          const code = text ? state.sliceDoc(text.from, text.to) : ''
          ranges.push(
            Decoration.replace({
              widget: new CodeBlockWidget(revealPos, code, lang),
              block: true,
            }).range(node.from, node.to),
          )
          return false
        }
        case 'Table': {
          if (overlaps(node.from, node.to)) return false
          ranges.push(
            Decoration.replace({
              widget: new TableWidget(revealPos, tableCells(node.node, state)),
              block: true,
            }).range(node.from, node.to),
          )
          return false
        }
        case 'ListMark': {
          const item = node.node.parent
          if (!item || item.name !== 'ListItem') return false
          if (overlaps(item.from, item.to)) return false
          const label =
            item.parent?.name === 'OrderedList' ? `${ordinalOf(item)}.` : '•'
          ranges.push(
            Decoration.replace({
              widget: new ListMarkerWidget(revealPos, label),
            }).range(node.from, node.to),
          )
          return false
        }
        case 'TaskMarker': {
          const task = node.node.parent
          if (!task || task.name !== 'Task') return false
          if (overlaps(task.from, task.to)) return false
          const checked = /^\[x\]/i.test(state.sliceDoc(node.from, node.to))
          ranges.push(
            Decoration.replace({
              widget: new TaskCheckboxWidget(node.from, node.to, checked),
            }).range(node.from, node.to),
          )
          return false
        }
        default:
          return undefined // descend into unknown nodes
      }
    },
  })
  return RangeSet.of(ranges, true)
}

// --- state field ----------------------------------------------------------------
// NOTE: block decorations must be provided via a StateField — CodeMirror
// rejects them from ViewPlugins ("Block decorations may not be specified
// via plugins"). Rebuilt on doc/selection changes.

const blockDecorationsField = StateField.define<DecorationSet>({
  create: blockFormatDecorations,
  update(deco, tr) {
    if (tr.docChanged || tr.selection) {
      return blockFormatDecorations(tr.state)
    }
    return deco
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    // hidden ranges are atomic: the cursor cannot land inside them
    EditorView.atomicRanges.of(
      (view) => view.state.field(field, false) ?? Decoration.none,
    ),
  ],
})

/** block-level WYSIWYG extensions: rendered blocks + styling */
export function blockWysiwygExtension(): Extension {
  return [
    blockDecorationsField,
    EditorView.baseTheme({
      '.cm-md-codeblock': {
        margin: '4px 0',
        overflowX: 'auto',
        borderRadius: '6px',
        border: '1px solid rgba(127, 127, 127, 0.25)',
        '& pre, & pre.cm-md-codeblock-shiki': {
          margin: '0',
          padding: '8px 10px',
          background: 'rgba(127, 127, 127, 0.08) !important',
          fontFamily: 'var(--cm-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontSize: '0.9em',
        },
      },
      '.cm-md-table': {
        margin: '4px 0',
        borderCollapse: 'collapse',
        '& th, & td': {
          border: '1px solid rgba(127, 127, 127, 0.35)',
          padding: '3px 10px',
        },
        '& th': { fontWeight: 'bold', background: 'rgba(127, 127, 127, 0.1)' },
      },
      '.cm-md-listmark': {
        color: 'var(--cm-accent, #4a90d9)',
        fontWeight: 'bold',
        cursor: 'default',
      },
      '.cm-md-taskbox': { margin: '0 4px 0 0', cursor: 'pointer' },
    }),
  ]
}

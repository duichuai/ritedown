/**
 * Markdown authoring commands shared by the editor keymap and the formatting
 * toolbar. Every command takes the current `EditorState` and returns a
 * `TransactionSpec`, so the behaviour is plain data and unit-testable without
 * a live editor.
 */

import {
  ChangeSet,
  EditorSelection,
  type EditorState,
  type TransactionSpec,
} from '@codemirror/state'

/* ---------- shared helpers ---------- */

const HEADING = /^(#{1,6})[ \t]+/
const QUOTE = /^>[ \t]?/
const TASK = /^[-*+][ \t]+\[[ xX]\][ \t]+/
const ORDERED = /^\d{1,9}[.)][ \t]+/
const BULLET = /^[-*+][ \t]+/

/** lines touched by a selection; a selection ending at a line start does not
 * include that line (mirrors how editors toggle line prefixes) */
function selectedLines(state: EditorState, from: number, to: number) {
  const first = state.doc.lineAt(from)
  let last = state.doc.lineAt(to)
  if (last.number > first.number && to === last.from) {
    last = state.doc.line(last.number - 1)
  }
  const lines = []
  for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n))
  return lines
}

/** re-map a selection through the changes of its own range */
function mappedRange(changes: ChangeSet, from: number, to: number) {
  return EditorSelection.range(changes.mapPos(from, 1), changes.mapPos(to, 1))
}

/* ---------- inline wrappers ---------- */

/**
 * Wrap each selection with `open`/`close`, or unwrap it when the markers are
 * already adjacent. An empty selection inserts the pair and puts the caret
 * between the markers, so pressing the shortcut twice restores the original
 * text.
 */
export function toggleWrap(
  state: EditorState,
  open: string,
  close: string = open,
): TransactionSpec {
  return state.changeByRange((range) => {
    const beforeStart = Math.max(0, range.from - open.length)
    const afterEnd = Math.min(state.doc.length, range.to + close.length)
    const before = state.sliceDoc(beforeStart, range.from)
    const after = state.sliceDoc(range.to, afterEnd)

    if (before === open && after === close) {
      return {
        changes: [
          { from: beforeStart, to: range.from },
          { from: range.to, to: afterEnd },
        ],
        range: EditorSelection.range(beforeStart, range.to - open.length),
      }
    }

    return {
      changes: [
        { from: range.from, insert: open },
        { from: range.to, insert: close },
      ],
      range: range.empty
        ? EditorSelection.cursor(range.from + open.length)
        : EditorSelection.range(range.from + open.length, range.to + open.length),
    }
  })
}

/** `[text](url)`; with a selection the text becomes the link label */
export function insertLink(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to)
    if (text) {
      const insert = `[${text}]()`
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + text.length + 3),
      }
    }
    return {
      changes: { from: range.from, insert: '[]()' },
      range: EditorSelection.cursor(range.from + 1),
    }
  })
}

/** `![alt](path)`; the caret lands in the path slot */
export function insertImage(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const alt = state.sliceDoc(range.from, range.to)
    const insert = `![${alt}]()`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + alt.length + 4),
    }
  })
}

/* ---------- line prefixes ---------- */

/** toggle an ATX heading on every selected line; level 0 strips it */
export function toggleHeading(state: EditorState, level: number): TransactionSpec {
  const target = level > 0 ? `${'#'.repeat(level)} ` : ''
  return state.changeByRange((range) => {
    const lines = selectedLines(state, range.from, range.to)
    const allSet = lines.every((line) => {
      const match = HEADING.exec(line.text)
      return target ? line.text.startsWith(target) : !match
    })
    const changes = lines.map((line) => {
      const match = HEADING.exec(line.text)
      const prefix = match ? match[0].length : 0
      return {
        from: line.from,
        to: line.from + prefix,
        insert: allSet ? '' : target,
      }
    })
    const changeSet = ChangeSet.of(changes, state.doc.length)
    return {
      changes: changeSet,
      range: mappedRange(changeSet, range.from, range.to),
    }
  })
}

export type ListKind = 'bullet' | 'ordered' | 'task'

function listKindOf(text: string): ListKind | null {
  if (TASK.test(text)) return 'task'
  if (ORDERED.test(text)) return 'ordered'
  if (BULLET.test(text)) return 'bullet'
  return null
}

function listPrefixLength(text: string): number {
  const match = TASK.exec(text) ?? ORDERED.exec(text) ?? BULLET.exec(text)
  return match ? match[0].length : 0
}

/** toggle bullet / ordered / task list markers on every selected line */
export function toggleList(state: EditorState, kind: ListKind): TransactionSpec {
  return state.changeByRange((range) => {
    const lines = selectedLines(state, range.from, range.to)
    const allSet = lines.every((line) => listKindOf(line.text) === kind)
    const changes = lines.map((line, index) => {
      const prefix = listKindOf(line.text) ? listPrefixLength(line.text) : 0
      let insert = ''
      if (!allSet) {
        insert =
          kind === 'ordered' ? `${index + 1}. ` : kind === 'task' ? '- [ ] ' : '- '
      }
      return { from: line.from, to: line.from + prefix, insert }
    })
    const changeSet = ChangeSet.of(changes, state.doc.length)
    return {
      changes: changeSet,
      range: mappedRange(changeSet, range.from, range.to),
    }
  })
}

/** toggle `> ` blockquotes on every selected line */
export function toggleQuote(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const lines = selectedLines(state, range.from, range.to)
    const allSet = lines.every((line) => QUOTE.test(line.text))
    const changes = lines.map((line) => {
      const match = QUOTE.exec(line.text)
      return {
        from: line.from,
        to: line.from + (match ? match[0].length : 0),
        insert: allSet ? '' : '> ',
      }
    })
    const changeSet = ChangeSet.of(changes, state.doc.length)
    return {
      changes: changeSet,
      range: mappedRange(changeSet, range.from, range.to),
    }
  })
}

/* ---------- block insertion ---------- */

/** insert a block, padded with blank lines so it never glues onto neighbours */
export function insertBlock(
  state: EditorState,
  block: string,
  cursorOffset = block.length,
): TransactionSpec {
  return state.changeByRange((range) => {
    const before = state.sliceDoc(0, range.from)
    const after = state.sliceDoc(range.to)
    const lead = !before
      ? ''
      : before.endsWith('\n\n')
        ? ''
        : before.endsWith('\n')
          ? '\n'
          : '\n\n'
    const trail = !after
      ? ''
      : after.startsWith('\n\n')
        ? ''
        : after.startsWith('\n')
          ? '\n'
          : '\n\n'
    return {
      changes: { from: range.from, to: range.to, insert: lead + block + trail },
      range: EditorSelection.cursor(range.from + lead.length + cursorOffset),
    }
  })
}

export function insertCodeBlock(state: EditorState, language = ''): TransactionSpec {
  const block = '```' + language + '\n\n```'
  return insertBlock(state, block, 4 + language.length)
}

export function insertTable(state: EditorState, columns = 3): TransactionSpec {
  const cell = (i: number) => `列 ${i + 1}`
  const header = `| ${Array.from({ length: columns }, (_, i) => cell(i)).join(' | ')} |`
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const emptyRow = `| ${Array.from({ length: columns }, () => '   ').join(' | ')} |`
  return insertBlock(state, [header, divider, emptyRow, emptyRow].join('\n'), 2)
}

/** inline math around a selection, otherwise a display-math block */
export function insertFormula(state: EditorState): TransactionSpec {
  if (state.selection.ranges.some((range) => !range.empty)) {
    return toggleWrap(state, '$')
  }
  return insertBlock(state, '$$\n\n$$', 3)
}

export function insertDivider(state: EditorState): TransactionSpec {
  return insertBlock(state, '---', 3)
}

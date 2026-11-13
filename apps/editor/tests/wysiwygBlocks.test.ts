import { describe, expect, it } from 'vitest'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { markdownLanguage } from '@codemirror/lang-markdown'
import { Decoration } from '@codemirror/view'
import { blockFormatDecorations } from '../src/lib/wysiwygBlocks'
import {
  CodeBlockWidget,
  TableWidget,
  ListMarkerWidget,
  TaskCheckboxWidget,
} from '../src/lib/wysiwygBlocks'

function stateOf(doc: string, cursor?: number): EditorState {
  const state = EditorState.create({
    doc,
    extensions: [markdownLanguage],
    selection: cursor === undefined ? undefined : { anchor: cursor },
  })
  ensureSyntaxTree(state, doc.length, 5000)
  return state
}

/** collect [from, to, widget] triples of widget replace-decorations */
function blockWidgets(state: EditorState): Array<{
  from: number
  to: number
  widget: unknown
}> {
  const out: Array<{ from: number; to: number; widget: unknown }> = []
  const cursor = blockFormatDecorations(state).iter({ includeDuplicates: true })
  while (cursor.value) {
    const spec = (cursor.value as Decoration).spec as { widget?: unknown }
    if (spec?.widget) {
      out.push({ from: cursor.from, to: cursor.to, widget: spec.widget })
    }
    cursor.next()
  }
  return out
}

// NOTE: lezer's table/list blocks greedily absorb following non-blank lines,
// so test documents keep a blank line after every block.

describe('blockFormatDecorations — fenced code', () => {
  const doc = '```js\nconst a = 1;\n```\n\ntext'

  it('replaces the whole block with a CodeBlockWidget when cursor is outside', () => {
    const state = stateOf(doc, doc.indexOf('text') + 1)
    const blocks = blockWidgets(state)
    expect(blocks.length).toBe(1)
    const widget = blocks[0].widget as CodeBlockWidget
    expect(widget).toBeInstanceOf(CodeBlockWidget)
    expect(blocks[0].from).toBe(0)
    expect(blocks[0].to).toBe(doc.indexOf('\n\ntext'))
    // widget carries the extracted code + language
    expect((widget as unknown as { code: string }).code).toBe('const a = 1;')
    expect((widget as unknown as { lang: string }).lang).toBe('js')
  })

  it('reveals the source when the cursor is inside the block', () => {
    const state = stateOf(doc, doc.indexOf('const') + 1)
    expect(blockWidgets(state)).toEqual([])
  })
})

describe('blockFormatDecorations — tables', () => {
  const doc = '| a | b |\n|---|---|\n| 1 | 2 |\n\nafter'

  it('renders a TableWidget with header + body cells', () => {
    const state = stateOf(doc, doc.indexOf('after') + 1)
    const blocks = blockWidgets(state)
    expect(blocks.length).toBe(1)
    const widget = blocks[0].widget as TableWidget
    expect(widget).toBeInstanceOf(TableWidget)
    expect((widget as unknown as { cells: string[][] }).cells).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('reveals the source when the cursor is inside the table', () => {
    const state = stateOf(doc, doc.indexOf('1') + 1)
    expect(blockWidgets(state)).toEqual([])
  })
})

describe('blockFormatDecorations — lists', () => {
  it('hides bullet markers with • widgets, ordered with numbers', () => {
    const doc = '- one\n- two\n\n1. first\n2. second\n\ndone'
    const state = stateOf(doc, doc.indexOf('done') + 1)
    const marks = blockWidgets(state)
    expect(marks.length).toBe(4)
    const labels = marks.map(
      (m) => (m.widget as ListMarkerWidget as unknown as { label: string }).label,
    )
    expect(labels).toEqual(['•', '•', '1.', '2.'])
    // first bullet covers '-' (from 0 to 1)
    expect(marks[0].from).toBe(0)
    expect(marks[0].to).toBe(1)
  })

  it('reveals markers when the cursor is inside the item', () => {
    const doc = '- one\n\nx'
    const state = stateOf(doc, doc.indexOf('one') + 1)
    expect(blockWidgets(state)).toEqual([])
  })
})

describe('blockFormatDecorations — task lists', () => {
  it('renders checkboxes reflecting checked state', () => {
    const doc = '- [ ] todo\n- [x] done\n\nend'
    const state = stateOf(doc, doc.indexOf('end') + 1)
    const boxes = blockWidgets(state)
      .filter((b) => b.widget instanceof TaskCheckboxWidget)
      .map((b) => b.widget as TaskCheckboxWidget)
    expect(boxes.length).toBe(2)
    expect(boxes.map((w) => (w as unknown as { checked: boolean }).checked)).toEqual([
      false,
      true,
    ])
  })

  it('reveals the marker when the cursor is on the task line', () => {
    const doc = '- [ ] todo\n\nend'
    const state = stateOf(doc, doc.indexOf('todo') + 1)
    expect(blockWidgets(state)).toEqual([])
  })
})

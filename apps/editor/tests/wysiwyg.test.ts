import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { inlineFormatDecorations } from '../src/lib/wysiwyg'

/** build decorations for `doc` with the cursor at `head`, as "from-to:kind" */
function decos(doc: string, head: number, from = 0, to = doc.length): string[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown()],
    selection: { anchor: head },
  })
  const out: string[] = []
  inlineFormatDecorations(state, from, to).between(from, to, (f, t, value) => {
    out.push(`${f}-${t}:${value.spec.class ?? 'hidden'}`)
  })
  // same-start decorations come back in CodeMirror's side order, so compare
  // position sets rather than raw iteration order
  return out.sort((a, b) => {
    const [fa, ta] = a.split('-').map(Number)
    const [fb, tb] = b.split('-').map(Number)
    return fa - fb || ta - tb
  })
}

describe('inlineFormatDecorations', () => {
  it('hides bold markers when the cursor is outside the span', () => {
    expect(decos('**bold** tail', 9)).toEqual([
      '0-2:hidden',
      '0-8:cm-md-strong',
      '6-8:hidden',
    ])
  })

  it('reveals the source when the cursor is inside the span', () => {
    expect(decos('**bold** tail', 4)).toEqual([])
  })

  it('reveals the source when the cursor sits on a marker', () => {
    expect(decos('**bold** tail', 1)).toEqual([])
  })

  it('hides inline code backticks', () => {
    expect(decos('`code` x', 7)).toEqual([
      '0-1:hidden',
      '0-6:cm-md-code',
      '5-6:hidden',
    ])
  })

  it('hides single-asterisk and underscore italic markers', () => {
    expect(decos('*em* a', 5)).toEqual(['0-1:hidden', '0-4:cm-md-em', '3-4:hidden'])
    expect(decos('_em_ a', 5)).toEqual(['0-1:hidden', '0-4:cm-md-em', '3-4:hidden'])
  })

  it('keeps only the outer marks for nested emphasis', () => {
    // "***bi***" -> StrongEmphasis wraps an Emphasis; both hide their marks
    const hidden = decos('***bi*** tail', 9).filter((d) => d.endsWith(':hidden'))
    expect(hidden.length).toBeGreaterThanOrEqual(4)
  })

  it('limits decorations to the requested range', () => {
    // "**bold** and **more**" — the second span starts at 13
    expect(decos('**bold** and **more**', 0, 10, 21)).toEqual([
      '13-15:hidden',
      '13-21:cm-md-strong',
      '19-21:hidden',
    ])
  })
})

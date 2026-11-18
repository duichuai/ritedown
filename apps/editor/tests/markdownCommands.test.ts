import { describe, expect, it } from 'vitest'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import {
  insertBlock,
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from '../src/lib/markdownCommands'

/** build a state with a (possibly empty) selection */
function stateOf(doc: string, from = doc.length, to = from): EditorState {
  return EditorState.create({ doc, selection: { anchor: from, head: to } })
}

function run(state: EditorState, spec: TransactionSpec): EditorState {
  return state.update(spec).state
}

describe('toggleWrap', () => {
  it('inserts a marker pair and puts the caret inside', () => {
    const next = run(stateOf(''), toggleWrap(stateOf(''), '**'))
    expect(next.doc.toString()).toBe('****')
    expect(next.selection.main.head).toBe(2)
  })

  it('wraps a selection and keeps it selected', () => {
    const state = stateOf('hello', 0, 5)
    const next = run(state, toggleWrap(state, '**'))
    expect(next.doc.toString()).toBe('**hello**')
    expect(next.selection.main.from).toBe(2)
    expect(next.selection.main.to).toBe(7)
  })

  it('unwraps when the markers are already adjacent', () => {
    const state = stateOf('**bold**', 2, 6)
    const next = run(state, toggleWrap(state, '**'))
    expect(next.doc.toString()).toBe('bold')
  })

  it('restores an empty document when toggled twice', () => {
    const first = run(stateOf(''), toggleWrap(stateOf(''), '*'))
    expect(first.doc.toString()).toBe('**')
    const second = run(first, toggleWrap(first, '*'))
    expect(second.doc.toString()).toBe('')
  })
})

describe('toggleHeading', () => {
  it('adds and removes the hash prefix', () => {
    const withHash = run(stateOf('title'), toggleHeading(stateOf('title'), 2))
    expect(withHash.doc.toString()).toBe('## title')
    const without = run(withHash, toggleHeading(withHash, 2))
    expect(without.doc.toString()).toBe('title')
  })

  it('prefixes every selected line', () => {
    const state = stateOf('a\nb', 0, 3)
    const next = run(state, toggleHeading(state, 2))
    expect(next.doc.toString()).toBe('## a\n## b')
  })

  it('level 0 strips the heading', () => {
    const state = stateOf('# title')
    const next = run(state, toggleHeading(state, 0))
    expect(next.doc.toString()).toBe('title')
  })
})

describe('toggleList', () => {
  it('numbers selected lines in order', () => {
    const state = stateOf('a\nb', 0, 3)
    const next = run(state, toggleList(state, 'ordered'))
    expect(next.doc.toString()).toBe('1. a\n2. b')
  })

  it('converts a bullet list into a task list', () => {
    const state = stateOf('- a')
    const next = run(state, toggleList(state, 'task'))
    expect(next.doc.toString()).toBe('- [ ] a')
  })

  it('removes markers when every line already has them', () => {
    const state = stateOf('- a\n- b', 0, 7)
    const next = run(state, toggleList(state, 'bullet'))
    expect(next.doc.toString()).toBe('a\nb')
  })
})

describe('toggleQuote', () => {
  it('toggles the quote marker', () => {
    const quoted = run(stateOf('a'), toggleQuote(stateOf('a')))
    expect(quoted.doc.toString()).toBe('> a')
    const plain = run(quoted, toggleQuote(quoted))
    expect(plain.doc.toString()).toBe('a')
  })
})

describe('insertLink', () => {
  it('uses the selection as the label and lands in the url slot', () => {
    const state = stateOf('docs', 0, 4)
    const next = run(state, insertLink(state))
    expect(next.doc.toString()).toBe('[docs]()')
    expect(next.selection.main.head).toBe(7)
  })

  it('inserts an empty link and puts the caret in the label slot', () => {
    const next = run(stateOf(''), insertLink(stateOf('')))
    expect(next.doc.toString()).toBe('[]()')
    expect(next.selection.main.head).toBe(1)
  })
})

describe('insertBlock', () => {
  it('pads a block so it never glues onto the previous line', () => {
    const state = stateOf('hello', 5)
    const next = run(state, insertBlock(state, '---', 3))
    expect(next.doc.toString()).toBe('hello\n\n---')
  })
})

describe('insertCodeBlock', () => {
  it('places the caret inside the fence', () => {
    const next = run(stateOf(''), insertCodeBlock(stateOf(''), 'js'))
    expect(next.doc.toString()).toBe('```js\n\n```')
    expect(next.selection.main.head).toBe(6)
  })
})

describe('insertTable', () => {
  it('inserts a header, divider and empty rows', () => {
    const next = run(stateOf(''), insertTable(stateOf('')))
    const doc = next.doc.toString()
    expect(doc.split('\n')[0]).toContain('| 列 1 | 列 2 | 列 3 |')
    expect(doc.split('\n')[1]).toBe('| --- | --- | --- |')
    expect(next.selection.main.head).toBe(2)
  })
})

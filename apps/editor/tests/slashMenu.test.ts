import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompletionContext } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { setLocale } from '../src/lib/i18n'
import { slashMenuSource } from '../src/lib/slashMenu'

// the completion labels are translated, so pin the locale
beforeEach(() => setLocale('zh'))

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc })
}

/** run the source as CodeMirror would after typing at `pos` */
function query(doc: string, run: (name: string) => void = () => {}, pos = doc.length) {
  return slashMenuSource(run)(new CompletionContext(stateOf(doc), pos, false))
}

describe('slashMenuSource', () => {
  it('opens at the start of an empty line', () => {
    const result = query('\n/')
    expect(result).not.toBeNull()
    expect(result!.from).toBe(1)
    expect(result!.options).toHaveLength(13)
    for (const option of result!.options) {
      expect(option.label.startsWith('/')).toBe(true)
      expect(option.type).toBe('keyword')
      expect(option.detail).toBeTruthy()
    }
  })

  it('opens on a blank line after text', () => {
    const result = query('hello\n  /')
    expect(result).not.toBeNull()
    expect(result!.from).toBe(8)
  })

  it('ignores a slash in the middle of a line', () => {
    expect(query('text /')).toBeNull()
  })

  it('ignores a slash after a list marker or quote', () => {
    expect(query('- /')).toBeNull()
    expect(query('> /')).toBeNull()
  })

  it('keeps matching while the query grows', () => {
    const result = query('/表格')
    expect(result).not.toBeNull()
    expect(result!.from).toBe(0)
    expect(result!.options.map((option) => option.label)).toContain('/表格')
  })

  it('translates the labels with the active locale', () => {
    setLocale('en')
    const labels = query('/')!.options.map((option) => option.label)
    expect(labels).toContain('/Table')
    expect(labels).not.toContain('/表格')
  })

  it('clears the typed query before running the command', () => {
    const run = vi.fn()
    const option = query('/', run)!.options.find((item) => item.label === '/表格')!
    const dispatch = vi.fn()
    // the apply callback only dispatches one transaction and delegates the
    // command itself, so a stub view is enough
    const view = { dispatch } as unknown as EditorView

    option.apply!(view, option, 0, 3)

    expect(dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 3, insert: '' },
      selection: { anchor: 0 },
    })
    expect(run).toHaveBeenCalledWith('table')
  })
})

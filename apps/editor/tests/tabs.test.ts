import { describe, expect, it } from 'vitest'
import {
  findTabByHandle,
  makeTab,
  neighborTabId,
  type EditorTab,
} from '../src/lib/tabs'
import type { FileRef } from '../src/lib/fileProvider'

function tabNamed(name: string): EditorTab {
  return makeTab({ name, text: `# ${name}` })
}

describe('makeTab', () => {
  it('assigns unique ids and starts clean', () => {
    const a = makeTab({ name: 'a.md', text: 'a' })
    const b = makeTab({ name: 'b.md', text: 'b' })
    expect(a.id).not.toBe(b.id)
    expect(a.text).toBe(a.saved)
    expect(a.handle).toBeNull()
    expect(a.cursorLine).toBe(1)
  })
})

describe('neighborTabId', () => {
  it('prefers the right neighbour, then the left, then null', () => {
    const tabs = [tabNamed('a.md'), tabNamed('b.md'), tabNamed('c.md')]
    expect(neighborTabId(tabs, 0)).toBe(tabs[1].id)
    expect(neighborTabId(tabs, 2)).toBe(tabs[1].id)
    expect(neighborTabId(tabs, 1)).toBe(tabs[2].id)
    expect(neighborTabId([tabs[0]], 0)).toBeNull()
    expect(neighborTabId([], 0)).toBeNull()
  })
})

describe('findTabByHandle', () => {
  it('matches by ref id, not object identity', () => {
    const file: FileRef = { kind: 'file', id: 'a', name: 'a.md' }
    const sameFile: FileRef = { kind: 'file', id: 'a', name: 'a.md' }
    const tab = makeTab({ name: 'a.md', text: '', handle: file })
    const other = makeTab({ name: 'b.md', text: '' })
    expect(findTabByHandle([tab, other], sameFile)).toBe(tab)
    expect(findTabByHandle([tab, other], { kind: 'file', id: 'z', name: 'z.md' })).toBeNull()
    expect(findTabByHandle([other], file)).toBeNull()
  })
})

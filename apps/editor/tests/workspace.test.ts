import { describe, expect, it } from 'vitest'
import {
  isIgnoredDirName,
  isMarkdownName,
  sortEntries,
} from '../src/lib/workspace'
import { listDir, toDirRef } from '../src/lib/providerWeb'
import type { WorkspaceEntry } from '../src/lib/fileProvider'

/** minimal fake handle for pure-logic tests */
function fakeHandle(
  kind: 'file' | 'directory',
  name: string,
): { kind: 'file' | 'directory'; name: string } {
  return { kind, name }
}

/** fake directory whose entries() yields the given [name, handle] pairs */
function fakeDir(pairs: [string, { kind: 'file' | 'directory'; name: string }][]): {
  entries: () => AsyncIterableIterator<[string, { kind: string; name: string }]>
} {
  return {
    async *entries() {
      for (const pair of pairs) yield pair
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('isMarkdownName', () => {
  it('accepts md/markdown case-insensitively and rejects others', () => {
    expect(isMarkdownName('a.md')).toBe(true)
    expect(isMarkdownName('A.MARKDOWN')).toBe(true)
    expect(isMarkdownName('a.txt')).toBe(false)
    expect(isMarkdownName('a.mdx')).toBe(false)
    expect(isMarkdownName('')).toBe(false)
  })
})

describe('isIgnoredDirName', () => {
  it('ignores dot dirs and known noise dirs', () => {
    expect(isIgnoredDirName('.git')).toBe(true)
    expect(isIgnoredDirName('.hidden')).toBe(true)
    expect(isIgnoredDirName('node_modules')).toBe(true)
    expect(isIgnoredDirName('dist')).toBe(true)
    expect(isIgnoredDirName('docs')).toBe(false)
    expect(isIgnoredDirName('assets')).toBe(false)
  })
})

describe('sortEntries', () => {
  it('orders directories first, then files, case-insensitive', () => {
    const entries: WorkspaceEntry[] = [
      { kind: 'file', name: 'beta.md', handle: fakeHandle('file', 'beta.md') as unknown as WorkspaceEntry['handle'] },
      { kind: 'directory', name: 'zeta', handle: fakeHandle('directory', 'zeta') as unknown as WorkspaceEntry['handle'] },
      { kind: 'file', name: 'Alpha.md', handle: fakeHandle('file', 'Alpha.md') as unknown as WorkspaceEntry['handle'] },
      { kind: 'directory', name: 'alpha', handle: fakeHandle('directory', 'alpha') as unknown as WorkspaceEntry['handle'] },
    ]
    expect(sortEntries(entries).map((e) => e.name)).toEqual([
      'alpha',
      'zeta',
      'Alpha.md',
      'beta.md',
    ])
  })

  it('does not mutate the input array', () => {
    const entries: WorkspaceEntry[] = [
      { kind: 'file', name: 'b.md', handle: fakeHandle('file', 'b.md') as unknown as WorkspaceEntry['handle'] },
      { kind: 'file', name: 'a.md', handle: fakeHandle('file', 'a.md') as unknown as WorkspaceEntry['handle'] },
    ]
    sortEntries(entries)
    expect(entries.map((e) => e.name)).toEqual(['b.md', 'a.md'])
  })
})

describe('listDir (web provider)', () => {
  it('keeps directories (except ignored) and files, sorted', async () => {
    const dir = toDirRef(fakeDir([
      ['zeta', fakeHandle('directory', 'zeta')],
      ['b.md', fakeHandle('file', 'b.md')],
      ['.git', fakeHandle('directory', '.git')],
      ['node_modules', fakeHandle('directory', 'node_modules')],
      ['A.md', fakeHandle('file', 'A.md')],
      ['assets', fakeHandle('directory', 'assets')],
    ]) as FileSystemDirectoryHandle)
    const entries = await listDir(dir)
    expect(entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
      'directory:assets',
      'directory:zeta',
      'file:A.md',
      'file:b.md',
    ])
  })
})

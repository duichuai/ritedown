import { describe, expect, it } from 'vitest'
import {
  buildMatcher,
  findMatches,
  searchWorkspace,
  type FileHits,
} from '../src/lib/search'
import { toDirRef } from '../src/lib/providerWeb'

describe('buildMatcher', () => {
  it('escapes literal queries unless regex mode is on', () => {
    const literal = buildMatcher('a.b', {})
    expect(literal?.test('a.b')).toBe(true)
    expect(literal?.test('axb')).toBe(false)
    const regex = buildMatcher('a.b', { useRegex: true })
    expect(regex?.test('axb')).toBe(true)
  })

  it('is case-insensitive by default and null for empty/invalid input', () => {
    expect(buildMatcher('ABC', {})?.test('abc')).toBe(true)
    expect(buildMatcher('ABC', { caseSensitive: true })?.test('abc')).toBe(false)
    expect(buildMatcher('', {})).toBeNull()
    expect(buildMatcher('([', { useRegex: true })).toBeNull()
  })
})

describe('findMatches', () => {
  it('reports 1-based line/column and match length', () => {
    const hits = findMatches('foo bar\nbaz foo', 'foo')
    expect(hits).toEqual([
      { line: 1, column: 1, length: 3, lineText: 'foo bar' },
      { line: 2, column: 5, length: 3, lineText: 'baz foo' },
    ])
  })

  it('finds multiple matches on the same line', () => {
    expect(findMatches('a a a', 'a').length).toBe(3)
  })

  it('caps matches per file', () => {
    const hits = findMatches('x\n'.repeat(100), 'x')
    expect(hits.length).toBe(50)
  })
})

describe('searchWorkspace', () => {
  function fakeFile(name: string, text: string): FileSystemFileHandle {
    return {
      kind: 'file',
      name,
      getFile: async () =>
        ({ name, text: async () => text }) as unknown as File,
    } as unknown as FileSystemFileHandle
  }

  function fakeDir(
    entries: [string, FileSystemHandle][],
  ): FileSystemDirectoryHandle {
    return {
      kind: 'directory',
      name: 'root',
      async *entries() {
        for (const e of entries) yield e
      },
    } as unknown as FileSystemDirectoryHandle
  }

  it('walks subfolders, reports markdown hits with relative paths', async () => {
    const dir = toDirRef(fakeDir([
      ['notes.md', fakeFile('notes.md', 'hello world\nHELLO again')],
      ['readme.txt', fakeFile('readme.txt', 'hello ignored')],
      ['docs', fakeDir([['guide.md', fakeFile('guide.md', 'say hello')]])],
    ]) as FileSystemDirectoryHandle)
    const files: FileHits[] = []
    const complete = await searchWorkspace(dir, 'hello', {}, (f) => files.push(f), {
      stopped: false,
    })
    expect(complete).toBe(true)
    expect(files.map((f) => f.path)).toEqual(['docs/guide.md', 'notes.md'])
    expect(files[1].hits.length).toBe(2)
    expect(files[1].hits[1].line).toBe(2)
  })

  it('stops when the signal is set', async () => {
    const dir = toDirRef(fakeDir([
      ['a.md', fakeFile('a.md', 'hello')],
      ['b.md', fakeFile('b.md', 'hello')],
    ]) as FileSystemDirectoryHandle)
    const signal = { stopped: false }
    const files: FileHits[] = []
    await searchWorkspace(dir, 'hello', {}, (f) => {
      files.push(f)
      signal.stopped = true
    }, signal)
    expect(files.length).toBe(1)
  })

  it('returns true immediately for an empty query', async () => {
    const dir = toDirRef(fakeDir([['a.md', fakeFile('a.md', 'hello')]]) as FileSystemDirectoryHandle)
    const scanned: FileHits[] = []
    expect(
      await searchWorkspace(dir, '', {}, (f) => scanned.push(f), { stopped: false }),
    ).toBe(true)
    expect(scanned).toEqual([])
  })
})

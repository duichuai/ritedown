/**
 * Workspace global search. Pure matching helpers are exported separately for
 * unit tests; searchWorkspace walks the directory tree and reports hits per
 * file through a callback so the UI can update progressively.
 */

import { isIgnoredDirName, isMarkdownName, listDir } from './workspace'

export interface SearchOptions {
  caseSensitive?: boolean
  useRegex?: boolean
}

export interface SearchHit {
  /** 1-based line number */
  line: number
  /** 1-based column of the first match on the line */
  column: number
  /** match length, for highlighting */
  length: number
  /** the (trimmed) source line */
  lineText: string
}

export interface FileHits {
  /** path relative to the workspace root */
  path: string
  handle: FileSystemFileHandle
  parentDir: FileSystemDirectoryHandle
  hits: SearchHit[]
}

/** maximum matches reported per file */
const MAX_HITS_PER_FILE = 50

/** null when the query is empty or the regex is invalid */
export function buildMatcher(
  query: string,
  options: SearchOptions,
): RegExp | null {
  if (!query) return null
  const flags = options.caseSensitive ? 'g' : 'gi'
  const source = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return new RegExp(source, flags)
  } catch {
    return null // invalid regex
  }
}

/** All matches of `matcher` on one line (matcher must have the g flag). */
function lineMatches(matcher: RegExp, line: string, offset: number): SearchHit[] {
  const hits: SearchHit[] = []
  matcher.lastIndex = 0
  for (let m = matcher.exec(line); m; m = matcher.exec(line)) {
    hits.push({
      line: offset + 1,
      column: m.index + 1,
      length: m[0].length || 1, // zero-width matches highlight 1 char
      lineText: line.trim(),
    })
    if (m[0].length === 0) matcher.lastIndex++ // avoid infinite loops
    if (hits.length >= MAX_HITS_PER_FILE) break
  }
  return hits
}

/** Find every match of `query` in a markdown text, capped per file. */
export function findMatches(
  text: string,
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  const matcher = buildMatcher(query, options)
  if (!matcher) return []
  const hits: SearchHit[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length && hits.length < MAX_HITS_PER_FILE; i++) {
    hits.push(...lineMatches(matcher, lines[i], i))
  }
  return hits
}

/** Walk the workspace searching markdown files; reports each file's hits via
 * `onFile` as soon as it is scanned (batched, non-blocking). Returns false
 * early when `signal.stopped` flips true. */
export async function searchWorkspace(
  dir: FileSystemDirectoryHandle,
  query: string,
  options: SearchOptions,
  onFile: (file: FileHits) => void,
  signal: { stopped: boolean },
  /** internal: path prefix relative to the workspace root */
  prefix = '',
): Promise<boolean> {
  if (!buildMatcher(query, options)) return true
  for (const entry of await listDir(dir)) {
    if (signal.stopped) return false
    if (entry.kind === 'directory') {
      const ok = await searchWorkspace(
        entry.handle,
        query,
        options,
        onFile,
        signal,
        `${prefix}${entry.name}/`,
      )
      if (!ok) return false
    } else if (isMarkdownName(entry.name)) {
      const text = await (await entry.handle.getFile()).text()
      const hits = findMatches(text, query, options)
      if (hits.length) {
        onFile({
          path: `${prefix}${entry.name}`,
          handle: entry.handle,
          parentDir: dir,
          hits,
        })
      }
    }
    // yield to the UI thread between files
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return true
}

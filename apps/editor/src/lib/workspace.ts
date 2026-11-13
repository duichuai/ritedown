/**
 * Folder workspace data layer (File System Access API, Chromium). Provides
 * directory enumeration for the file tree, workspace handle persistence via
 * IndexedDB, and permission management. Pure helpers are exported separately
 * so they can be unit-tested without a browser.
 */

import { isAbortError } from './fsAccess'

export interface WorkspaceFileEntry {
  kind: 'file'
  name: string
  handle: FileSystemFileHandle
}

export interface WorkspaceDirEntry {
  kind: 'directory'
  name: string
  handle: FileSystemDirectoryHandle
}

export type WorkspaceEntry = WorkspaceFileEntry | WorkspaceDirEntry

/** directories that never belong in a document workspace tree */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'target', '.git', '.svn', '.hg'])

export function isIgnoredDirName(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRS.has(name)
}

export function isMarkdownName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name)
}

/** file-tree order: directories first, then files, case-insensitive */
export function sortEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/** List one directory's immediate entries, applying the ignore rules.
 * Markdown files keep their handles; other files are listed by name only. */
export async function listDir(
  dir: FileSystemDirectoryHandle,
): Promise<WorkspaceEntry[]> {
  const entries: WorkspaceEntry[] = []
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      if (isIgnoredDirName(name)) continue
      entries.push({ kind: 'directory', name, handle })
    } else {
      entries.push({ kind: 'file', name, handle })
    }
  }
  return sortEntries(entries)
}

// --- handle persistence (IndexedDB) --------------------------------------

const DB_NAME = 'ritedown'
const STORE = 'handles'
const KEY = 'workspace'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = run(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

/** Remember the workspace folder across sessions. */
export async function saveWorkspaceHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, KEY))
}

/** The persisted workspace folder, or null when none was saved. */
export async function loadWorkspaceHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await withStore('readonly', (store) => store.get(KEY))) ?? null
  } catch {
    return null // no IndexedDB (tests / private mode)
  }
}

export async function clearWorkspaceHandle(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY))
}

// --- picker & permissions -------------------------------------------------

export function isWorkspaceSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** Ask the user to pick the workspace folder and remember it.
 * Returns null when the picker is cancelled. */
export async function pickWorkspaceDir(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as unknown as {
    showDirectoryPicker: (o?: unknown) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  try {
    const dir = await picker({ id: 'ritedown-workspace', mode: 'readwrite' })
    await saveWorkspaceHandle(dir)
    return dir
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export type PermissionState = 'granted' | 'denied' | 'prompt'

/** Current permission without prompting (for restoring a saved workspace). */
export async function queryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return (await handle.queryPermission({ mode: 'readwrite' })) as PermissionState
}

/** Ask for read/write access; must be called from a user gesture. */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return (await handle.requestPermission({ mode: 'readwrite' })) as PermissionState
}

/** Read a markdown file's text from its handle. */
export async function readMarkdownFile(
  handle: FileSystemFileHandle,
): Promise<{ name: string; text: string }> {
  const file = await handle.getFile()
  return { name: file.name, text: await file.text() }
}

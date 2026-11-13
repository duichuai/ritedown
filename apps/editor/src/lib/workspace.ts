/**
 * Workspace web data layer (File System Access API, Chromium). Pure helpers
 * are shared by both provider implementations; the IndexedDB handle
 * persistence and permission helpers are web-only and used by providerWeb.
 * Pure helpers are exported separately so they can be unit-tested without a
 * browser.
 */

import type { WorkspaceEntry } from './fileProvider'

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

// --- permissions ----------------------------------------------------------

export type PermissionState = 'granted' | 'denied' | 'prompt'

/** Current permission without prompting (for restoring a saved workspace). */
export async function queryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return (
    (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt'
  ) as PermissionState
}

/** Ask for read/write access; must be called from a user gesture. */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  const request = handle.requestPermission?.bind(handle)
  if (!request) return 'denied'
  return (await request({ mode: 'readwrite' })) as PermissionState
}

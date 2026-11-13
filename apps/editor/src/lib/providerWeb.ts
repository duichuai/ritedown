/**
 * FileProvider implementation for browsers, on top of the File System
 * Access API (Chromium). Handles are wrapped in opaque refs with stable
 * ids (WeakMap) so tab dedupe keeps working; raw handles stay encapsulated
 * here. Callers must not reach into refs — everything goes through the
 * provider methods.
 */

import {
  isAbortError,
  isFsAccessSupported,
  openMarkdownFile,
  pickSaveHandle,
  saveToHandle,
} from './fsAccess'
import {
  isIgnoredDirName,
  loadWorkspaceHandle,
  queryPermission,
  requestPermission,
  saveWorkspaceHandle,
  sortEntries,
} from './workspace'
import type {
  DirRef,
  FileTypeOptions,
  FileProvider,
  FileRef,
  OpenedDoc,
  RestoredWorkspace,
  SavedDoc,
  WorkspaceEntry,
} from './fileProvider'

/** web refs carry the raw FSA handle; opaque outside this module */
interface WebFileRef extends FileRef {
  readonly handle: FileSystemFileHandle
}

interface WebDirRef extends DirRef {
  readonly handle: FileSystemDirectoryHandle
}

const ids = new WeakMap<object, string>()
let seq = 0

function refId(handle: FileSystemHandle): string {
  let id = ids.get(handle)
  if (!id) {
    id = `h${++seq}`
    ids.set(handle, id)
  }
  return id
}

/** wrap a file handle obtained outside the provider (drag & drop) */
export function toFileRef(handle: FileSystemFileHandle): FileRef {
  const ref: WebFileRef = { kind: 'file', id: refId(handle), name: handle.name, handle }
  return ref
}

/** wrap a directory handle obtained outside the provider (tests) */
export function toDirRef(handle: FileSystemDirectoryHandle): DirRef {
  const ref: WebDirRef = { kind: 'dir', id: refId(handle), name: handle.name, handle }
  return ref
}

/** TS DOM lib lacks the async-iterator members on directory handles */
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  >
}

/** list one directory's immediate entries (exported for unit tests) */
export async function listDir(dir: DirRef): Promise<WorkspaceEntry[]> {
  const handle = (dir as WebDirRef).handle
  const entries: WorkspaceEntry[] = []
  for await (const [name, entry] of (handle as IterableDirectoryHandle).entries()) {
    if (entry.kind === 'directory') {
      if (isIgnoredDirName(name)) continue
      entries.push({ kind: 'directory', name, handle: toDirRef(entry) })
    } else {
      entries.push({ kind: 'file', name, handle: toFileRef(entry) })
    }
  }
  return sortEntries(entries)
}

async function readDoc(file: FileRef): Promise<{ name: string; text: string }> {
  const f = await (file as WebFileRef).handle.getFile()
  return { name: f.name, text: await f.text() }
}

async function openFile(): Promise<OpenedDoc | null> {
  try {
    const opened = await openMarkdownFile()
    return {
      file: toFileRef(opened.handle),
      name: opened.name,
      text: opened.text,
    }
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

function acceptFor(extensions: string[]): Record<string, string[]> {
  const mime = /html?$/i.test(extensions[0] ?? '')
    ? 'text/html'
    : /markdown|md$/i.test(extensions[0] ?? '')
      ? 'text/markdown'
      : /txt$/i.test(extensions[0] ?? '')
        ? 'text/plain'
        : 'application/octet-stream'
  return { [mime]: extensions }
}

async function saveFile(
  defaultName: string,
  text: string,
  existing?: FileRef | null,
  fileType?: FileTypeOptions,
): Promise<SavedDoc | null> {
  const ref = existing as WebFileRef | null | undefined
  if (ref) {
    await saveToHandle(ref.handle, text)
    return { file: ref, name: (await ref.handle.getFile()).name }
  }
  const options: Record<string, unknown> = fileType
    ? {
        types: [
          {
            description: fileType.description ?? 'File',
            accept: acceptFor(fileType.extensions),
          },
        ],
      }
    : {}
  try {
    const handle = await pickSaveHandle(defaultName, options)
    await saveToHandle(handle, text)
    return { file: toFileRef(handle), name: handle.name }
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

function dirPicker(): ((options?: unknown) => Promise<FileSystemDirectoryHandle>) | null {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (o?: unknown) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker
  return picker ?? null
}

async function pickWorkspace(): Promise<DirRef | null> {
  const picker = dirPicker()
  if (!picker) return null
  try {
    const dir = await picker({ id: 'ritedown-workspace', mode: 'readwrite' })
    await saveWorkspaceHandle(dir)
    return toDirRef(dir)
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

async function restoreWorkspace(): Promise<RestoredWorkspace | null> {
  const saved = await loadWorkspaceHandle()
  if (!saved) return null
  const dir = toDirRef(saved)
  return (await queryPermission(saved)) === 'granted'
    ? { dir }
    : { needsPermission: dir }
}

async function grantWorkspace(dir: DirRef): Promise<DirRef | null> {
  const handle = (dir as WebDirRef).handle
  return (await requestPermission(handle)) === 'granted' ? dir : null
}

async function pickDocDir(startIn?: FileRef | null): Promise<DirRef | null> {
  const picker = dirPicker()
  if (!picker) return null
  try {
    const options: Record<string, unknown> = { mode: 'readwrite' }
    const start = startIn as WebFileRef | null | undefined
    if (start?.handle) options.startIn = start.handle
    return toDirRef(await picker(options))
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

async function writeAsset(dir: DirRef, path: string, data: Blob): Promise<void> {
  let dirHandle = (dir as WebDirRef).handle
  const segments = path.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) throw new Error('empty asset path')
  for (const segment of segments) {
    dirHandle = await dirHandle.getDirectoryHandle(segment, { create: true })
  }
  const handle = await dirHandle.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

async function readAsset(dir: DirRef, path: string): Promise<Blob | null> {
  let dirHandle = (dir as WebDirRef).handle
  const segments = path.split('/').filter((s) => s && s !== '.')
  const name = segments.pop()
  if (!name) return null
  // ascending above the picked folder is not possible without parent access
  for (const segment of segments) {
    if (segment === '..') return null
    try {
      dirHandle = await dirHandle.getDirectoryHandle(segment)
    } catch {
      return null
    }
  }
  try {
    return await (await dirHandle.getFileHandle(name)).getFile()
  } catch {
    return null
  }
}

export const webProvider: FileProvider = {
  kind: 'web',
  get fsSupported() {
    return isFsAccessSupported()
  },
  get workspaceSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  },
  openFile,
  saveFile,
  pickWorkspace,
  restoreWorkspace,
  grantWorkspace,
  listDir,
  readDoc,
  pickDocDir,
  writeAsset,
  readAsset,
}

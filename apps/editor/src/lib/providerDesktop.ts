/**
 * FileProvider implementation for the Tauri desktop shell, on top of the
 * fs and dialog plugins. Refs wrap absolute paths (id = path, so tab dedupe
 * works by path); the workspace is persisted as a path in localStorage; the
 * native open/save dialogs grant filesystem scope automatically, so there
 * are no permission prompts.
 */

import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog'
import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { isIgnoredDirName, sortEntries } from './workspace'
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

const WORKSPACE_KEY = 'ritedown-desktop-workspace'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function dirname(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : path
}

function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`
}

function fileRef(path: string): FileRef {
  return { kind: 'file', id: path, name: basename(path) }
}

function dirRef(path: string): DirRef {
  return { kind: 'dir', id: path, name: basename(path) }
}

function dialogFilters(fileType?: FileTypeOptions) {
  return [
    {
      name: fileType?.description ?? 'Markdown',
      extensions: fileType?.extensions ?? ['md', 'markdown'],
    },
  ]
}

async function openFile(): Promise<OpenedDoc | null> {
  const path = await dialogOpen({
    multiple: false,
    directory: false,
    filters: dialogFilters(),
  })
  if (typeof path !== 'string') return null
  return {
    file: fileRef(path),
    name: basename(path),
    text: await readTextFile(path),
  }
}

async function saveFile(
  defaultName: string,
  text: string,
  existing?: FileRef | null,
  fileType?: FileTypeOptions,
): Promise<SavedDoc | null> {
  if (existing) {
    await writeTextFile(existing.id, text)
    return { file: existing, name: existing.name }
  }
  const path = await dialogSave({
    defaultPath: defaultName,
    filters: dialogFilters(fileType),
  })
  if (!path) return null
  await writeTextFile(path, text)
  return { file: fileRef(path), name: basename(path) }
}

async function pickWorkspace(): Promise<DirRef | null> {
  const path = await dialogOpen({ directory: true, multiple: false })
  if (typeof path !== 'string') return null
  try {
    localStorage.setItem(WORKSPACE_KEY, path)
  } catch {
    // no localStorage
  }
  return dirRef(path)
}

async function restoreWorkspace(): Promise<RestoredWorkspace | null> {
  let path: string | null = null
  try {
    path = localStorage.getItem(WORKSPACE_KEY)
  } catch {
    return null // no localStorage
  }
  if (!path) return null
  try {
    if (!(await exists(path))) {
      localStorage.removeItem(WORKSPACE_KEY)
      return null
    }
  } catch {
    return null
  }
  return { dir: dirRef(path) }
}

async function grantWorkspace(dir: DirRef): Promise<DirRef | null> {
  return dir // no permission concept on desktop
}

async function listDir(dir: DirRef): Promise<WorkspaceEntry[]> {
  const entries: WorkspaceEntry[] = []
  for (const entry of await readDir(dir.id)) {
    if (entry.isDirectory) {
      if (isIgnoredDirName(entry.name)) continue
      entries.push({
        kind: 'directory',
        name: entry.name,
        handle: dirRef(joinPath(dir.id, entry.name)),
      })
    } else if (entry.isFile) {
      entries.push({
        kind: 'file',
        name: entry.name,
        handle: fileRef(joinPath(dir.id, entry.name)),
      })
    }
  }
  return sortEntries(entries)
}

async function readDoc(file: FileRef): Promise<{ name: string; text: string }> {
  return { name: file.name, text: await readTextFile(file.id) }
}

async function pickDocDir(startIn?: FileRef | null): Promise<DirRef | null> {
  const path = await dialogOpen({
    directory: true,
    multiple: false,
    defaultPath: startIn ? dirname(startIn.id) : undefined,
  })
  if (typeof path !== 'string') return null
  return dirRef(path)
}

async function writeAsset(dir: DirRef, path: string, data: Blob): Promise<void> {
  const segments = path.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) throw new Error('empty asset path')
  let target = dir.id
  for (const segment of segments) {
    target = joinPath(target, segment)
    await mkdir(target, { recursive: true })
  }
  await writeFile(joinPath(target, name), new Uint8Array(await data.arrayBuffer()))
}

async function readAsset(dir: DirRef, path: string): Promise<Blob | null> {
  const segments = path.split('/').filter((s) => s && s !== '.')
  const name = segments.pop()
  if (!name || segments.includes('..')) return null
  let target = dir.id
  for (const segment of segments) target = joinPath(target, segment)
  try {
    const bytes = await readFile(joinPath(target, name))
    return new Blob([bytes])
  } catch {
    return null
  }
}

export const desktopProvider: FileProvider = {
  kind: 'desktop',
  fsSupported: true,
  workspaceSupported: true,
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

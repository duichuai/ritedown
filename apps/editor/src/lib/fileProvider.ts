/**
 * Environment-agnostic file access layer. UI code talks to a FileProvider
 * implementation through opaque refs instead of raw handles/paths: on the
 * web it wraps the File System Access API (providerWeb), inside the Tauri
 * desktop shell it wraps the fs/dialog plugins (providerDesktop, path based,
 * no permission prompts). provider.ts picks the implementation at runtime.
 */

export interface FileRef {
  readonly kind: 'file'
  /** stable identity for tab dedupe (web: per handle, desktop: file path) */
  readonly id: string
  readonly name: string
}

export interface DirRef {
  readonly kind: 'dir'
  readonly id: string
  readonly name: string
}

export type WorkspaceEntry =
  | { kind: 'directory'; name: string; handle: DirRef }
  | { kind: 'file'; name: string; handle: FileRef }

export interface OpenedDoc {
  file: FileRef
  name: string
  text: string
}

export interface SavedDoc {
  file: FileRef
  name: string
}

/** file-type filter for save dialogs (web accept types / desktop filters) */
export interface FileTypeOptions {
  description?: string
  extensions: string[]
}

/** the persisted workspace outcome: the web may need a permission grant first */
export type RestoredWorkspace = { dir: DirRef } | { needsPermission: DirRef }

export interface FileProvider {
  readonly kind: 'web' | 'desktop'
  /** single-file open/save supported (gates the toolbar buttons) */
  readonly fsSupported: boolean
  /** folder workspace supported (gates the Open Folder button) */
  readonly workspaceSupported: boolean
  /** open an existing markdown file; null when cancelled */
  openFile(): Promise<OpenedDoc | null>
  /** write text to `existing` when given, else ask where to save;
   * null when cancelled */
  saveFile(
    defaultName: string,
    text: string,
    existing?: FileRef | null,
    fileType?: FileTypeOptions,
  ): Promise<SavedDoc | null>
  /** save binary data (e.g. the docx export) to a new file;
   * null when cancelled */
  saveBlob(
    defaultName: string,
    data: Blob,
    fileType?: FileTypeOptions,
  ): Promise<SavedDoc | null>
  /** pick the workspace folder and remember it; null when cancelled */
  pickWorkspace(): Promise<DirRef | null>
  /** load the persisted workspace; may require a permission grant on the web */
  restoreWorkspace(): Promise<RestoredWorkspace | null>
  /** complete a pending permission grant (web only; desktop returns the dir) */
  grantWorkspace(dir: DirRef): Promise<DirRef | null>
  /** immediate children of a directory, ignore rules applied */
  listDir(dir: DirRef): Promise<WorkspaceEntry[]>
  /** read a markdown document */
  readDoc(file: FileRef): Promise<{ name: string; text: string }>
  /** pick a folder for relative-image resolution; null when cancelled */
  pickDocDir(startIn?: FileRef | null): Promise<DirRef | null>
  /** write a binary asset under `dir` at the relative `path` (creates folders) */
  writeAsset(dir: DirRef, path: string, data: Blob): Promise<void>
  /** read a binary asset at the relative `path`; null when missing/unreadable */
  readAsset(dir: DirRef, path: string): Promise<Blob | null>
}

/** true inside the Tauri desktop shell (webview exposes Tauri internals) */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

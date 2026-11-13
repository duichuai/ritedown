/**
 * File System Access API wrapper (Chromium browsers). Callers must check
 * isFsAccessSupported() first — the API is not available in Firefox/Safari.
 */

export interface OpenedFile {
  name: string
  text: string
  handle: FileSystemFileHandle
}

export function isFsAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

function pickerOptions(defaultName?: string) {
  const options: Record<string, unknown> = {
    types: [
      {
        description: 'Markdown',
        accept: { 'text/markdown': ['.md', '.markdown'] },
      },
    ],
  }
  if (defaultName) options.suggestedName = defaultName
  return options
}

/** Ask the user to pick an existing markdown file. */
export async function openMarkdownFile(): Promise<OpenedFile> {
  const picker = window.showOpenFilePicker as (
    options?: unknown,
  ) => Promise<FileSystemFileHandle[]>
  const [handle] = await picker(pickerOptions())
  const file = await handle.getFile()
  return { name: file.name, text: await file.text(), handle }
}

/** Write text to an existing file handle. */
export async function saveToHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

/** Ask the user where to save a new file. */
export async function pickSaveHandle(
  defaultName = 'untitled.md',
): Promise<FileSystemFileHandle> {
  const picker = window.showSaveFilePicker as (
    options?: unknown,
  ) => Promise<FileSystemFileHandle>
  return picker(pickerOptions(defaultName))
}

/** True for user-cancelled pickers, which callers should ignore. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

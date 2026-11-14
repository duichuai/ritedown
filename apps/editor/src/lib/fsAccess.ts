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

function pickerOptions(defaultName?: string, extra?: Record<string, unknown>) {
  const options: Record<string, unknown> = { ...extra }
  // markdown is the default accept type; callers may override (e.g. HTML)
  if (!('types' in options)) {
    options.types = [
      {
        description: 'Markdown',
        accept: { 'text/markdown': ['.md', '.markdown'] },
      },
    ]
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

/** File picked without a filesystem handle (no Save To File support). */
export interface OpenedPlainFile {
  name: string
  text: string
}

/**
 * Pick a markdown file via a hidden <input type=file> — the fallback for
 * browsers without the File System Access API (mobile Safari/Chrome etc.).
 * Rejects with an AbortError DOMException when the dialog is cancelled.
 */
export function openMarkdownViaInput(): Promise<OpenedPlainFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,text/markdown'
    input.style.display = 'none'
    const cleanup = () => input.remove()
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) {
        reject(new DOMException('cancelled', 'AbortError'))
        return
      }
      file
        .text()
        .then((text) => resolve({ name: file.name, text }))
        .catch((err) => {
          cleanup()
          reject(err)
        })
    })
    input.addEventListener('cancel', () => {
      cleanup()
      reject(new DOMException('cancelled', 'AbortError'))
    })
    document.body.appendChild(input)
    input.click()
  })
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
  extraOptions?: Record<string, unknown>,
): Promise<FileSystemFileHandle> {
  const picker = window.showSaveFilePicker as (
    options?: unknown,
  ) => Promise<FileSystemFileHandle>
  return picker(pickerOptions(defaultName, extraOptions))
}

/** True for user-cancelled pickers, which callers should ignore. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

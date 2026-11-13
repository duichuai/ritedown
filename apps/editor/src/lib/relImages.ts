/**
 * Relative-path image preview. Browsers resolve <img src> against the app
 * origin, so relative images in an opened markdown file can't load directly.
 * The user picks the document's folder once (File System Access API) and we
 * resolve relative srcs against it via object URLs.
 */

let baseDir: FileSystemDirectoryHandle | null = null

/** true when src should be resolved against the document folder
 * (no scheme, not root-relative) */
export function isRelativeSrc(src: string): boolean {
  return src !== '' && !/^[a-z][a-z\d+\-.]*:/i.test(src) && !src.startsWith('/')
}

export function hasBaseDir(): boolean {
  return baseDir !== null
}

export function setBaseDir(handle: FileSystemDirectoryHandle | null): void {
  baseDir = handle
}

/** Ask the user to pick the document's folder. Read/write so pasted images
 * can be copied next to the document. */
export async function pickBaseDir(
  startIn?: FileSystemFileHandle,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker
  if (!picker) return null
  try {
    const options: Record<string, unknown> = { mode: 'readwrite' }
    if (startIn) options.startIn = startIn
    baseDir = await picker(options)
    return baseDir
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
}

/** Copy an image blob into the base dir (creating subfolders), used for
 * pasted/dropped images. */
export async function writeImageToBaseDir(
  path: string,
  file: Blob,
): Promise<void> {
  if (!baseDir) throw new Error('no base directory picked')
  const segments = path.split('/').filter(Boolean)
  const name = segments.pop()
  if (!name) throw new Error('empty image path')
  let dir = baseDir
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true })
  }
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(file)
  await writable.close()
}

// object URLs are cached per base-dir + relative path so keystroke re-renders
// don't re-read the file each time
const urlCache = new Map<string, string>()

function cacheKey(path: string): string {
  return `${baseDir?.name ?? ''}:${path}`
}

async function resolveFile(path: string): Promise<File | null> {
  if (!baseDir) return null
  const segments = path.split('/').filter((s) => s && s !== '.')
  const name = segments.pop()
  if (!name) return null
  // ascending above the picked folder is not possible without parent access
  let dir = baseDir
  for (const segment of segments) {
    if (segment === '..') return null
    try {
      dir = await dir.getDirectoryHandle(segment)
    } catch {
      return null
    }
  }
  try {
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch {
    return null
  }
}

/** Resolve every relative-path <img> under root against the base dir.
 * Returns true when at least one relative image is still unresolved. */
export async function resolveRelativeImages(
  root: ParentNode,
): Promise<boolean> {
  const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  let pending = false
  for (const img of images) {
    const src = img.getAttribute('src') ?? ''
    if (!isRelativeSrc(src)) continue
    if (!baseDir) {
      pending = true
      continue
    }
    const key = cacheKey(src)
    let url = urlCache.get(key)
    if (!url) {
      const file = await resolveFile(src)
      if (!file) {
        pending = true
        continue
      }
      url = URL.createObjectURL(file)
      urlCache.set(key, url)
    }
    img.src = url
  }
  return pending
}

export function hasUnresolvedRelativeImages(root: ParentNode): boolean {
  return Array.from(root.querySelectorAll('img')).some((img) => {
    const src = img.getAttribute('src') ?? ''
    return isRelativeSrc(src) && !src.startsWith('blob:')
  })
}

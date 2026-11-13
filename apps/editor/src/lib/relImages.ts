/**
 * Relative-path image preview. Browsers resolve <img src> against the app
 * origin, so relative images in an opened markdown file can't load directly.
 * The user picks the document's folder once and we resolve relative srcs
 * against it via object URLs; asset reads/writes go through the FileProvider
 * so both the web (FSA handles) and desktop (paths) work the same way.
 */

import type { DirRef, FileRef } from './fileProvider'
import { provider } from './provider'

let baseDir: DirRef | null = null

/** true when src should be resolved against the document folder
 * (no scheme, not root-relative) */
export function isRelativeSrc(src: string): boolean {
  return src !== '' && !/^[a-z][a-z\d+\-.]*:/i.test(src) && !src.startsWith('/')
}

export function hasBaseDir(): boolean {
  return baseDir !== null
}

export function setBaseDir(dir: DirRef | null): void {
  baseDir = dir
}

/** Ask the user to pick the document's folder. Read/write so pasted images
 * can be copied next to the document. */
export async function pickBaseDir(
  startIn?: FileRef | null,
): Promise<DirRef | null> {
  const dir = await provider.pickDocDir(startIn)
  if (dir) baseDir = dir
  return dir
}

/** Copy an image blob into the base dir (creating subfolders), used for
 * pasted/dropped images. */
export async function writeImageToBaseDir(
  path: string,
  file: Blob,
): Promise<void> {
  if (!baseDir) throw new Error('no base directory picked')
  await provider.writeAsset(baseDir, path, file)
}

// object URLs are cached per base-dir + relative path so keystroke re-renders
// don't re-read the file each time
const urlCache = new Map<string, string>()

function cacheKey(path: string): string {
  return `${baseDir?.id ?? ''}:${path}`
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
      const blob = await provider.readAsset(baseDir, src)
      if (!blob) {
        pending = true
        continue
      }
      url = URL.createObjectURL(blob)
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

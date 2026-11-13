/** Naming and markdown emission for pasted/dropped images. Pure functions
 * so the timestamp/sanitizing logic is unit-testable without a DOM. */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i

/** `assets/<yyyymmdd-hhmmss>-<sanitized-name>.<ext>` relative to the
 * document folder; the stamp keeps files from colliding. */
export function imageAssetPath(fileName: string, now = new Date()): string {
  const ext = (fileName.match(IMAGE_EXT)?.[1] ?? 'png').toLowerCase()
  const base =
    fileName
      .replace(/\.[^.]+$/, '')
      // keep word chars and CJK; collapse the rest into single dashes
      .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'image'
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `assets/${stamp}-${base}.${ext}`
}

/** markdown image reference; alt text is the sanitized base name so the
 * syntax can't be broken by `]` or brackets in the original file name */
export function imageMarkdown(fileName: string, path: string): string {
  const alt = fileName.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'image'
  return `![${alt}](${path})`
}

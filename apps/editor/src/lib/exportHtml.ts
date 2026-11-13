import { isAbortError, pickSaveHandle } from './fsAccess'

/**
 * Self-contained single-file HTML export. The body HTML is snapshotted from
 * the live preview (Shiki spans, Mermaid SVGs and KaTeX markup are already
 * rendered); images are inlined as data URIs and KaTeX ships with fonts
 * baked in (virtual:katex-export-css, generated at build time).
 */

/** compact standalone stylesheet: mirrors the app's prose rules */
const EXPORT_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  color: #1f2328;
  background: #ffffff;
}
@media (prefers-color-scheme: dark) {
  body { color: #f0f6fc; background: #0d1117; }
  a { color: #4493f8; }
}
.prose { max-width: 920px; margin: 0 auto; padding: 32px 24px 64px; line-height: 1.7; font-size: 15px; }
.prose h1, .prose h2 { line-height: 1.3; padding-bottom: 0.3em; border-bottom: 1px solid #d1d9e0; }
.prose h3 { line-height: 1.3; }
.prose code { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; font-size: 85%; background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 4px; }
.prose pre { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; overflow: auto; }
.prose pre.shiki { padding: 12px 16px; border-radius: 6px; overflow: auto; }
.prose pre code { background: none; padding: 0; }
.prose blockquote { margin: 0 0 16px; padding: 0 1em; border-left: 3px solid #d1d9e0; color: #59636e; }
.prose table { border-collapse: collapse; margin-bottom: 16px; }
.prose th, .prose td { border: 1px solid #d1d9e0; padding: 6px 13px; }
.prose th { background: #f6f8fa; }
.prose a { color: #0969da; }
.prose input[type='checkbox'] { margin-right: 0.4em; }
.prose .markdown-alert { padding: 8px 16px; margin-bottom: 16px; border-left: 3px solid #0969da; border-radius: 4px; background: #f6f8fa; }
.prose .markdown-alert-title { font-weight: 600; margin-bottom: 4px; }
.prose .frontmatter { margin-bottom: 16px; opacity: 0.85; }
.prose .frontmatter table { margin-bottom: 0; font-size: 13px; }
.prose .frontmatter th { color: #59636e; background: none; }
.prose svg { max-width: 100%; }
.prose .katex-display { margin: 1em 0; overflow-x: auto; }
@media (prefers-color-scheme: dark) {
  .prose code, .prose pre, .prose th, .prose .markdown-alert { background: #151b23; }
  .prose h1, .prose h2, .prose th, .prose td, .prose blockquote { border-color: #3d444d; }
  .prose blockquote, .prose .frontmatter th { color: #9198a1; }
  .prose pre.shiki, .prose pre.shiki span { color: var(--shiki-dark) !important; background-color: transparent !important; }
  .prose pre.shiki { background-color: #151b23 !important; }
}
`

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Replace every img src with a data URI where fetchable; unreachable
 * remote/relative images keep their original src. */
async function inlineImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? ''
      if (src === '' || src.startsWith('data:')) return
      try {
        const response = await fetch(src)
        if (!response.ok) return
        img.src = await blobToDataUrl(await response.blob())
      } catch {
        // CORS or missing file — leave the original src
      }
    }),
  )
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Assemble the final standalone HTML document (pure, unit-tested). */
export function assembleDocument(
  bodyHtml: string,
  title: string,
  extraCss = '',
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Ritedown">
<title>${escapeHtml(title)}</title>
<style>${extraCss}${EXPORT_CSS}</style>
</head>
<body>
<article class="prose">
${bodyHtml}
</article>
</body>
</html>
`
}

/** Snapshot the preview DOM into a self-contained HTML file and save it. */
export async function exportHtml(
  preview: HTMLElement,
  title: string,
  suggestedName: string,
): Promise<void> {
  const container = document.createElement('div')
  container.innerHTML = preview.innerHTML
  await inlineImages(container)
  const katexCss = (await import('virtual:katex-export-css')).default
  const html = assembleDocument(container.innerHTML, title, katexCss)

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await pickSaveHandle(suggestedName, {
        types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(html)
      await writable.close()
      return
    } catch (err) {
      if (isAbortError(err)) return
      // fall through to anchor download
    }
  }
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  anchor.download = suggestedName
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

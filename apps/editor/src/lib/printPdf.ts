/**
 * PDF export from the live preview.
 *
 * Desktop shell (Windows/WebView2): the snapshot is rendered straight to a
 * PDF file via the `export_pdf` command, so the user only picks a save path.
 *
 * Browsers (and non-Windows shells): window.print() + "Save as PDF", since
 * pages cannot choose a print destination themselves.
 *
 * The print snapshot is a detached clone of the live preview (Shiki spans,
 * Mermaid SVGs and KaTeX markup are already rendered), appended to the body
 * only while printing; @media print rules in styles.css hide the app and
 * show only #print-root. Printing is forced to the light palette: prose
 * colors are CSS variables, so #print-root overrides them; Shiki dual-theme
 * dark overrides use !important, so the inline light colors are re-applied
 * with priority (inline !important beats stylesheet !important).
 *
 * Known limitation: Mermaid diagrams render with the theme baked into the
 * SVG at decorate time, so printing from dark mode keeps dark diagram
 * colors (light text can look faint on paper).
 */

import { isTauri } from './fileProvider'
import { addBookmarks, collectBookmarks, PRINT_CONTENT_WIDTH } from './pdfOutline'

let printing = false

/** Resolve after the browser applied styles and laid out the next frame. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Re-apply the inline (light) Shiki colors with !important priority so
 * the dark-theme stylesheet overrides cannot darken the printout. */
export function forceLightShiki(root: ParentNode): void {
  for (const pre of root.querySelectorAll('pre.shiki')) {
    const el = pre as HTMLElement
    const color = el.style.getPropertyValue('color')
    if (color) el.style.setProperty('color', color, 'important')
    const bg = el.style.getPropertyValue('background-color')
    if (bg) el.style.setProperty('background-color', bg, 'important')
  }
  for (const span of root.querySelectorAll('pre.shiki span')) {
    const el = span as HTMLElement
    const color = el.style.getPropertyValue('color')
    if (color) el.style.setProperty('color', color, 'important')
  }
}

/** Build the hidden print container from the live preview DOM. */
export function buildPrintRoot(host: HTMLElement): HTMLElement {
  const root = document.createElement('div')
  root.id = 'print-root'
  root.className = 'prose'
  root.innerHTML = host.innerHTML
  forceLightShiki(root)
  return root
}

/** Desktop shell: render the print snapshot straight to a PDF file, with
 * only a save-path dialog (WebView2 PrintToPdf, no print dialog). */
async function exportPdfDesktop(host: HTMLElement, title: string): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { invoke } = await import('@tauri-apps/api/core')

  const path = await save({
    defaultPath: `${title}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!path) return
  const target = /\.pdf$/i.test(path) ? path : `${path}.pdf`

  const root = buildPrintRoot(host)
  // #print-root is display:none outside @media print, so lay it out
  // off-screen first: needed both to measure heading positions and to keep
  // the snapshot at the printable width the PDF will use.
  root.style.cssText =
    `display: block; position: fixed; top: 0; left: -20000px; ` +
    `width: ${PRINT_CONTENT_WIDTH};`
  document.body.appendChild(root)
  try {
    await nextPaint()
    const bookmarks = collectBookmarks(root)

    // back to the stylesheet rules: hidden until the print media applies
    root.removeAttribute('style')
    await nextPaint()

    await invoke('export_pdf', { path: target })

    // Skia/PDF has no outline support: inject the bookmark tree ourselves
    if (bookmarks.length) {
      const { readFile, writeFile } = await import('@tauri-apps/plugin-fs')
      const bytes = await readFile(target)
      await writeFile(target, await addBookmarks(bytes, bookmarks))
    }
  } finally {
    root.remove()
  }
}

/** Export the preview as PDF. The desktop shell saves the file directly;
 * browsers fall back to the print dialog, where "Save as PDF" is a
 * destination (pages cannot pick it programmatically). */
export async function printToPdf(host: HTMLElement, title: string): Promise<void> {
  if (printing) return
  printing = true

  if (isTauri()) {
    try {
      await exportPdfDesktop(host, title)
    } finally {
      printing = false
    }
    return
  }

  const previousTitle = document.title
  document.title = title
  const root = buildPrintRoot(host)
  document.body.appendChild(root)

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup)
    root.remove()
    document.title = previousTitle
    printing = false
  }
  // afterprint covers browsers/webviews that fire it; the timeout is the
  // safety net for the macOS tauri path (window.print() is overridden and
  // may not fire afterprint). window.print() blocks JS on Chromium-based
  // webviews, so the timer can never fire while the dialog is still open.
  window.addEventListener('afterprint', cleanup)
  window.print()
  window.setTimeout(() => {
    if (printing) cleanup()
  }, 10_000)
}

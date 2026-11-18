/**
 * PDF export via the webview's native print pipeline (window.print()).
 * Works everywhere with a single code path: WebView2 / WebKitGTK show a
 * print dialog with a "Save as PDF" destination, macOS tauri forwards
 * window.print() to the native print panel, and browsers behave natively.
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

let printing = false

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

/** Open the webview print dialog over a snapshot of the preview. The
 * document title doubles as the suggested file name in the dialog. */
export function printToPdf(host: HTMLElement, title: string): void {
  if (printing) return
  printing = true

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

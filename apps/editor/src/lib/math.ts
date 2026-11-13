/**
 * Lazy KaTeX rendering for `code.language-math` blocks produced by the
 * remarkMathToCode pipeline. The module is only fetched when the preview
 * actually contains math.
 */

let katexPromise: Promise<typeof import('katex')['default']> | null = null

function loadKatex() {
  katexPromise ??= import('katex').then((m) => m.default)
  return katexPromise
}

/** Render inline and display math with KaTeX, in place. */
export async function renderMathBlocks(root: ParentNode): Promise<void> {
  const blocks = Array.from(root.querySelectorAll('code.language-math')) as HTMLElement[]
  if (!blocks.length) return

  const katex = await loadKatex()

  for (const code of blocks) {
    if (code.dataset.math !== undefined) continue
    code.dataset.math = 'true'
    const isDisplay = code.parentElement?.tagName === 'PRE'
    // throwOnError: false renders invalid TeX as red source instead of throwing
    const html = katex.renderToString(code.textContent ?? '', {
      displayMode: isDisplay,
      throwOnError: false,
    })
    if (!code.isConnected) continue
    const holder = document.createElement(isDisplay ? 'div' : 'span')
    holder.innerHTML = html
    const target = isDisplay ? code.parentElement! : code
    target.replaceWith(...Array.from(holder.childNodes))
  }
}

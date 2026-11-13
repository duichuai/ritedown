type Mermaid = typeof import('mermaid').default

/**
 * Lazy-loaded Mermaid. The module itself is only fetched when the preview
 * actually contains a mermaid code block.
 */

let mermaidPromise: Promise<Mermaid> | null = null
let loadedTheme = ''

function prefersDark(): boolean {
  return matchMedia('(prefers-color-scheme: dark)').matches
}

function loadMermaid(): Promise<Mermaid> {
  const theme = prefersDark() ? 'dark' : 'default'
  if (mermaidPromise && loadedTheme === theme) return mermaidPromise
  loadedTheme = theme
  mermaidPromise = import('mermaid').then((m) => {
    m.default.initialize({ startOnLoad: false, theme, securityLevel: 'strict' })
    return m.default
  })
  return mermaidPromise
}

let counter = 0

/** Find ```mermaid fences in rendered HTML and replace them with SVG diagrams. */
export async function renderMermaidBlocks(root: ParentNode): Promise<void> {
  const blocks = Array.from(
    root.querySelectorAll('pre > code.language-mermaid'),
  ) as HTMLElement[]
  if (!blocks.length) return

  const mermaid = await loadMermaid()

  await Promise.all(
    blocks.map(async (code) => {
      const pre = code.parentElement
      if (!pre || pre.dataset.mermaid !== undefined) return
      pre.dataset.mermaid = 'true'
      try {
        const { svg } = await mermaid.render(
          `ritedown-mermaid-${++counter}`,
          code.textContent ?? '',
        )
        if (code.isConnected) pre.outerHTML = svg
      } catch (err) {
        pre.classList.add('mermaid-error')
        const message = document.createElement('code')
        message.textContent = err instanceof Error ? err.message : String(err)
        pre.replaceChildren(message)
      }
    }),
  )
}

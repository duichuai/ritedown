import type { HighlighterCore } from 'shiki/core'

/**
 * Lazy-initialized Shiki highlighter (JavaScript regex engine, no WASM).
 * Languages and themes are registered explicitly so each becomes its own
 * lazy chunk instead of shipping Shiki's full registry.
 */

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= import('shiki/core').then((m) =>
    m.createHighlighterCore({
      themes: [
        import('@shikijs/themes/github-light'),
        import('@shikijs/themes/github-dark'),
      ],
      langs: [
        import('@shikijs/langs/markdown'),
        import('@shikijs/langs/javascript'),
        import('@shikijs/langs/typescript'),
        import('@shikijs/langs/json'),
        import('@shikijs/langs/bash'),
        import('@shikijs/langs/yaml'),
        import('@shikijs/langs/html'),
        import('@shikijs/langs/css'),
      ],
      engine: import('shiki/engine/javascript').then((e) =>
        e.createJavaScriptRegexEngine({ forgiving: true }),
      ),
    }),
  )
  return highlighterPromise
}

const KNOWN_LANGS = [
  'markdown',
  'javascript',
  'typescript',
  'json',
  'bash',
  'yaml',
  'html',
  'css',
]

const LANG_ALIASES: Record<string, string> = {
  md: 'markdown',
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
}

/** Highlight a code string to Shiki HTML (dual theme), or null when the
 * language is unknown/unsupported — callers fall back to plain code. */
export async function highlightCodeToHtml(
  code: string,
  lang: string,
): Promise<string | null> {
  const known = LANG_ALIASES[lang] ?? lang
  if (!KNOWN_LANGS.includes(known)) return null
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(code, {
      lang: known,
      themes: { light: 'github-light', dark: 'github-dark' },
    })
  } catch {
    return null // highlighting must never break the editor
  }
}

/** Find fenced code blocks in rendered HTML and highlight them in place. */
export async function highlightCodeBlocks(root: ParentNode): Promise<void> {
  const blocks = Array.from(
    root.querySelectorAll('pre > code[class*="language-"]'),
  ) as HTMLElement[]
  if (!blocks.length) return

  const highlighter = await getHighlighter()

  await Promise.all(
    blocks.map(async (code) => {
      const pre = code.parentElement
      if (!pre || pre.dataset.shiki !== undefined) return
      const langClass = Array.from(code.classList).find((c) =>
        c.startsWith('language-'),
      )
      if (!langClass) return
      const lang = LANG_ALIASES[langClass.slice(9)] ?? langClass.slice(9)
      // 'mermaid' and unknown languages stay as plain code
      if (!['markdown', 'javascript', 'typescript', 'json', 'bash', 'yaml', 'html', 'css'].includes(lang)) {
        return
      }
      pre.dataset.shiki = 'true'
      try {
        const html = highlighter.codeToHtml(code.textContent ?? '', {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
        })
        if (code.isConnected) {
          const line = pre.getAttribute('data-md-line')
          const tmpl = document.createElement('template')
          tmpl.innerHTML = html
          const replacement = tmpl.content.firstElementChild as HTMLElement
          if (line) replacement.setAttribute('data-md-line', line)
          pre.replaceWith(replacement)
        }
      } catch {
        // highlighting must never break the preview
        delete pre.dataset.shiki
      }
    }),
  )
}

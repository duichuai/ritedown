/**
 * Remark plugin: rewrite remark-math nodes into code nodes so they flow
 * through the standard `pre > code.language-math` / `code.language-math`
 * rendering path and get decorated with KaTeX in the preview.
 */
export function remarkMathToCode() {
  return (tree: {
    children?: unknown[]
  }) => {
    const rewrite = (node: { children?: unknown[]; type: string; value?: string; lang?: string }) => {
      if (!Array.isArray(node.children)) return
      node.children = node.children.map((child) => {
        const c = child as { type: string; value?: string; lang?: string; children?: unknown[] }
        if (c.type === 'math') {
          return { type: 'code', lang: 'math', value: c.value }
        }
        if (c.type === 'inlineMath') {
          return {
            type: 'inlineCode',
            value: c.value,
            // inlineCode carries no lang; add the class via hast properties
            // so the preview decorator can find it
            data: { hProperties: { className: 'language-math' } },
          }
        }
        rewrite(c)
        return c
      })
    }
    rewrite(tree as never)
  }
}

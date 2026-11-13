import { visit } from 'unist-util-visit'
import type { Blockquote, Paragraph, Parents, Root } from 'mdast'

const VARIANTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const

export type GfmAlertVariant = (typeof VARIANTS)[number]

const markerRe = new RegExp(`^\\[!(${VARIANTS.join('|')})\\][ \\t]*(?:\\r?\\n|$)`)

/**
 * remark plugin: GitHub Flavored Markdown alerts.
 *
 * Transforms
 *
 *   > [!NOTE]
 *   > body
 *
 * into a `<div class="markdown-alert markdown-alert-note">` element.
 * remark-gfm does not (yet) ship alerts, so this is a first-party extension.
 */
export default function remarkGfmAlerts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node, index, parent) => {
      const quote = node as Blockquote & Parents
      const paragraph = quote.children[0] as Paragraph | undefined
      const first = paragraph?.children[0]
      if (paragraph == null || first == null || first.type !== 'text') return

      const match = first.value.match(markerRe)
      if (match == null) return

      first.value = first.value.slice(match[0].length)
      if (first.value.trim() === '') paragraph.children.shift()

      const rest = quote.children.slice(1)
      if (paragraph.children.length === 0 && rest.length > 0) rest.shift()

      const replacement = {
        type: 'gfmAlert',
        data: {
          hName: 'div',
          hProperties: {
            className: ['markdown-alert', `markdown-alert-${match[1].toLowerCase()}`],
          },
        },
        children: paragraph.children.length > 0 ? [paragraph, ...rest] : rest,
      }

      if (parent != null && typeof index === 'number') {
        ;(parent.children as unknown[])[index] = replacement
      }
    })
  }
}

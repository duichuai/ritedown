import { parse } from '@ritedown/core'
import type { PhrasingContent } from 'mdast'

export interface TocItem {
  depth: number
  text: string
  line: number
}

function textOf(node: PhrasingContent): string {
  if ('value' in node) return node.value
  if ('children' in node) return node.children.map(textOf).join('')
  return ''
}

/** Extract headings (h1-h6) with their source line for the outline. */
export function buildToc(markdown: string): TocItem[] {
  const tree = parse(markdown)
  const items: TocItem[] = []
  for (const node of tree.children) {
    if (node.type !== 'heading') continue
    const line = node.position?.start.line
    if (!line) continue
    const text = node.children.map(textOf).join('').trim()
    items.push({ depth: node.depth, text, line })
  }
  return items
}

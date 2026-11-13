import type { BlockContent, Parent } from 'mdast'
import { parse as parseYaml } from 'yaml'

/**
 * Front matter rendering. remark-frontmatter turns the `---` block into a
 * `yaml` node; this transformer rewrites it so remark-rehype renders a muted
 * key/value table at the top of the preview.
 */

function text(value: string) {
  return { type: 'text' as const, value }
}

function cell(tagName: 'th' | 'td', value: string) {
  return { type: 'element' as const, tagName, properties: {}, children: [text(value)] }
}

function yamlToTableChildren(value: string) {
  let data: Record<string, unknown>
  try {
    const parsed: unknown = parseYaml(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [text(value.trim())]
    }
    data = parsed as Record<string, unknown>
  } catch {
    // invalid yaml — show the raw text instead of failing the preview
    return [text(value.trim())]
  }

  const rows = Object.entries(data).map(([key, val]) => ({
    type: 'element' as const,
    tagName: 'tr',
    properties: {},
    children: [
      cell('th', key),
      cell('td', typeof val === 'string' ? val : JSON.stringify(val)),
    ],
  }))

  return [
    {
      type: 'element' as const,
      tagName: 'table',
      properties: {},
      children: rows,
    },
  ]
}

/** Decorate the first `yaml` node (if any) with frontmatter table data.
 * mdast-util-to-hast hard-ignores `yaml` nodes, so the node is retyped to
 * `ritedown-frontmatter` (unknown → unknown handler) which honors
 * `data.hName`/`data.hChildren`. */
export function remarkFrontmatterTable() {
  return (tree: Parent) => {
    const children = tree.children as unknown as Array<Record<string, unknown>>
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.type !== 'yaml') continue
      const value = String(child.value ?? '')
      children[i] = {
        type: 'ritedown-frontmatter',
        value,
        data: {
          hName: 'div',
          hProperties: { class: 'frontmatter' },
          hChildren: yamlToTableChildren(value),
        },
      }
      // only the leading front matter block is a document header
      break
    }
  }
}

export type FrontMatterParent = { children: BlockContent[] }

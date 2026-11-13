import type { Root } from 'mdast'

/**
 * Remark plugin: stamp source line numbers onto top-level block nodes via
 * `data.hProperties`, so the rendered HTML carries `data-md-line` attributes
 * used for editor <-> preview scroll sync.
 */

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'code',
  'blockquote',
  'list',
  'table',
  'thematicBreak',
])

export function remarkLineMarkers() {
  return (tree: Root) => {
    for (const node of tree.children) {
      const line = node.position?.start.line
      if (!line || !BLOCK_TYPES.has(node.type)) continue
      node.data = {
        ...(node.data ?? {}),
        hProperties: { 'data-md-line': String(line) },
      }
      // list items are visible block landmarks too
      if (node.type === 'list') {
        for (const item of node.children) {
          const itemLine = item.position?.start.line
          if (!itemLine) continue
          item.data = {
            ...(item.data ?? {}),
            hProperties: { 'data-md-line': String(itemLine) },
          }
        }
      }
    }
  }
}

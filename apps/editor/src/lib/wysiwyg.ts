/**
 * WYSIWYG phase 1: inline syntax markers (bold, italic, inline code) are
 * hidden while the cursor is outside the span, with the text styled to match
 * the rendered preview. Moving the cursor into the span reveals the source.
 * The document text is never modified — this is decoration only.
 */

import { syntaxTree } from '@codemirror/language'
import { RangeSet, type EditorState, type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { blockWysiwygExtension } from './wysiwygBlocks'

/** inline container nodes whose markers we hide, mapped to a style class */
const STYLE_CLASS: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-em',
  InlineCode: 'cm-md-code',
  Strikethrough: 'cm-md-strike',
}

const hideMark = Decoration.replace({})

function selectionOverlaps(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to > from && r.from < to)
}

/**
 * Build the decoration set for [from, to): hide the syntax marks of every
 * inline span the selection doesn't touch, and style the span's content.
 */
export function inlineFormatDecorations(
  state: EditorState,
  from = 0,
  to = state.doc.length,
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const className = STYLE_CLASS[node.name]
      if (!className) return
      // a touching selection (cursor on or inside the span) reveals the source
      if (selectionOverlaps(state, node.from, node.to)) return
      ranges.push(Decoration.mark({ class: className }).range(node.from, node.to))
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name.endsWith('Mark') && child.from < child.to) {
          ranges.push(hideMark.range(child.from, child.to))
        }
      }
    },
  })
  return RangeSet.of(ranges, true)
}

const inlineWysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = inlineFormatDecorations(
        view.state,
        view.viewport.from,
        view.viewport.to,
      )
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = inlineFormatDecorations(
          update.state,
          update.view.viewport.from,
          update.view.viewport.to,
        )
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/** inline-format WYSIWYG extensions: hidden markers + preview-like styling.
 * Also carries phase 2 (block-level) rendering behind the same toggle. */
export function wysiwygExtension(): Extension {
  return [
    inlineWysiwygPlugin,
    blockWysiwygExtension(),
    EditorView.baseTheme({
      '.cm-md-strong': { fontWeight: 'bold' },
      '.cm-md-em': { fontStyle: 'italic' },
      '.cm-md-code': {
        fontFamily: 'var(--cm-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        fontSize: '0.9em',
        backgroundColor: 'rgba(127, 127, 127, 0.12)',
        borderRadius: '3px',
      },
      '.cm-md-strike': { textDecoration: 'line-through' },
    }),
  ]
}

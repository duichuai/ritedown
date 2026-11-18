/**
 * Slash menu: typing `/` at the start of an empty line opens the markdown
 * insert list, Notion style. The menu is exposed as a CodeMirror completion
 * source so it reuses the built-in popup, filtering and keyboard handling.
 */

import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete'
import { t, type MessageKey } from './i18n'

interface SlashItem {
  name: string
  titleKey: MessageKey
  shortcut?: string
}

const ITEMS: SlashItem[] = [
  { name: 'h1', titleKey: 'fmtH1', shortcut: 'Ctrl+1' },
  { name: 'h2', titleKey: 'fmtH2', shortcut: 'Ctrl+2' },
  { name: 'h3', titleKey: 'fmtH3', shortcut: 'Ctrl+3' },
  { name: 'bullet', titleKey: 'fmtBullet', shortcut: 'Ctrl+Shift+[' },
  { name: 'ordered', titleKey: 'fmtOrdered', shortcut: 'Ctrl+Shift+]' },
  { name: 'task', titleKey: 'fmtTask', shortcut: 'Ctrl+Shift+L' },
  { name: 'quote', titleKey: 'fmtQuote', shortcut: 'Ctrl+Shift+Q' },
  { name: 'codeblock', titleKey: 'fmtCodeBlock', shortcut: 'Ctrl+Shift+K' },
  { name: 'table', titleKey: 'fmtTable', shortcut: 'Ctrl+Shift+T' },
  { name: 'link', titleKey: 'fmtLink', shortcut: 'Ctrl+K' },
  { name: 'image', titleKey: 'fmtImage', shortcut: 'Ctrl+Shift+I' },
  { name: 'formula', titleKey: 'fmtFormula', shortcut: 'Ctrl+Shift+M' },
  { name: 'divider', titleKey: 'fmtDivider', shortcut: 'Ctrl+Shift+H' },
]

/**
 * `run` executes the chosen command, so the caller keeps ownership of
 * side effects that need the DOM (the image picker).
 */
export function slashMenuSource(run: (name: string) => void): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\/[^\s/]*/)
    if (!match) return null
    // only at the start of a line's content, so the inserted block never
    // inherits a stray list or quote marker
    const line = context.state.doc.lineAt(match.from)
    if (context.state.sliceDoc(line.from, match.from).trim() !== '') return null

    const options: Completion[] = ITEMS.map((item) => ({
      label: `/${t(item.titleKey)}`,
      detail: item.shortcut,
      type: 'keyword',
      apply: (view, _completion, from, to) => {
        // drop the typed slash query first, then run the command at the caret
        view.dispatch({
          changes: { from, to, insert: '' },
          selection: { anchor: from },
        })
        run(item.name)
      },
    }))

    return { from: match.from, options, validFor: /^\/[^\s/]*$/ }
  }
}

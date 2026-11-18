<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { keymap } from '@codemirror/view'
import {
  Compartment,
  EditorState,
  Prec,
  type TransactionSpec,
} from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import MarkdownToolbar from './MarkdownToolbar.vue'
import {
  insertCodeBlock,
  insertDivider,
  insertFormula,
  insertImage,
  insertLink,
  insertTable,
  toggleHeading,
  toggleList,
  toggleQuote,
  toggleWrap,
} from '../lib/markdownCommands'
import { wysiwygExtension } from '../lib/wysiwyg'
import { slashMenuSource } from '../lib/slashMenu'

const props = defineProps<{ modelValue: string; wysiwyg?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-line': [line: number]
  'cursor-col': [column: number]
  'image-file': [file: File]
}>()

const host = ref<HTMLElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const activeFormats = ref<string[]>([])
let view: EditorView | null = null

const wysiwygCompartment = new Compartment()

/* ---------- formatting commands ---------- */

type Command = (state: EditorState) => TransactionSpec

const commands: Record<string, Command> = {
  bold: (state) => toggleWrap(state, '**'),
  italic: (state) => toggleWrap(state, '*'),
  strike: (state) => toggleWrap(state, '~~'),
  code: (state) => toggleWrap(state, '`'),
  h1: (state) => toggleHeading(state, 1),
  h2: (state) => toggleHeading(state, 2),
  h3: (state) => toggleHeading(state, 3),
  bullet: (state) => toggleList(state, 'bullet'),
  ordered: (state) => toggleList(state, 'ordered'),
  task: (state) => toggleList(state, 'task'),
  quote: toggleQuote,
  codeblock: (state) => insertCodeBlock(state),
  table: (state) => insertTable(state),
  link: insertLink,
  image: insertImage,
  formula: insertFormula,
  divider: insertDivider,
}

/** syntax node → toolbar button; a node inside a fenced block also lights
 * the code block button */
const FORMAT_NODES: Record<string, string> = {
  StrongEmphasis: 'bold',
  Emphasis: 'italic',
  Strikethrough: 'strike',
  InlineCode: 'code',
  Link: 'link',
  Image: 'image',
  ATXHeading1: 'h1',
  ATXHeading2: 'h2',
  ATXHeading3: 'h3',
  Blockquote: 'quote',
  BulletList: 'bullet',
  OrderedList: 'ordered',
  FencedCode: 'codeblock',
  Table: 'table',
}

function activeFormatsAt(state: EditorState): string[] {
  const found = new Set<string>()
  const pos = state.selection.main.head
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1)
  for (; node; node = node.parent) {
    const name = FORMAT_NODES[node.name]
    if (name) found.add(name)
  }
  return [...found]
}

function apply(name: string) {
  if (!view) return
  const command = commands[name]
  if (!command) return
  view.dispatch(command(view.state))
  view.focus()
}

function triggerImagePicker() {
  imageInput.value?.click()
}

function onToolbarCommand(name: string) {
  if (name === 'image') {
    triggerImagePicker()
    return
  }
  apply(name)
}

/** slash menu items share the toolbar commands; only the image needs a DOM
 * picker instead of a transaction */
function onSlashCommand(name: string) {
  if (name === 'image') triggerImagePicker()
  else apply(name)
}

// one stable source instance: CodeMirror matches completion sources by
// identity, so building a new function per language-data lookup would make
// the popup restart its query forever
const slashMenu = slashMenuSource(onSlashCommand)

/** keymap handlers get the focused view directly */
function key(name: string) {
  return (target: EditorView) => {
    const command = commands[name]
    if (!command) return false
    target.dispatch(command(target.state))
    return true
  }
}

const formattingKeymap = Prec.high(
  keymap.of([
    { key: 'Mod-b', run: key('bold') },
    { key: 'Mod-i', run: key('italic') },
    { key: 'Mod-Shift-x', run: key('strike') },
    { key: 'Mod-e', run: key('code') },
    { key: 'Mod-k', run: key('link') },
    { key: 'Mod-Shift-i', run: () => (triggerImagePicker(), true) },
    { key: 'Mod-1', run: key('h1') },
    { key: 'Mod-2', run: key('h2') },
    { key: 'Mod-3', run: key('h3') },
    { key: 'Mod-0', run: (target) => (target.dispatch(toggleHeading(target.state, 0)), true) },
    { key: 'Mod-Shift-q', run: key('quote') },
    { key: 'Mod-Shift-[', run: key('bullet') },
    { key: 'Mod-Shift-]', run: key('ordered') },
    { key: 'Mod-Shift-l', run: key('task') },
    { key: 'Mod-Shift-k', run: key('codeblock') },
    { key: 'Mod-Shift-t', run: key('table') },
    { key: 'Mod-Shift-m', run: key('formula') },
    { key: 'Mod-Shift-h', run: key('divider') },
  ]),
)

/* ---------- image paste / drop / picker ---------- */

function isImageFile(file: File | null | undefined): boolean {
  return !!file && file.type.startsWith('image/')
}

/** collect image files from a paste/drop transfer (ignore text items) */
function imageFilesFrom(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter(isImageFile)
}

function onPaste(e: ClipboardEvent) {
  const images = imageFilesFrom(e.clipboardData)
  if (!images.length) return
  // keep only the image out of the paste (a copied screenshot may also
  // carry HTML/text fragments we don't want)
  e.preventDefault()
  images.forEach((file) => emit('image-file', file))
}

function onDrop(e: DragEvent) {
  const images = imageFilesFrom(e.dataTransfer)
  if (!images.length) return
  e.preventDefault()
  e.stopPropagation() // the app-level drop handler opens .md files only
  images.forEach((file) => emit('image-file', file))
}

function onImagePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('image-file', file)
  // allow picking the same file again
  input.value = ''
}

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      // base: markdownLanguage = CommonMark + GFM (tables, task lists),
      // so block-level WYSIWYG sees Table/Task nodes in the syntax tree
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      formattingKeymap,
      // contributes a completion source to the built-in autocompletion that
      // basicSetup already installs, so `/` opens the slash menu
      EditorState.languageData.of(() => [{ autocomplete: slashMenu }]),
      wysiwygCompartment.of(props.wysiwyg ? wysiwygExtension() : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          emit('cursor-line', line.number)
          emit('cursor-col', head - line.from + 1)
          activeFormats.value = activeFormatsAt(update.state)
        }
      }),
    ],
    parent: host.value!,
  })
  view.dom.addEventListener('paste', onPaste)
  view.dom.addEventListener('drop', onDrop)
  activeFormats.value = activeFormatsAt(view.state)
})

// external doc changes (e.g. opening a file) replace the CM document
watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    }
  },
)

// toggle WYSIWYG at runtime without recreating the view
watch(
  () => props.wysiwyg,
  (enabled) => {
    view?.dispatch({
      effects: wysiwygCompartment.reconfigure(enabled ? wysiwygExtension() : []),
    })
  },
)

onBeforeUnmount(() => {
  view?.dom.removeEventListener('paste', onPaste)
  view?.dom.removeEventListener('drop', onDrop)
  view?.destroy()
})

/** jump to a source line (1-based): scroll it to the top of the viewport
 * (same recipe as scrollSync) and move the cursor there so the outline's
 * active state follows */
function scrollToLine(line: number) {
  if (!view) return
  const clamped = Math.min(Math.max(line, 1), view.state.doc.lines)
  const docLine = view.state.doc.line(clamped)
  view.scrollDOM.scrollTop = view.lineBlockAt(docLine.from).top
  view.dispatch({ selection: { anchor: docLine.from } })
}

defineExpose({
  /** the CodeMirror view, for scroll sync and programmatic access */
  get view(): EditorView | null {
    return view
  },
  scrollToLine,
  /** insert text at the cursor (images, snippets) and focus the editor */
  insertText(text: string) {
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
    view.focus()
  },
})
</script>

<template>
  <section class="pane editor-pane">
    <MarkdownToolbar :active="activeFormats" @command="onToolbarCommand" />
    <div class="cm-host" ref="host"></div>
    <input
      ref="imageInput"
      class="image-input"
      type="file"
      accept="image/*"
      @change="onImagePick"
    />
  </section>
</template>

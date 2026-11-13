<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-line': [line: number]
  'cursor-col': [column: number]
  'image-file': [file: File]
}>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

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

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          emit('cursor-line', line.number)
          emit('cursor-col', head - line.from + 1)
        }
      }),
    ],
    parent: host.value!,
  })
  view.dom.addEventListener('paste', onPaste)
  view.dom.addEventListener('drop', onDrop)
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
  <section class="pane editor-pane" ref="host"></section>
</template>

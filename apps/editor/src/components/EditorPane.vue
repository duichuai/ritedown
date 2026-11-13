<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-line': [line: number]
  'cursor-col': [column: number]
}>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

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

onBeforeUnmount(() => view?.destroy())

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
})
</script>

<template>
  <section class="pane editor-pane" ref="host"></section>
</template>

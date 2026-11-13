<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { builtin, render } from '@ritedown/core'
import remarkMath from 'remark-math'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import { DEFAULT_DOC } from './defaultDoc'
import { remarkMathToCode } from './lib/mathPlugin'
import { remarkLineMarkers } from './lib/lineMarkers'
import { syncEditorToPreview, syncPreviewToEditor } from './lib/scrollSync'

const markdown = ref(DEFAULT_DOC)

const html = computed(() =>
  render(markdown.value, {
    extensions: [builtin.gfm, remarkMath, remarkMathToCode, remarkLineMarkers],
  }),
)

const editorPane = ref<InstanceType<typeof EditorPane> | null>(null)
const previewPane = ref<InstanceType<typeof PreviewPane> | null>(null)

// bidirectional scroll sync with a short-lived lock to avoid feedback loops
let lock: 'editor' | 'preview' | null = null
let unlockTimer: ReturnType<typeof setTimeout> | undefined
let raf = 0

function acquire(side: 'editor' | 'preview') {
  if (lock !== side) return false
  clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => (lock = null), 120)
  return true
}

function schedule(side: 'editor' | 'preview') {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const view = editorPane.value?.view
    const host = previewPane.value?.host
    if (!view || !host) return
    if (side === 'editor') syncEditorToPreview(view, host)
    else syncPreviewToEditor(view, host)
  })
}

function onEditorScroll() {
  if (acquire('preview')) return
  lock = 'editor'
  schedule('editor')
}

function onPreviewScroll() {
  if (acquire('editor')) return
  lock = 'preview'
  schedule('preview')
}

onMounted(() => {
  const view = editorPane.value?.view
  const host = previewPane.value?.host
  if (!view || !host) return
  view.scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true })
  host.addEventListener('scroll', onPreviewScroll, { passive: true })
})

onBeforeUnmount(() => {
  const view = editorPane.value?.view
  const host = previewPane.value?.host
  view?.scrollDOM.removeEventListener('scroll', onEditorScroll)
  host?.removeEventListener('scroll', onPreviewScroll)
  clearTimeout(unlockTimer)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="app">
    <header class="titlebar">Ritedown</header>
    <main class="split">
      <EditorPane ref="editorPane" v-model="markdown" />
      <PreviewPane ref="previewPane" :html="html" />
    </main>
  </div>
</template>

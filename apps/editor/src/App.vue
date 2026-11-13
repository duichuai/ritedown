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
import {
  isAbortError,
  isFsAccessSupported,
  openMarkdownFile,
  pickSaveHandle,
  saveToHandle,
} from './lib/fsAccess'

const markdown = ref(DEFAULT_DOC)

const html = computed(() =>
  render(markdown.value, {
    extensions: [builtin.gfm, remarkMath, remarkMathToCode, remarkLineMarkers],
  }),
)

const fsSupported = isFsAccessSupported()
const fileName = ref<string | null>(null)
const fileHandle = ref<FileSystemFileHandle | null>(null)
const savedContent = ref(DEFAULT_DOC)
const dirty = computed(() => markdown.value !== savedContent.value)

async function onOpen() {
  try {
    const file = await openMarkdownFile()
    markdown.value = file.text
    savedContent.value = file.text
    fileName.value = file.name
    fileHandle.value = file.handle
  } catch (err) {
    if (!isAbortError(err)) console.warn('open failed:', err)
  }
}

async function onSave() {
  try {
    if (!fileHandle.value) {
      fileHandle.value = await pickSaveHandle(fileName.value ?? '未命名.md')
    }
    await saveToHandle(fileHandle.value, markdown.value)
    savedContent.value = markdown.value
    const file = await fileHandle.value.getFile()
    fileName.value = file.name
  } catch (err) {
    if (!isAbortError(err)) console.warn('save failed:', err)
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void onSave()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))

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
    <header class="titlebar">
      <span class="brand">Ritedown</span>
      <span v-if="fileName" class="filename">{{ fileName }}</span>
      <span v-if="dirty" class="dirty-dot" title="有未保存的更改">●</span>
      <div v-if="fsSupported" class="titlebar-actions">
        <button class="tb-btn" @click="onOpen">打开</button>
        <button class="tb-btn" @click="onSave">保存</button>
      </div>
    </header>
    <main class="split">
      <EditorPane ref="editorPane" v-model="markdown" />
      <PreviewPane ref="previewPane" :html="html" />
    </main>
  </div>
</template>

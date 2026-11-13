<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { builtin, render } from '@ritedown/core'
import remarkGemoji from 'remark-gemoji'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMath from 'remark-math'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import { DEFAULT_DOC } from './defaultDoc'
import { remarkFrontmatterTable } from './lib/frontmatter'
import { remarkMathToCode } from './lib/mathPlugin'
import { remarkLineMarkers } from './lib/lineMarkers'
import { exportHtml } from './lib/exportHtml'
import { syncEditorToPreview, syncPreviewToEditor } from './lib/scrollSync'
import { buildToc } from './lib/toc'
import { wordCount } from './lib/wordCount'
import { locale, t, toggleLocale } from './lib/i18n'
import { cycleTheme, themePref } from './lib/theme'
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
    extensions: [
      builtin.gfm,
      remarkGemoji,
      remarkMath,
      remarkMathToCode,
      remarkLineMarkers,
      [remarkFrontmatter, ['yaml']],
      remarkFrontmatterTable,
    ],
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
    applyOpenedFile(file.name, file.text, file.handle)
  } catch (err) {
    if (!isAbortError(err)) console.warn('open failed:', err)
  }
}

function applyOpenedFile(
  name: string,
  text: string,
  handle: FileSystemFileHandle | null,
) {
  markdown.value = text
  savedContent.value = text
  fileName.value = name
  fileHandle.value = handle
}

async function onSave() {
  try {
    if (!fileHandle.value) {
      fileHandle.value = await pickSaveHandle(fileName.value ?? t('untitled'))
    }
    await saveToHandle(fileHandle.value, markdown.value)
    savedContent.value = markdown.value
    const file = await fileHandle.value.getFile()
    fileName.value = file.name
  } catch (err) {
    if (!isAbortError(err)) console.warn('save failed:', err)
  }
}

async function onSaveAs() {
  try {
    const handle = await pickSaveHandle(fileName.value ?? t('untitled'))
    await saveToHandle(handle, markdown.value)
    fileHandle.value = handle
    savedContent.value = markdown.value
    const file = await handle.getFile()
    fileName.value = file.name
  } catch (err) {
    if (!isAbortError(err)) console.warn('save as failed:', err)
  }
}

// drag & drop open
type DataTransferItemWithHandle = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemFileHandle | null>
}

const dragging = ref(false)
let dragDepth = 0

function isMarkdownName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name)
}

async function openDroppedFile(handle: FileSystemFileHandle, file: File) {
  const text = await file.text()
  applyOpenedFile(handle.name, text, handle)
}

async function onDrop(e: DragEvent) {
  dragDepth = 0
  dragging.value = false
  // Chromium: dropped files can yield a real file handle for later saves
  const items = e.dataTransfer?.items
  if (items) {
    for (const item of items) {
      if (item.kind !== 'file') continue
      const withHandle = item as DataTransferItemWithHandle
      if (withHandle.getAsFileSystemHandle) {
        const handle = await withHandle.getAsFileSystemHandle()
        if (handle && 'getFile' in handle && isMarkdownName(handle.name)) {
          try {
            await openDroppedFile(handle, await handle.getFile())
            return
          } catch (err) {
            console.warn('drop open failed:', err)
          }
        }
      }
    }
  }
  // fallback: plain File API (Firefox/Safari, no handle -> saves via Save As)
  const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
    isMarkdownName(f.name),
  )
  if (!file) return
  try {
    const text = await file.text()
    applyOpenedFile(file.name, text, null)
  } catch (err) {
    console.warn('drop open failed:', err)
  }
}

async function onExportHtml() {
  try {
    const host = previewPane.value?.host
    if (!host) return
    const base = (fileName.value ?? t('untitled')).replace(
      /\.(md|markdown)$/i,
      '',
    )
    await exportHtml(host, base, `${base}.html`)
  } catch (err) {
    if (!isAbortError(err)) console.warn('export failed:', err)
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

const themeLabel = computed(() =>
  themePref.value === 'auto'
    ? t('themeAuto')
    : themePref.value === 'light'
      ? t('themeLight')
      : t('themeDark'),
)

// outline (TOC)
const tocVisible = ref(true)
const cursorLine = ref(1)
const cursorCol = ref(1)
const tocItems = computed(() => buildToc(markdown.value))
const stats = computed(() => ({
  ...wordCount(markdown.value),
  lines: markdown.value.split('\n').length,
}))
const activeTocLine = computed(() => {
  let line = 0
  for (const item of tocItems.value) {
    if (item.line <= cursorLine.value) line = item.line
    else break
  }
  return line
})

function onTocClick(item: { line: number }) {
  editorPane.value?.scrollToLine(item.line)
}

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
  <div
    class="app"
    @dragenter.prevent="dragDepth++; dragging = true"
    @dragover.prevent
    @dragleave="dragDepth = Math.max(0, dragDepth - 1); dragging = dragDepth > 0"
    @drop.prevent="onDrop"
  >
    <div v-if="dragging" class="drop-overlay">{{ t('dropToOpen') }}</div>
    <header class="titlebar">
      <span class="brand">Ritedown</span>
      <span v-if="fileName" class="filename">{{ fileName }}</span>
      <span v-if="dirty" class="dirty-dot" :title="t('dirty')">●</span>
      <div class="titlebar-actions">
        <button class="tb-btn" @click="tocVisible = !tocVisible">{{ t('outline') }}</button>
        <template v-if="fsSupported">
          <button class="tb-btn" @click="onOpen">{{ t('open') }}</button>
          <button class="tb-btn" @click="onSave">{{ t('save') }}</button>
          <button class="tb-btn" @click="onSaveAs">{{ t('saveAs') }}</button>
        </template>
        <button class="tb-btn" @click="onExportHtml">{{ t('export') }}</button>
        <button class="tb-btn" :title="t('theme')" @click="cycleTheme">
          {{ themeLabel }}
        </button>
        <button class="tb-btn tb-lang" :title="t('switchLang')" @click="toggleLocale">
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </header>
    <main class="split" :class="{ 'with-toc': tocVisible }">
      <aside v-if="tocVisible" class="toc">
        <p v-if="!tocItems.length" class="toc-empty">{{ t('tocEmpty') }}</p>
        <ul v-else class="toc-list">
          <li
            v-for="(item, i) in tocItems"
            :key="i"
            :class="[
              'toc-item',
              `toc-depth-${item.depth}`,
              { 'toc-active': item.line === activeTocLine },
            ]"
            :title="item.text"
            @click="onTocClick(item)"
          >
            {{ item.text }}
          </li>
        </ul>
      </aside>
      <EditorPane
        ref="editorPane"
        v-model="markdown"
        @cursor-line="cursorLine = $event"
        @cursor-col="cursorCol = $event"
      />
      <PreviewPane ref="previewPane" :html="html" :file-handle="fileHandle" />
    </main>
    <footer class="statusbar">
      <span>{{ t('words') }} {{ stats.words }}</span>
      <span>{{ t('characters') }} {{ stats.characters }}</span>
      <span>{{ t('lines') }} {{ stats.lines }}</span>
      <span class="statusbar-cursor">{{ t('line') }} {{ cursorLine }} {{ t('col') }} {{ cursorCol }}</span>
    </footer>
  </div>
</template>

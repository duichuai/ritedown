<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { builtin, render } from '@ritedown/core'
import remarkGemoji from 'remark-gemoji'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMath from 'remark-math'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import FileTree from './components/FileTree.vue'
import { DEFAULT_DOC } from './defaultDoc'
import { remarkFrontmatterTable } from './lib/frontmatter'
import { remarkMathToCode } from './lib/mathPlugin'
import { remarkLineMarkers } from './lib/lineMarkers'
import { exportHtml, blobToDataUrl } from './lib/exportHtml'
import { imageAssetPath, imageMarkdown } from './lib/imageInsert'
import {
  hasBaseDir,
  pickBaseDir,
  setBaseDir,
  writeImageToBaseDir,
} from './lib/relImages'
import { syncEditorToPreview, syncPreviewToEditor } from './lib/scrollSync'
import { buildToc } from './lib/toc'
import { wordCount } from './lib/wordCount'
import { locale, t, toggleLocale } from './lib/i18n'
import { cycleTheme, themePref } from './lib/theme'
import { provider } from './lib/provider'
import { toFileRef } from './lib/providerWeb'
import type { DirRef, FileRef } from './lib/fileProvider'
import {
  findTabByHandle,
  makeTab,
  neighborTabId,
  type EditorTab,
} from './lib/tabs'
import {
  searchWorkspace,
  type FileHits,
  type SearchHit,
} from './lib/search'

// multi-tab documents (lib/tabs): the editor binds to the active tab,
// tab switches replace the CodeMirror document wholesale
const tabs = ref<EditorTab[]>([makeTab({ name: t('untitled'), text: DEFAULT_DOC })])
const activeId = ref(tabs.value[0].id)
const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeId.value) ?? null,
)
const markdown = computed({
  get: () => activeTab.value?.text ?? '',
  set: (value: string) => {
    if (activeTab.value) activeTab.value.text = value
  },
})

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

const fsSupported = provider.fsSupported
const fileName = computed(() => activeTab.value?.name ?? null)
const fileHandle = computed(() => activeTab.value?.handle ?? null)
const dirty = computed(() => tabs.value.some((tab) => tab.text !== tab.saved))

async function onOpen() {
  try {
    const doc = await provider.openFile()
    if (doc) openTab(doc.name, doc.text, doc.file, null)
  } catch (err) {
    console.warn('open failed:', err)
  }
}

/** open a document in a tab (or refresh & focus its existing tab) */
function openTab(
  name: string,
  text: string,
  handle: FileRef | null,
  parentDir: DirRef | null,
) {
  if (handle) {
    const existing = findTabByHandle(tabs.value, handle)
    if (existing) {
      existing.text = text
      existing.saved = text
      activeId.value = existing.id
      return
    }
  }
  const tab = makeTab({ name, text, handle, parentDir })
  tabs.value.push(tab)
  activeId.value = tab.id
}

function closeTab(id: number) {
  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index === -1) return
  const tab = tabs.value[index]
  if (tab.text !== tab.saved && !window.confirm(t('confirmClose'))) return
  const wasActive = id === activeId.value
  const neighbor = neighborTabId(tabs.value, index)
  tabs.value.splice(index, 1)
  if (wasActive) {
    if (neighbor !== null) {
      activeId.value = neighbor
    } else {
      const fresh = makeTab({ name: t('untitled'), text: DEFAULT_DOC })
      tabs.value.push(fresh)
      activeId.value = fresh.id
    }
  }
}

async function onSave() {
  const tab = activeTab.value
  if (!tab) return
  try {
    const saved = await provider.saveFile(tab.name, tab.text, tab.handle)
    if (!saved) return
    tab.handle = saved.file
    tab.saved = tab.text
    tab.name = saved.name
  } catch (err) {
    console.warn('save failed:', err)
  }
}

async function onSaveAs() {
  const tab = activeTab.value
  if (!tab) return
  try {
    const saved = await provider.saveFile(tab.name, tab.text)
    if (!saved) return
    tab.handle = saved.file
    tab.saved = tab.text
    tab.name = saved.name
  } catch (err) {
    console.warn('save as failed:', err)
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
  openTab(handle.name, text, toFileRef(handle), null)
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
    openTab(file.name, text, null, null)
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
    console.warn('export failed:', err)
  }
}

async function onImageFile(file: File) {
  const path = imageAssetPath(file.name)
  const md = imageMarkdown(file.name, path)
  const writeAndInsert = async (): Promise<boolean> => {
    try {
      await writeImageToBaseDir(path, file)
      editorPane.value?.insertText(md)
      return true
    } catch (err) {
      console.warn('image write failed:', err)
      return true // already have a folder; don't fall back silently
    }
  }
  if (hasBaseDir()) {
    await writeAndInsert()
    return
  }
  if (provider.fsSupported) {
    const dir = await pickBaseDir(fileHandle.value)
    if (dir && (await writeAndInsert())) return
    if (dir) return
    // user cancelled the picker — fall through to the embedded fallback
  }
  // no File System Access API: embed the image so the preview still shows it
  const dataUrl = await blobToDataUrl(file)
  editorPane.value?.insertText(imageMarkdown(file.name, dataUrl))
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void onSave()
  }
}

// folder workspace: pick a directory once, browse it in the file tree;
// the workspace is persisted by the provider (web: IndexedDB, desktop: path)
const workspaceSupported = provider.workspaceSupported
const workspace = ref<DirRef | null>(null)
const pendingRestore = ref<DirRef | null>(null)

async function onPickWorkspace() {
  const dir = await provider.pickWorkspace()
  if (dir) {
    workspace.value = dir
    pendingRestore.value = null
  }
}

onMounted(async () => {
  const restored = await provider.restoreWorkspace()
  if (!restored) return
  if ('dir' in restored) workspace.value = restored.dir
  else pendingRestore.value = restored.needsPermission
})

async function restoreWorkspace() {
  const dir = pendingRestore.value
  if (!dir) return
  pendingRestore.value = null
  const granted = await provider.grantWorkspace(dir)
  if (granted) workspace.value = granted
}

async function onOpenWorkspaceFile(payload: {
  handle: FileRef
  parentDir: DirRef
}) {
  try {
    const { name, text } = await provider.readDoc(payload.handle)
    openTab(name, text, payload.handle, payload.parentDir)
    // relative images resolve against the document's own folder
    setBaseDir(payload.parentDir)
  } catch (err) {
    console.warn('open workspace file failed:', err)
  }
}

// workspace global search: debounced traversal, results stream in per file
const searchQuery = ref('')
const searchCase = ref(false)
const searchRegex = ref(false)
const searchResults = ref<FileHits[] | null>(null)
const searching = ref(false)
let searchToken = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function runSearch() {
  const dir = workspace.value
  const query = searchQuery.value.trim()
  clearTimeout(searchTimer)
  if (!dir || !query) {
    searchToken++ // cancel any running search
    searchResults.value = null
    searching.value = false
    return
  }
  const token = ++searchToken
  searching.value = true
  searchResults.value = []
  const options = {
    caseSensitive: searchCase.value,
    useRegex: searchRegex.value,
  }
  await searchWorkspace(
    dir,
    query,
    options,
    (file) => {
      if (token === searchToken) searchResults.value!.push(file)
    },
    { get stopped() { return token !== searchToken } },
  )
  if (token === searchToken) searching.value = false
}

watch(searchQuery, () => {
  clearTimeout(searchTimer)
  if (!searchQuery.value.trim()) {
    searchToken++
    searchResults.value = null
    searching.value = false
    return
  }
  searchTimer = setTimeout(runSearch, 300)
})

watch(workspace, () => {
  searchToken++
  searchQuery.value = ''
  searchResults.value = null
  searching.value = false
})

function toggleSearchOption(option: 'case' | 'regex') {
  if (option === 'case') searchCase.value = !searchCase.value
  else searchRegex.value = !searchRegex.value
  void runSearch()
}

async function onOpenSearchHit(file: FileHits, hit: SearchHit) {
  try {
    const { name, text } = await provider.readDoc(file.file)
    openTab(name, text, file.file, file.parentDir)
    setBaseDir(file.parentDir)
    await nextTick()
    editorPane.value?.scrollToLine(hit.line)
  } catch (err) {
    console.warn('open search hit failed:', err)
  }
}

// WYSIWYG preference (default on; markers hidden outside the cursor span)
const WYSIWYG_KEY = 'ritedown-wysiwyg'
const wysiwyg = ref(loadWysiwygPref())

function loadWysiwygPref(): boolean {
  try {
    const saved = localStorage.getItem(WYSIWYG_KEY)
    if (saved !== null) return saved === '1'
  } catch {
    // no localStorage (SSR / tests)
  }
  return true
}

function toggleWysiwyg(): void {
  wysiwyg.value = !wysiwyg.value
  try {
    localStorage.setItem(WYSIWYG_KEY, wysiwyg.value ? '1' : '0')
  } catch {
    // no localStorage
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

// remember the cursor position per tab; restored when switching tabs
function onCursorLine(line: number) {
  cursorLine.value = line
  if (activeTab.value) activeTab.value.cursorLine = line
}

watch(activeId, async (id) => {
  await nextTick()
  const tab = tabs.value.find((tb) => tb.id === id)
  if (tab) editorPane.value?.scrollToLine(tab.cursorLine)
})

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
        <button
          class="tb-btn"
          :class="{ 'tb-active': wysiwyg }"
          :title="t('wysiwyg')"
          @click="toggleWysiwyg"
        >
          {{ t('wysiwyg') }}
        </button>
        <button class="tb-btn" :title="t('theme')" @click="cycleTheme">
          {{ themeLabel }}
        </button>
        <button class="tb-btn tb-lang" :title="t('switchLang')" @click="toggleLocale">
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </header>
    <div class="tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === activeId }"
        :title="tab.name"
        @click="activeId = tab.id"
      >
        <span class="tab-name">{{ tab.name }}</span>
        <span v-if="tab.text !== tab.saved" class="tab-dirty">●</span>
        <button class="tab-close" :aria-label="t('close')" @click.stop="closeTab(tab.id)">
          ×
        </button>
      </div>
    </div>
    <main class="split" :class="{ 'with-toc': tocVisible }">
      <aside v-if="tocVisible" class="sidebar">
        <div class="panel">
          <div class="panel-header">{{ t('workspace') }}</div>
          <template v-if="workspace">
            <div class="search-row">
              <input
                v-model="searchQuery"
                class="search-input"
                :placeholder="t('searchPlaceholder')"
                @keydown.esc="searchQuery = ''"
              />
              <button
                class="search-opt"
                :class="{ on: searchCase }"
                title="Aa"
                @click="toggleSearchOption('case')"
              >
                Aa
              </button>
              <button
                class="search-opt"
                :class="{ on: searchRegex }"
                title=".*"
                @click="toggleSearchOption('regex')"
              >
                .*
              </button>
            </div>
            <div v-if="searchResults !== null" class="search-results">
              <p v-if="!searchResults.length" class="panel-hint search-hint">
                {{ searching ? t('searching') : t('noResults') }}
              </p>
              <div v-for="file in searchResults" :key="file.path" class="sr-file">
                <div class="sr-path">{{ file.path }}</div>
                <button
                  v-for="(hit, hi) in file.hits"
                  :key="hi"
                  class="sr-hit"
                  :title="hit.lineText"
                  @click="onOpenSearchHit(file, hit)"
                >
                  <span class="sr-line">{{ hit.line }}</span>
                  <span class="sr-text"
                    >{{ hit.lineText.slice(0, hit.column - 1) }}<mark>{{
                      hit.lineText.slice(hit.column - 1, hit.column - 1 + hit.length)
                    }}</mark
                    >{{ hit.lineText.slice(hit.column - 1 + hit.length) }}</span
                  >
                </button>
              </div>
            </div>
            <FileTree v-else :root="workspace" @open-file="onOpenWorkspaceFile" />
          </template>
          <div v-else-if="pendingRestore" class="panel-empty">
            <span>{{ t('restoreWorkspace') }}</span>
            <button class="tb-btn" @click="restoreWorkspace">{{ t('open') }}</button>
          </div>
          <div v-else class="panel-empty">
            <button v-if="workspaceSupported" class="tb-btn" @click="onPickWorkspace">
              {{ t('openFolder') }}
            </button>
            <span v-else class="panel-hint">{{ t('workspaceUnsupported') }}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">{{ t('outline') }}</div>
          <div class="toc">
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
          </div>
        </div>
      </aside>
      <EditorPane
        ref="editorPane"
        v-model="markdown"
        :wysiwyg="wysiwyg"
        @cursor-line="onCursorLine"
        @cursor-col="cursorCol = $event"
        @image-file="onImageFile"
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

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { highlightCodeBlocks } from '../lib/highlight'
import { renderMermaidBlocks } from '../lib/mermaid'
import { renderMathBlocks } from '../lib/math'
import { resolvedTheme } from '../lib/theme'
import {
  hasBaseDir,
  hasUnresolvedRelativeImages,
  pickBaseDir,
  resolveRelativeImages,
} from '../lib/relImages'
import { isFsAccessSupported } from '../lib/fsAccess'
import { t } from '../lib/i18n'

const props = defineProps<{
  html: string
  fileHandle: FileSystemFileHandle | null
}>()

const host = ref<HTMLElement | null>(null)
const relImagesPending = ref(false)

async function decorate() {
  const root = host.value
  if (!root) return
  await Promise.all([
    highlightCodeBlocks(root),
    renderMermaidBlocks(root),
    renderMathBlocks(root),
  ])
  await resolveRelativeImages(root)
  // offer the folder picker only when relative images exist and no folder
  // has been picked yet; once picked, missing files stay silent
  relImagesPending.value =
    isFsAccessSupported() && !hasBaseDir() && hasUnresolvedRelativeImages(root)
}

async function onPickImageDir() {
  const dir = await pickBaseDir(props.fileHandle ?? undefined)
  if (!dir) return
  const root = host.value
  if (!root) return
  await resolveRelativeImages(root)
  relImagesPending.value = false
}

// re-render after the v-html DOM update
watch(() => props.html, decorate, { flush: 'post' })

// re-render when the effective theme changes (mermaid theme is baked into
// the SVG; shiki handles dark mode via CSS). resolvedTheme covers both the
// manual light/dark toggle and 'auto' following the system scheme.
watch(resolvedTheme, () => {
  const root = host.value
  if (!root) return
  root.innerHTML = props.html
  void decorate()
})

onMounted(decorate)

defineExpose({
  /** the scrollable preview element, for scroll sync */
  get host(): HTMLElement | null {
    return host.value
  },
})
</script>

<template>
  <div class="preview-wrap">
    <section class="pane preview-pane prose" ref="host" v-html="html"></section>
    <button
      v-if="relImagesPending && isFsAccessSupported()"
      class="img-dir-hint"
      :title="t('pickImageDir')"
      @click="onPickImageDir"
    >
      {{ t('pickImageDir') }}
    </button>
  </div>
</template>

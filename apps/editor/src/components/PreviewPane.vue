<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { highlightCodeBlocks } from '../lib/highlight'
import { renderMermaidBlocks } from '../lib/mermaid'
import { renderMathBlocks } from '../lib/math'
import { resolvedTheme } from '../lib/theme'

const props = defineProps<{ html: string }>()

const host = ref<HTMLElement | null>(null)

async function decorate() {
  const root = host.value
  if (!root) return
  await Promise.all([
    highlightCodeBlocks(root),
    renderMermaidBlocks(root),
    renderMathBlocks(root),
  ])
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
  <section class="pane preview-pane prose" ref="host" v-html="html"></section>
</template>

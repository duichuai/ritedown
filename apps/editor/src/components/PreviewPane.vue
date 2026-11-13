<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { highlightCodeBlocks } from '../lib/highlight'
import { renderMermaidBlocks } from '../lib/mermaid'
import { renderMathBlocks } from '../lib/math'

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

// re-run mermaid (theme is baked into the SVG); shiki handles dark mode via CSS
const schemeTick = ref(0)
const scheme = matchMedia('(prefers-color-scheme: dark)')
const onSchemeChange = () => schemeTick.value++
scheme.addEventListener('change', onSchemeChange)
watch(schemeTick, () => {
  const root = host.value
  if (!root) return
  root.innerHTML = props.html
  void decorate()
})
onBeforeUnmount(() => scheme.removeEventListener('change', onSchemeChange))

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

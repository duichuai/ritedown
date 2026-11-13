<script setup lang="ts">
import { computed, ref } from 'vue'
import { builtin, render } from '@ritedown/core'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import { DEFAULT_DOC } from './defaultDoc'

const markdown = ref(DEFAULT_DOC)

const html = computed(() =>
  render(markdown.value, { extensions: [builtin.gfm] }),
)
</script>

<template>
  <div class="app">
    <header class="titlebar">Ritedown</header>
    <main class="split">
      <EditorPane v-model="markdown" />
      <PreviewPane :html="html" />
    </main>
  </div>
</template>

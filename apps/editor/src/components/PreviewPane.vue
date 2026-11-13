<script setup lang="ts">
defineProps<{ html: string }>()
</script>

<template>
  <section class="pane preview-pane prose" v-html="html"></section>
</template>

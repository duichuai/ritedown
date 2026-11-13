<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { provider } from '../lib/provider'
import type { DirRef, FileRef, WorkspaceEntry } from '../lib/fileProvider'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps<{
  root: DirRef | null
}>()

const emit = defineEmits<{
  'open-file': [payload: { handle: FileRef; parentDir: DirRef }]
}>()

const entries = ref<WorkspaceEntry[] | null>(null)

async function loadRoot() {
  entries.value = null
  if (props.root) entries.value = await provider.listDir(props.root)
}

onMounted(loadRoot)
watch(() => props.root, loadRoot)
</script>

<template>
  <div class="filetree">
    <template v-if="entries">
      <FileTreeNode
        v-for="entry in entries"
        :key="entry.name"
        :entry="entry"
        :depth="0"
        :parent-dir="root!"
        @open-file="emit('open-file', $event)"
      />
      <p v-if="!entries.length" class="ft-empty">—</p>
    </template>
  </div>
</template>

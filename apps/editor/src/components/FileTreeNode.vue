<script setup lang="ts">
import { computed, ref } from 'vue'
import { listDir, type WorkspaceEntry } from '../lib/workspace'

const props = defineProps<{
  entry: WorkspaceEntry
  depth: number
  /** the directory containing this entry, for relative-image resolution */
  parentDir: FileSystemDirectoryHandle
}>()

const emit = defineEmits<{
  'open-file': [payload: { handle: FileSystemFileHandle; parentDir: FileSystemDirectoryHandle }]
}>()

const expanded = ref(false)
const children = ref<WorkspaceEntry[] | null>(null)
const fileHandle = computed(() =>
  props.entry.kind === 'file' ? props.entry.handle : null,
)
const isMarkdown = computed(() =>
  !!fileHandle.value && /\.(md|markdown)$/i.test(props.entry.name),
)

async function toggle() {
  if (props.entry.kind !== 'directory') return
  expanded.value = !expanded.value
  if (expanded.value && children.value === null) {
    children.value = await listDir(props.entry.handle)
  }
}
</script>

<template>
  <div class="ft-node">
    <!-- directory -->
    <div
      v-if="entry.kind === 'directory'"
      class="ft-row"
      :style="{ paddingLeft: `${depth * 14 + 8}px` }"
      @click="toggle"
    >
      <span class="ft-caret" :class="{ open: expanded }">▸</span>
      <span class="ft-name">{{ entry.name }}</span>
    </div>
    <template v-if="entry.kind === 'directory' && expanded && children">
      <FileTreeNode
        v-for="child in children"
        :key="child.name"
        :entry="child"
        :depth="depth + 1"
        :parent-dir="entry.handle"
        @open-file="emit('open-file', $event)"
      />
    </template>

    <!-- file -->
    <div
      v-else-if="fileHandle"
      class="ft-row ft-file"
      :class="{ 'ft-md': isMarkdown }"
      :style="{ paddingLeft: `${depth * 14 + 22}px` }"
      @click="
        isMarkdown &&
          emit('open-file', { handle: fileHandle, parentDir })
      "
    >
      <span class="ft-name">{{ entry.name }}</span>
    </div>
  </div>
</template>

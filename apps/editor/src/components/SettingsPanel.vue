<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '../lib/i18n'
import {
  isEnabled,
  listPlugins,
  loadDisabledIds,
  saveDisabledIds,
  type RitedownPlugin,
} from '../lib/plugins'

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const plugins = ref<RitedownPlugin[]>([])
const disabledIds = ref<string[]>([])

function refresh(): void {
  plugins.value = listPlugins()
  disabledIds.value = loadDisabledIds()
}

function toggle(plugin: RitedownPlugin): void {
  const idx = disabledIds.value.indexOf(plugin.id)
  if (idx >= 0) disabledIds.value.splice(idx, 1)
  else disabledIds.value.push(plugin.id)
  saveDisabledIds(disabledIds.value)
  refresh()
}

function toggleOpen(): void {
  open.value = !open.value
  if (open.value) refresh()
}

function onDocClick(e: MouseEvent): void {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  refresh()
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootEl" class="settings-root">
    <button class="tb-btn" :title="t('settings')" @click.stop="toggleOpen">
      ⚙ {{ t('settings') }}
    </button>
    <div v-if="open" class="settings-panel">
      <div class="settings-title">{{ t('plugins') }}</div>
      <label v-for="p in plugins" :key="p.id" class="plugin-row">
        <input
          type="checkbox"
          :checked="isEnabled(p, disabledIds)"
          @change="toggle(p)"
        />
        <span class="plugin-name">{{ p.name }}</span>
        <span class="plugin-desc">{{ p.description }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.settings-root {
  position: relative;
  display: inline-block;
}

.settings-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  min-width: 300px;
  max-width: 92vw;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
}

.settings-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-soft);
  margin-bottom: 8px;
}

.plugin-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 6px;
  align-items: baseline;
  padding: 4px 0;
  cursor: pointer;
}

.plugin-name {
  font-weight: 600;
  white-space: nowrap;
}

.plugin-desc {
  font-size: 12px;
  color: var(--fg-soft);
}
</style>

<script setup lang="ts">
import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'

const props = defineProps<{ active: string[] }>()
const emit = defineEmits<{ command: [name: string] }>()

interface Tool {
  name: string
  titleKey: MessageKey
  shortcut: string
  paths: string[]
}

/** icon paths drawn on a 16×16 grid, stroke only */
const groups: Tool[][] = [
  [
    {
      name: 'bold',
      titleKey: 'fmtBold',
      shortcut: 'Ctrl+B',
      paths: ['M5 3.5h3.4a2.5 2.5 0 0 1 0 5H5z', 'M5 8.5h4a2.6 2.6 0 0 1 0 5.2H5z'],
    },
    {
      name: 'italic',
      titleKey: 'fmtItalic',
      shortcut: 'Ctrl+I',
      paths: ['M6.5 3.5h4M5.5 13h4M9.8 3.5l-3 9'],
    },
    {
      name: 'strike',
      titleKey: 'fmtStrike',
      shortcut: 'Ctrl+Shift+X',
      paths: [
        'M3 8.5h10',
        'M10.7 4.9c-.6-.9-1.7-1.4-3-1.4-1.6 0-2.7.9-2.7 2.1 0 2.7 5.8 1.5 5.8 4.3 0 1.3-1.2 2.2-2.9 2.2-1.4 0-2.6-.6-3.2-1.4',
      ],
    },
    {
      name: 'code',
      titleKey: 'fmtInlineCode',
      shortcut: 'Ctrl+E',
      paths: ['M5.8 4.2 2.3 8.5l3.5 4.3M10.2 4.2l3.5 4.3-3.5 4.3'],
    },
  ],
  [
    {
      name: 'h1',
      titleKey: 'fmtH1',
      shortcut: 'Ctrl+1',
      paths: ['M2.5 3.5v9M7.3 3.5v9M2.5 8h4.8', 'M10.4 12.8V7.6l-1.3.8'],
    },
    {
      name: 'h2',
      titleKey: 'fmtH2',
      shortcut: 'Ctrl+2',
      paths: [
        'M2.5 3.5v9M7.3 3.5v9M2.5 8h4.8',
        'M10 12.8c0-1.1.6-1.7 1.7-2.4 1-.6 1.5-1.1 1.5-2 0-.9-.7-1.5-1.6-1.5-.8 0-1.4.4-1.7 1.1',
      ],
    },
    {
      name: 'h3',
      titleKey: 'fmtH3',
      shortcut: 'Ctrl+3',
      paths: [
        'M2.5 3.5v9M7.3 3.5v9M2.5 8h4.8',
        'M10 5.9c.3-.6.9-1 1.7-1 1 0 1.7.6 1.7 1.4 0 .9-.7 1.4-1.5 1.4',
        'M10 12.7c.3.5.9.9 1.7.9 1.1 0 1.8-.7 1.8-1.6 0-1-.7-1.5-1.8-1.5',
      ],
    },
  ],
  [
    {
      name: 'bullet',
      titleKey: 'fmtBullet',
      shortcut: 'Ctrl+Shift+[',
      paths: ['M5.5 4h8M5.5 8h8M5.5 12h8', 'M2.6 4h.8M2.6 8h.8M2.6 12h.8'],
    },
    {
      name: 'ordered',
      titleKey: 'fmtOrdered',
      shortcut: 'Ctrl+Shift+]',
      paths: [
        'M6 4h7M6 8h7M6 12h7',
        'M2.4 3.6 3 3.1v2.3',
        'M2.2 9.3c0-.5.4-.9.9-.9s.9.3.9.8c0 .8-1.8 1.3-1.8 2.4h1.9',
      ],
    },
    {
      name: 'task',
      titleKey: 'fmtTask',
      shortcut: 'Ctrl+Shift+L',
      paths: ['M2.6 3.6h10.8v8.8H2.6z', 'M4.6 8l1.3 1.4 2.4-2.6'],
    },
    {
      name: 'quote',
      titleKey: 'fmtQuote',
      shortcut: 'Ctrl+Shift+Q',
      paths: ['M3 3.6v8.8', 'M6 5.4h7M6 8h7M6 10.6h4.6'],
    },
  ],
  [
    {
      name: 'codeblock',
      titleKey: 'fmtCodeBlock',
      shortcut: 'Ctrl+Shift+K',
      paths: [
        'M2.6 3.6h10.8v8.8H2.6z',
        'M6.4 6.6 4.8 8l1.6 1.4M9.6 6.6 11.2 8l-1.6 1.4',
      ],
    },
    {
      name: 'table',
      titleKey: 'fmtTable',
      shortcut: 'Ctrl+Shift+T',
      paths: [
        'M2.6 3.6h10.8v8.8H2.6z',
        'M2.6 6.6h10.8M2.6 9.6h10.8M6.2 3.6v8.8M9.8 3.6v8.8',
      ],
    },
    {
      name: 'link',
      titleKey: 'fmtLink',
      shortcut: 'Ctrl+K',
      paths: [
        'M6.4 9.6 9.6 6.4',
        'M7.2 5.4l1-1a2.2 2.2 0 0 1 3.2 3.1l-1 1',
        'M8.8 10.6l-1 1a2.2 2.2 0 0 1-3.2-3.1l1-1',
      ],
    },
    {
      name: 'image',
      titleKey: 'fmtImage',
      shortcut: 'Ctrl+Shift+I',
      paths: [
        'M2.6 3.6h10.8v8.8H2.6z',
        'M2.6 10.2l3-3 2.4 2.4 1.8-1.8 3 3',
      ],
    },
  ],
  [
    {
      name: 'formula',
      titleKey: 'fmtFormula',
      shortcut: 'Ctrl+Shift+M',
      paths: [
        'M10.6 3.6H5.9L8.4 8l-2.5 4.4h4.7',
        'M11.2 3.6h1.2M11.2 12.4h1.2',
      ],
    },
    {
      name: 'divider',
      titleKey: 'fmtDivider',
      shortcut: 'Ctrl+Shift+H',
      paths: ['M2.5 8h11'],
    },
  ],
]

function isActive(name: string): boolean {
  return props.active.includes(name)
}
</script>

<template>
  <div class="md-toolbar" @mousedown.prevent>
    <template v-for="(group, index) in groups" :key="index">
      <span v-if="index > 0" class="md-sep"></span>
      <button
        v-for="tool in group"
        :key="tool.name"
        class="md-tool"
        :class="{ active: isActive(tool.name) }"
        type="button"
        :title="`${t(tool.titleKey)} (${tool.shortcut})`"
        :aria-label="t(tool.titleKey)"
        @click="emit('command', tool.name)"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path v-for="(d, i) in tool.paths" :key="i" :d="d" />
        </svg>
      </button>
    </template>
  </div>
</template>

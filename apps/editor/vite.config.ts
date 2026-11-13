import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    // Only @mermaid-js/parser (mermaid's own cohesive parser package, lazy-
    // loaded with diagram types that need it) exceeds the default limit.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('@codemirror/') || id.includes('/codemirror')) {
            return 'codemirror'
          }
          if (
            id.includes('@lezer/') ||
            id.includes('style-mod') ||
            id.includes('w3c-keyname') ||
            id.includes('crelt')
          ) {
            return 'codemirror-core'
          }
          if (
            id.includes('/unified') ||
            id.includes('/remark-') ||
            id.includes('/rehype-') ||
            id.includes('micromark') ||
            id.includes('mdast-') ||
            id.includes('unist-') ||
            id.includes('hast-') ||
            id.includes('decode-named-character-reference') ||
            id.includes('character-') ||
            id.includes('bail') ||
            id.includes('trough') ||
            id.includes('vfile')
          ) {
            return 'markdown'
          }
          if (id.includes('/@vue/') || id.includes('/vue/') || id.includes('@vue/')) {
            return 'vue'
          }
          // mermaid's runtime is large; group its npm deps into small chunks
          // (all load in parallel on first mermaid use). mermaid pre-bundles
          // each diagram type as its own dist/chunks/* file — keep that
          // built-in lazy granularity untouched.
          if (id.includes('/@mermaid-js/')) return 'mermaid-parser'
          if (id.includes('/mermaid/dist/chunks/')) return
          if (id.includes('/lodash-es')) return 'mermaid-lodash'
          if (id.includes('/es-toolkit')) return 'mermaid-toolkit'
          if (id.includes('/khroma') || id.includes('/stylis')) {
            return 'mermaid-style'
          }
          if (id.includes('/@iconify/')) return 'mermaid-icons'
          if (id.includes('/d3-') || id.includes('/internmap') || id.includes('/dagre')) {
            return 'mermaid-d3'
          }
          if (
            id.includes('/dompurify') ||
            id.includes('/dayjs') ||
            id.includes('/roughjs') ||
            id.includes('/marked') ||
            id.includes('/fastdom') ||
            id.includes('/@braintree') ||
            id.includes('/ts-dedent')
          ) {
            return 'mermaid-vendor'
          }
          if (id.includes('/mermaid')) return 'mermaid-core'
        },
      },
    },
  },
})

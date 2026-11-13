import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
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
        },
      },
    },
  },
})

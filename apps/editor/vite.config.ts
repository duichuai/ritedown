import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Build-time virtual module: katex.min.css with every woff2 font inlined as
 * a base64 data URI (woff/ttf fallbacks stripped). Lets the HTML export be a
 * truly self-contained single file; loaded lazily via dynamic import so the
 * ~500 kB chunk never touches first paint.
 */
function katexExportCss(): Plugin {
  const id = '\0virtual:katex-export-css'
  let css: string | null = null
  return {
    name: 'katex-export-css',
    resolveId(source) {
      if (source === 'virtual:katex-export-css') return id
    },
    load(loadId) {
      if (loadId !== id) return
      if (css) return css
      const require = createRequire(import.meta.url)
      const cssPath = require.resolve('katex/dist/katex.min.css')
      css = readFileSync(cssPath, 'utf8')
        // inline every woff2 font as a base64 data URI
        .replace(/url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)/g, (_m, font: string) => {
          const base64 = readFileSync(require.resolve(`katex/dist/${font}`)).toString('base64')
          return `url(data:font/woff2;base64,${base64}) format("woff2")`
        })
        // woff/ttf fallbacks are dead weight in a single-file export
        .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, '')
        .replace(/,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '')
      return `export default ${JSON.stringify(css)}`
    },
  }
}

export default defineConfig({
  plugins: [vue(), katexExportCss()],
  resolve: {
    alias: [
      {
        // drop micromark-extension-math's html.js (static katex import,
        // unused here) to keep katex lazy: resolve to syntax.js directly
        find: /^micromark-extension-math$/,
        replacement: fileURLToPath(
          new URL('../../node_modules/micromark-extension-math/lib/syntax.js', import.meta.url),
        ),
      },
    ],
  },
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

import { createApp } from 'vue'
import App from './App.vue'
import 'katex/dist/katex.min.css'
import './styles.css'
import { isTauri } from './lib/fileProvider'

createApp(App).mount('#app')

// PWA: register the hand-rolled service worker in production browser builds
// only. The desktop webview must never use one: its cached shell outlives
// app updates and keeps pointing at asset hashes that no longer exist,
// leaving a blank window. Older desktop builds did register it, so remove
// any leftover registration on startup.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  if (isTauri()) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch((err) => console.warn('service worker cleanup failed:', err))
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('service worker registration failed:', err)
      })
    })
  }
}

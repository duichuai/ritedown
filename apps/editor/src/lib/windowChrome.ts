import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from './fileProvider'

/**
 * Desktop window chrome: native title follows the active document (with a
 * dirty marker), and closing is intercepted while there are unsaved changes.
 * On the web the same title lands on document.title; close interception is
 * skipped there (the browser's beforeunload guard handles it).
 */

/** push a window/document title to the current environment */
export function applyTitle(title: string): void {
  if (isTauri()) {
    getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        // no window permission granted — ignore
      })
  } else {
    document.title = title
  }
}

/**
 * Intercept the native close request: when there are unsaved changes, ask
 * for confirmation and only destroy the window once confirmed (desktop only).
 */
export async function interceptClose(
  isDirty: () => boolean,
  confirmMessage: () => string,
): Promise<void> {
  if (!isTauri()) return
  const win = getCurrentWindow()
  let confirmedClose = false
  await win.onCloseRequested((event) => {
    if (confirmedClose || !isDirty()) return // close proceeds normally
    event.preventDefault()
    if (window.confirm(confirmMessage())) {
      confirmedClose = true
      void win.destroy()
    }
  })
}

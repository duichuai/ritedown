import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask } from '@tauri-apps/plugin-dialog'
import { isTauri } from './fileProvider'
import { t } from './i18n'

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
 * Confirm dialog that works in both environments: a native ask() dialog in
 * the Tauri shell, window.confirm on the web. (window.confirm is unusable
 * inside Tauri/WebView2 — it resolves without ever showing any UI.)
 */
export async function confirmDialog(message: string): Promise<boolean> {
  if (isTauri()) {
    try {
      return await ask(message, {
        title: 'Ritedown',
        kind: 'warning',
        okLabel: t('dialogOk'),
        cancelLabel: t('dialogCancel'),
      })
    } catch {
      return false
    }
  }
  return window.confirm(message)
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
  await win.onCloseRequested(async (event) => {
    if (confirmedClose || !isDirty()) return // close proceeds normally
    event.preventDefault() // synchronous — must happen before the async dialog
    if (await confirmDialog(confirmMessage())) {
      confirmedClose = true
      void win.destroy()
    }
  })
}

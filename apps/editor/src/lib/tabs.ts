/**
 * Multi-tab document model. Tabs hold their own text/saved snapshots so the
 * dirty state is per-document; App.vue keeps the reactive tab array and the
 * active id. Pure helpers here are unit-tested without a browser.
 */

import type { DirRef, FileRef } from './fileProvider'

export interface EditorTab {
  id: number
  name: string
  /** file ref when the tab maps to a real file (null: unsaved draft) */
  handle: FileRef | null
  /** the folder containing the file, for relative-image resolution */
  parentDir: DirRef | null
  text: string
  saved: string
  cursorLine: number
}

let seq = 0

export function nextTabId(): number {
  return ++seq
}

export function makeTab(init: {
  name: string
  text: string
  handle?: FileRef | null
  parentDir?: DirRef | null
}): EditorTab {
  return {
    id: nextTabId(),
    name: init.name,
    handle: init.handle ?? null,
    parentDir: init.parentDir ?? null,
    text: init.text,
    saved: init.text,
    cursorLine: 1,
  }
}

/** the tab to activate after closing the one at `index` (null: none left) */
export function neighborTabId(tabs: EditorTab[], index: number): number | null {
  if (index < 0 || index >= tabs.length) return null
  if (tabs.length === 1) return null
  const neighbor = tabs[index + 1] ?? tabs[index - 1]
  return neighbor.id
}

/** the tab already editing this file, if any (dedupe on open, by ref id) */
export function findTabByHandle(
  tabs: EditorTab[],
  file: FileRef,
): EditorTab | null {
  return (
    tabs.find((tab) => tab.handle !== null && tab.handle.id === file.id) ??
    null
  )
}

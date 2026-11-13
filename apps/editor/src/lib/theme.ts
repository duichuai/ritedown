import { ref } from 'vue'

export type ThemePref = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'ritedown-theme'

function loadPref(): ThemePref {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'auto' || saved === 'light' || saved === 'dark') return saved
  } catch {
    // no localStorage (SSR / tests)
  }
  return 'auto'
}

function systemDark(): boolean {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** user preference: follow the system or force light/dark */
export const themePref = ref<ThemePref>(loadPref())

/** the theme actually in effect (auto resolves via prefers-color-scheme) */
export const resolvedTheme = ref<'light' | 'dark'>(
  themePref.value === 'auto' ? (systemDark() ? 'dark' : 'light') : themePref.value,
)

function apply(): void {
  document.documentElement.dataset.theme = resolvedTheme.value
}

// keep 'auto' in sync when the system scheme changes (also re-renders
// mermaid via the resolvedTheme watcher in PreviewPane)
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themePref.value !== 'auto') return
    resolvedTheme.value = e.matches ? 'dark' : 'light'
    apply()
  })
} catch {
  // no matchMedia (tests)
}

apply()

export function setThemePref(pref: ThemePref): void {
  themePref.value = pref
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // no localStorage
  }
  resolvedTheme.value =
    pref === 'auto' ? (systemDark() ? 'dark' : 'light') : pref
  apply()
}

/** auto -> light -> dark -> auto */
export function cycleTheme(): void {
  const order: ThemePref[] = ['auto', 'light', 'dark']
  setThemePref(order[(order.indexOf(themePref.value) + 1) % order.length])
}

/** current effective theme, for lazy loaders that bake theme into output */
export function isDark(): boolean {
  return resolvedTheme.value === 'dark'
}

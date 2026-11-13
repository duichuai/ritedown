import { ref } from 'vue'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'ritedown-locale'

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    // no localStorage (SSR / tests)
  }
  try {
    if (navigator.language.toLowerCase().startsWith('zh')) return 'zh'
  } catch {
    // no navigator (tests)
  }
  return 'zh'
}

/** reactive UI locale; persists across sessions, defaults from the browser */
export const locale = ref<Locale>(detectLocale())

export const messages = {
  zh: {
    outline: '大纲',
    open: '打开',
    save: '保存',
    dirty: '有未保存的更改',
    tocEmpty: '暂无标题',
    words: '字数',
    characters: '字符',
    lines: '行数',
    line: '行',
    col: '列',
    untitled: '未命名.md',
    saveAs: '另存为',
    dropToOpen: '松开以打开 Markdown 文件',
    theme: '主题',
    themeAuto: '自动',
    themeLight: '亮色',
    themeDark: '暗色',
    switchLang: 'Switch to English',
  },
  en: {
    outline: 'Outline',
    open: 'Open',
    save: 'Save',
    dirty: 'Unsaved changes',
    tocEmpty: 'No headings',
    words: 'Words',
    characters: 'Characters',
    lines: 'Lines',
    line: 'Ln',
    col: 'Col',
    untitled: 'Untitled.md',
    saveAs: 'Save As',
    dropToOpen: 'Drop a Markdown file to open it',
    theme: 'Theme',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    switchLang: '切换到中文',
  },
} as const

export type MessageKey = keyof typeof messages.zh

/** translate a UI string in the current locale */
export function t(key: MessageKey): string {
  return messages[locale.value][key]
}

export function setLocale(value: Locale): void {
  locale.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // no localStorage (SSR / tests)
  }
}

export function toggleLocale(): void {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}

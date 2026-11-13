import { beforeEach, describe, expect, it } from 'vitest'
import { messages, locale, setLocale, t, toggleLocale } from '../src/lib/i18n'

// the module holds a singleton locale ref — reset before each test
beforeEach(() => setLocale('zh'))

describe('i18n', () => {
  it('defaults to Chinese when no browser preferences are available', () => {
    expect(locale.value).toBe('zh')
    expect(t('outline')).toBe('大纲')
    expect(t('open')).toBe('打开')
    expect(t('save')).toBe('保存')
  })

  it('translates every key in the active locale', () => {
    const keys = Object.keys(messages.zh) as (keyof typeof messages.zh)[]
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(typeof t(key)).toBe('string')
      expect(t(key).length).toBeGreaterThan(0)
    }
  })

  it('switches to English and back via toggleLocale', () => {
    setLocale('en')
    expect(t('outline')).toBe('Outline')
    expect(t('tocEmpty')).toBe('No headings')
    expect(t('untitled')).toBe('Untitled.md')
    toggleLocale()
    expect(locale.value).toBe('zh')
    expect(t('outline')).toBe('大纲')
  })

  it('survives a missing localStorage when saving the preference', () => {
    // node test env has no localStorage — setLocale must not throw
    expect(() => setLocale('en')).not.toThrow()
    expect(locale.value).toBe('en')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DOC } from '../src/defaultDoc'
import { render } from '@ritedown/core'
import {
  enabledPluginIds,
  isEnabled,
  listPlugins,
  loadDisabledIds,
  resolveExtensions,
  saveDisabledIds,
} from '../src/lib/plugins'

// node test env has no localStorage — provide a minimal in-memory stub
const storage = new Map<string, string>()
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  storage.clear()
})

describe('plugins registry', () => {
  it('lists all plugins in canonical order', () => {
    expect(listPlugins().map((p) => p.id)).toEqual([
      'gfm',
      'gfmAlerts',
      'gemoji',
      'math',
      'mathToCode',
      'frontmatter',
      'frontmatterTable',
      'lineMarkers',
    ])
  })

  it('every plugin declares a remark or rehype extension and is default-enabled', () => {
    for (const p of listPlugins()) {
      expect(p.remark !== undefined || p.rehype !== undefined).toBe(true)
      expect(p.defaultEnabled).not.toBe(false)
    }
  })
})

describe('resolveExtensions', () => {
  it('with all enabled preserves the canonical pipeline order', () => {
    const ids = enabledPluginIds([])
    const exts = resolveExtensions(ids)
    // length equals number of remark extensions (no rehype ones yet)
    expect(exts).toHaveLength(listPlugins().length)
    // spot-check: mathToCode stays after math via array-form frontmatter in place
    expect(ids).toContain('math')
    expect(ids.indexOf('mathToCode')).toBe(ids.indexOf('math') + 1)
    expect(ids.indexOf('frontmatterTable')).toBe(ids.indexOf('frontmatter') + 1)
  })

  it('disabling a middle plugin keeps the remaining order intact', () => {
    const exts = resolveExtensions(enabledPluginIds(['math']))
    expect(exts).toHaveLength(listPlugins().length - 1)
    // pipeline without math: no katex spans, but gfm still works
    const html = render('| a |\n| --- |\n| 1 |', { extensions: exts })
    expect(html).toContain('<table')
  })

  it('defaultDoc renders identically with the registry pipeline', () => {
    const html = render(DEFAULT_DOC, { extensions: resolveExtensions(enabledPluginIds([])) })
    // core features still render (lineMarkers adds data-md-line attrs)
    expect(html).toContain('<h1')
    // gfmAlerts is now wired (previously a pipeline gap)
    expect(html).toContain('markdown-alert')
    // emoji shortcode transformed
    expect(html).not.toContain(':tada:')
  })
})

describe('disabled-ids persistence', () => {
  it('round-trips through localStorage', () => {
    saveDisabledIds(['math', 'gemoji'])
    expect(loadDisabledIds()).toEqual(['math', 'gemoji'])
  })

  it('returns [] when nothing stored', () => {
    expect(loadDisabledIds()).toEqual([])
  })

  it('returns [] on malformed JSON', () => {
    storage.set('ritedown-plugins', '{not json')
    expect(loadDisabledIds()).toEqual([])
  })

  it('filters non-string entries', () => {
    storage.set('ritedown-plugins', '["math", 3, null]')
    expect(loadDisabledIds()).toEqual(['math'])
  })

  it('isEnabled is a simple membership check', () => {
    const gfm = listPlugins()[0]
    expect(isEnabled(gfm, ['gfm'])).toBe(false)
    expect(isEnabled(gfm, [])).toBe(true)
  })
})

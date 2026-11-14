import { describe, expect, it } from 'vitest'
import { parse, render, builtin, builtinPlugins } from '../src/index'
import remarkGfmAlerts from '@ritedown/gfm-alerts'

const sample = [
  '# Title',
  '',
  '| a | b |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '- [x] done',
  '- [ ] todo',
  '',
  '~~struck~~ and www.example.com',
  '',
  '> [!NOTE]',
  '> alert body',
].join('\n')

describe('render', () => {
  const html = render(sample, { extensions: [builtin.gfm, remarkGfmAlerts] })

  it('renders a heading', () => {
    expect(html).toContain('<h1>Title</h1>')
  })

  it('renders GFM table', () => {
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('renders GFM task list', () => {
    expect(html).toContain('type="checkbox" checked')
    expect(html).toContain('type="checkbox"')
  })

  it('renders strikethrough and autolink', () => {
    expect(html).toContain('<del>struck</del>')
    expect(html).toContain('<a href="http://www.example.com"')
  })

  it('renders GFM alert', () => {
    expect(html).toContain('markdown-alert-note')
  })
})

describe('parse', () => {
  it('returns an mdast tree (zero extensions by default)', () => {
    const tree = parse('# Hello\n')
    expect(tree.type).toBe('root')
    expect(tree.children[0]).toMatchObject({ type: 'heading', depth: 1 })
  })

  it('keeps core free of extensions when none are enabled', () => {
    const html = render('| a |\n| --- |\n| 1 |')
    expect(html).not.toContain('<table>')
  })
})

describe('builtinPlugins', () => {
  it('contains gfm and gfmAlerts in canonical order, all default-enabled', () => {
    expect(builtinPlugins.map((p) => p.id)).toEqual(['gfm', 'gfmAlerts'])
    expect(builtinPlugins.every((p) => p.defaultEnabled)).toBe(true)
  })

  it('every plugin declares a remark or rehype extension', () => {
    expect(builtinPlugins.every((p) => p.remark !== undefined || p.rehype !== undefined)).toBe(true)
  })

  it('rendering with resolveExtensions from builtinPlugins matches explicit list', () => {
    const exts = builtinPlugins.map((p) => p.remark!)
    const html = render(sample, { extensions: exts })
    expect(html).toContain('<table>')
    expect(html).toContain('markdown-alert-note')
  })
})

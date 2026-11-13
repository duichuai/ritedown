import { describe, expect, it } from 'vitest'
import { render } from '@ritedown/core'
import remarkFrontmatter from 'remark-frontmatter'
import { remarkFrontmatterTable } from '../src/lib/frontmatter'

const extensions = [[remarkFrontmatter, ['yaml']], remarkFrontmatterTable] as const

describe('front matter pipeline', () => {
  it('renders leading front matter as a key/value table', () => {
    const html = render('---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body\n', {
      extensions: [...extensions],
    })
    expect(html).toContain('class="frontmatter"')
    expect(html).toContain('<th>title</th>')
    expect(html).toContain('<td>Hello</td>')
    expect(html).toContain('<td>["a","b"]</td>')
    expect(html).toContain('<h1>Body</h1>')
  })

  it('hides front matter from the rendered body text', () => {
    const html = render('---\ntitle: Secret\n---\n\nbody', {
      extensions: [...extensions],
    })
    expect(html).toContain('Secret')
    expect(html).not.toContain('<p>title: Secret</p>')
  })

  it('leaves documents without front matter untouched', () => {
    const html = render('# Just a doc\n', { extensions: [...extensions] })
    expect(html).not.toContain('frontmatter')
  })

  it('falls back to raw text for invalid yaml', () => {
    const html = render('---\n: : :\n---\n\nbody\n', {
      extensions: [...extensions],
    })
    expect(html).toContain('class="frontmatter"')
    expect(html).toContain('body')
  })
})

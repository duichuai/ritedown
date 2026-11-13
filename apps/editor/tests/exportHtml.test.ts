import { describe, expect, it } from 'vitest'
import { assembleDocument, escapeHtml } from '../src/lib/exportHtml'

describe('html export', () => {
  it('escapes the document title', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)> & "quotes"')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;',
    )
  })

  it('builds a standalone document with prose styles and no app chrome', () => {
    const html = assembleDocument('<h1>Hello</h1>', 'My Doc', '<!--extra-->')
    expect(html).toContain('<title>My Doc</title>')
    expect(html).toContain('<!--extra-->')
    expect(html).toContain('<article class="prose">')
    expect(html).toContain('<h1>Hello</h1>')
    // prose styling + dark-mode handling ship in the standalone file
    expect(html).toContain('.markdown-alert')
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('--shiki-dark')
    // meta charset first, so the file is self-describing
    expect(html.indexOf('charset')).toBeLessThan(html.indexOf('<style>'))
  })
})

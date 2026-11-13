import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import remarkGfmAlerts from '../src/index'

const process = (md: string) =>
  String(unified().use(remarkParse).use(remarkGfmAlerts).use(remarkRehype).use(rehypeStringify).processSync(md))

describe('remarkGfmAlerts', () => {
  it.each([
    ['NOTE', 'note'],
    ['TIP', 'tip'],
    ['IMPORTANT', 'important'],
    ['WARNING', 'warning'],
    ['CAUTION', 'caution'],
  ])('renders > [!%s] as a markdown-alert div', (marker, cls) => {
    const html = process(`> [!${marker}]\n> body text`)
    expect(html).toContain(`markdown-alert-${cls}`)
    expect(html).toContain('body text')
    expect(html).not.toContain(`[!${marker}]`)
  })

  it('renders multi-paragraph alert bodies', () => {
    const html = process('> [!NOTE]\n> first\n>\n> second')
    expect(html).toContain('first')
    expect(html).toContain('second')
  })

  it('keeps plain blockquotes untouched', () => {
    const html = process('> [!WHAT]\n> not a variant')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('markdown-alert')
  })

  it('keeps blockquotes whose marker is not on its own line', () => {
    const html = process('> [!NOTE] inline marker')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('markdown-alert')
  })
})

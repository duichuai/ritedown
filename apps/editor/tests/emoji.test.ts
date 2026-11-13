import { describe, expect, it } from 'vitest'
import { render } from '@ritedown/core'
import remarkGemoji from 'remark-gemoji'

describe('emoji pipeline', () => {
  it('converts shortcodes to emoji characters', () => {
    const html = render('Good job :tada:', { extensions: [remarkGemoji] })
    expect(html).toContain('🎉')
    expect(html).not.toContain(':tada:')
  })

  it('leaves plain colons alone', () => {
    const html = render('key: value :not_an_emoji:', {
      extensions: [remarkGemoji],
    })
    expect(html).toContain(':not_an_emoji:')
    expect(html).toContain('key: value')
  })

  it('keeps raw emoji untouched', () => {
    const html = render('直接写 🎉 也行', { extensions: [remarkGemoji] })
    expect(html).toContain('🎉')
  })
})

import { describe, expect, it } from 'vitest'
import { isRelativeSrc } from '../src/lib/relImages'

describe('isRelativeSrc', () => {
  it('treats plain paths as relative', () => {
    expect(isRelativeSrc('images/logo.png')).toBe(true)
    expect(isRelativeSrc('./a/b.png')).toBe(true)
    expect(isRelativeSrc('../up/c.png')).toBe(true)
    expect(isRelativeSrc('pic.JPG')).toBe(true)
  })

  it('treats absolute and external sources as non-relative', () => {
    expect(isRelativeSrc('https://example.com/a.png')).toBe(false)
    expect(isRelativeSrc('http://example.com/a.png')).toBe(false)
    expect(isRelativeSrc('data:image/png;base64,AAAA')).toBe(false)
    expect(isRelativeSrc('blob:https://app/uuid')).toBe(false)
    expect(isRelativeSrc('/root-relative.png')).toBe(false)
    expect(isRelativeSrc('')).toBe(false)
  })
})

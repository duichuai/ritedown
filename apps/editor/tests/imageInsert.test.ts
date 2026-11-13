import { describe, expect, it } from 'vitest'
import { imageAssetPath, imageMarkdown } from '../src/lib/imageInsert'

const noon = new Date(2026, 10, 13, 12, 34, 56)

describe('imageAssetPath', () => {
  it('builds a timestamped assets path', () => {
    expect(imageAssetPath('photo.png', noon)).toBe(
      'assets/20261113-123456-photo.png',
    )
  })

  it('normalizes extensions and sanitizes unsafe characters', () => {
    expect(imageAssetPath('screen shot #1.webp', noon)).toBe(
      'assets/20261113-123456-screen-shot-1.webp',
    )
    expect(imageAssetPath('我的 截图!.JPEG', noon)).toBe(
      'assets/20261113-123456-我的-截图.jpeg',
    )
  })

  it('falls back to png for extensionless files', () => {
    expect(imageAssetPath('clipboard', noon)).toBe(
      'assets/20261113-123456-clipboard.png',
    )
  })
})

describe('imageMarkdown', () => {
  it('uses the base name as alt text and strips brackets', () => {
    expect(imageMarkdown('chart [v2].png', 'assets/x.png')).toBe(
      '![chart v2](assets/x.png)',
    )
  })

  it('falls back to a generic alt', () => {
    expect(imageMarkdown('.png', 'assets/x.png')).toBe('![image](assets/x.png)')
  })
})

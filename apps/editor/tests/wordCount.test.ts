import { describe, expect, it } from 'vitest'
import { wordCount } from '../src/lib/wordCount'

describe('wordCount', () => {
  it('counts english words', () => {
    expect(wordCount('hello world')).toEqual({ words: 2, characters: 10 })
  })

  it('counts cjk characters individually', () => {
    expect(wordCount('你好世界')).toEqual({ words: 4, characters: 4 })
  })

  it('handles mixed content', () => {
    expect(wordCount('你好 world\n\n# 标题')).toEqual({ words: 5, characters: 10 })
  })

  it('handles empty input', () => {
    expect(wordCount('')).toEqual({ words: 0, characters: 0 })
  })
})

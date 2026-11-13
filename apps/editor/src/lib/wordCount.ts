/** Count words (CJK chars count individually) and non-whitespace characters. */
export function wordCount(text: string): { words: number; characters: number } {
  const withoutWhitespace = text.replace(/\s+/g, '')
  const cjk = withoutWhitespace.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
  const latinWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length
  return { words: cjk + latinWords, characters: withoutWhitespace.length }
}

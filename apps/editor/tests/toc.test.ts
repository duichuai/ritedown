import { describe, expect, it } from 'vitest'
import { buildToc } from '../src/lib/toc'

describe('buildToc', () => {
  it('extracts headings with depth, text and line', () => {
    const toc = buildToc('# Title\n\npara\n\n## Section A\n\n### Deep\n')
    expect(toc).toEqual([
      { depth: 1, text: 'Title', line: 1 },
      { depth: 2, text: 'Section A', line: 3 },
      { depth: 3, text: 'Deep', line: 5 },
    ])
  })

  it('flattens inline markup in heading text', () => {
    const toc = buildToc('## 使用 `code` 和 *em*\n')
    expect(toc).toEqual([{ depth: 2, text: '使用 code 和 em', line: 1 }])
  })

  it('returns empty for documents without headings', () => {
    expect(buildToc('just text')).toEqual([])
  })
})

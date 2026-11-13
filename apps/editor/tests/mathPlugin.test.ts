import { describe, expect, it } from 'vitest'
import { remarkMathToCode } from '../src/lib/mathPlugin'

describe('remarkMathToCode', () => {
  it('rewrites block math into code nodes with lang math', () => {
    const tree = { children: [{ type: 'math', value: 'x^2' }] }
    remarkMathToCode()(tree as never)
    expect(tree.children).toEqual([{ type: 'code', lang: 'math', value: 'x^2' }])
  })

  it('rewrites inline math into inlineCode with math class', () => {
    const tree = {
      children: [
        { type: 'paragraph', children: [{ type: 'inlineMath', value: 'a_1' }] },
      ],
    }
    remarkMathToCode()(tree as never)
    expect(tree.children?.[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'inlineCode',
          value: 'a_1',
          data: { hProperties: { className: 'language-math' } },
        },
      ],
    })
  })

  it('leaves other nodes untouched', () => {
    const tree = { children: [{ type: 'heading', value: 'hi' }] }
    remarkMathToCode()(tree as never)
    expect(tree.children).toEqual([{ type: 'heading', value: 'hi' }])
  })
})

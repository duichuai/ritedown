import { describe, expect, it } from 'vitest'
import type { Root } from 'mdast'
import { remarkLineMarkers } from '../src/lib/lineMarkers'

const makeTree = (): Root => ({
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 1,
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 5, offset: 4 },
      },
    } as never,
    {
      type: 'paragraph',
      position: {
        start: { line: 3, column: 1, offset: 6 },
        end: { line: 3, column: 10, offset: 15 },
      },
    } as never,
    {
      type: 'list',
      ordered: false,
      position: {
        start: { line: 4, column: 1, offset: 16 },
        end: { line: 5, column: 8, offset: 24 },
      },
      children: [
        {
          type: 'listItem',
          position: {
            start: { line: 5, column: 1, offset: 17 },
            end: { line: 5, column: 8, offset: 24 },
          },
        } as never,
      ],
    } as never,
    {
      type: 'inlineCode',
      position: {
        start: { line: 7, column: 1, offset: 26 },
        end: { line: 7, column: 10, offset: 35 },
      },
    } as never,
  ],
})

describe('remarkLineMarkers', () => {
  it('stamps data-md-line on block nodes and list items only', () => {
    const tree = makeTree()
    remarkLineMarkers()(tree)
    expect((tree.children[0] as { data: { hProperties: object } }).data.hProperties).toEqual({
      'data-md-line': '1',
    })
    expect((tree.children[1] as { data: { hProperties: object } }).data.hProperties).toEqual({
      'data-md-line': '3',
    })
    const list = tree.children[2] as never as {
      data: { hProperties: object }
      children: { data: { hProperties: object } }[]
    }
    expect(list.data.hProperties).toEqual({ 'data-md-line': '4' })
    expect(list.children[0].data.hProperties).toEqual({ 'data-md-line': '5' })
    // inline nodes are skipped
    expect((tree.children[3] as { data?: unknown }).data).toBeUndefined()
  })
})

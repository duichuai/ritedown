import { describe, expect, it } from 'vitest'
import { forceLightShiki } from '../src/lib/printPdf'

type StyleLog = Array<{ key: string; value: string; priority: string }>

/** minimal duck-typed element: only what forceLightShiki touches */
function fakeEl(inline: Record<string, string>) {
  const log: StyleLog = []
  const el = {
    style: {
      getPropertyValue: (key: string) => inline[key] ?? '',
      setProperty: (key: string, value: string, priority: string) => {
        log.push({ key, value, priority })
      },
    },
    querySelectorAll: () => [] as unknown[],
  }
  return { el, log }
}

/** minimal duck-typed root answering the two selectors forceLightShiki uses */
function fakeRoot(pres: unknown[], spans: unknown[]) {
  return {
    querySelectorAll: (selector: string) =>
      selector === 'pre.shiki' ? pres : spans,
  } as unknown as ParentNode
}

describe('print pdf export', () => {
  it('re-applies inline shiki colors with !important priority', () => {
    const pre = fakeEl({ color: '#24292e', 'background-color': '#ffffff' })
    const span = fakeEl({ color: '#cf222e' })
    forceLightShiki(fakeRoot([pre.el], [span.el]))

    expect(pre.log).toContainEqual({
      key: 'color',
      value: '#24292e',
      priority: 'important',
    })
    expect(pre.log).toContainEqual({
      key: 'background-color',
      value: '#ffffff',
      priority: 'important',
    })
    expect(span.log).toContainEqual({
      key: 'color',
      value: '#cf222e',
      priority: 'important',
    })
  })

  it('leaves elements without inline colors untouched', () => {
    const pre = fakeEl({})
    const span = fakeEl({})
    forceLightShiki(fakeRoot([pre.el], [span.el]))

    expect(pre.log).toEqual([])
    expect(span.log).toEqual([])
  })
})

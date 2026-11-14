import { describe, expect, it, vi } from 'vitest'
import { openMarkdownViaInput } from '../src/lib/fsAccess'

/**
 * node test env has no DOM — stub a minimal <input> element whose
 * click() is a no-op and whose change/cancel handlers we trigger by hand.
 */
function stubInput() {
  const handlers = new Map<string, () => void>()
  const input: Record<string, unknown> = {
    type: '',
    accept: '',
    style: {},
    files: [] as unknown[],
    addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
    click: () => {},
    remove: () => {},
  }
  vi.stubGlobal('document', {
    createElement: () => input,
    body: { appendChild: () => {} },
  })
  return { input, handlers }
}

describe('openMarkdownViaInput', () => {
  it('resolves with name + text from the picked file', async () => {
    const { input, handlers } = stubInput()
    const promise = openMarkdownViaInput()
    const file = new File(['# hello'], 'notes.md', { type: 'text/markdown' })
    input.files = [file]
    handlers.get('change')?.()
    await expect(promise).resolves.toEqual({ name: 'notes.md', text: '# hello' })
    expect(input.accept).toBe('.md,.markdown,text/markdown')
  })

  it('rejects with an AbortError when the dialog is cancelled', async () => {
    const { handlers } = stubInput()
    const promise = openMarkdownViaInput()
    handlers.get('cancel')?.()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects when change fires with no file selected', async () => {
    const { input, handlers } = stubInput()
    const promise = openMarkdownViaInput()
    input.files = []
    handlers.get('change')?.()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

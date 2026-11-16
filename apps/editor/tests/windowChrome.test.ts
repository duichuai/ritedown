import { beforeEach, describe, expect, it, vi } from 'vitest'

const setTitle = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined)
const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
let closeHandler: ((event: { preventDefault: () => void }) => Promise<void> | void) | null = null
const onCloseRequested = vi
  .fn<(h: (event: { preventDefault: () => void }) => Promise<void> | void) => Promise<() => void>>()
  .mockImplementation(async (handler) => {
    closeHandler = handler
    return () => {}
  })

const ask = vi.fn<(message: string, options?: unknown) => Promise<boolean>>()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setTitle, onCloseRequested, destroy }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: (message: string, options?: unknown) => ask(message, options),
}))

import { applyTitle, confirmDialog, interceptClose } from '../src/lib/windowChrome'

/** stub globals per environment: tauri shell vs plain browser */
function stubEnv(tauri: boolean, confirmResult = true) {
  vi.stubGlobal(
    'window',
    tauri
      ? { __TAURI_INTERNALS__: {}, confirm: vi.fn(() => confirmResult) }
      : { confirm: vi.fn(() => confirmResult) },
  )
  vi.stubGlobal('document', { title: '' })
}

describe('window chrome', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    setTitle.mockClear()
    destroy.mockClear()
    onCloseRequested.mockClear()
    ask.mockReset()
    closeHandler = null
  })

  it('pushes the title to the native window inside Tauri', () => {
    stubEnv(true)
    applyTitle('notes.md — Ritedown')
    expect(setTitle).toHaveBeenCalledWith('notes.md — Ritedown')
  })

  it('falls back to document.title on the web', () => {
    stubEnv(false)
    applyTitle('notes.md — Ritedown')
    expect(setTitle).not.toHaveBeenCalled()
    expect(document.title).toBe('notes.md — Ritedown')
  })

  it('registers a close interceptor only inside Tauri', async () => {
    stubEnv(false)
    await interceptClose(() => true, () => 'msg')
    expect(onCloseRequested).not.toHaveBeenCalled()

    stubEnv(true)
    await interceptClose(() => true, () => 'msg')
    expect(onCloseRequested).toHaveBeenCalledTimes(1)
    expect(closeHandler).not.toBeNull()
  })

  it('lets clean documents close without confirmation', async () => {
    stubEnv(true)
    await interceptClose(() => false, () => 'msg')
    const event = { preventDefault: vi.fn() }
    await closeHandler!(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(ask).not.toHaveBeenCalled()
    expect(destroy).not.toHaveBeenCalled()
  })

  it('prevents close while dirty and destroys only after the native dialog confirms', async () => {
    stubEnv(true)
    ask.mockResolvedValue(false) // user cancels
    await interceptClose(() => true, () => 'msg')
    const event = { preventDefault: vi.fn() }
    await closeHandler!(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledWith('msg', expect.anything())
    expect(destroy).not.toHaveBeenCalled()

    ask.mockClear()
    ask.mockResolvedValue(true) // user confirms
    await interceptClose(() => true, () => 'msg')
    const event2 = { preventDefault: vi.fn() }
    await closeHandler!(event2)
    expect(event2.preventDefault).toHaveBeenCalledTimes(1)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('confirmDialog uses the native ask() dialog inside Tauri', async () => {
    stubEnv(true)
    ask.mockResolvedValue(true)
    await expect(confirmDialog('msg')).resolves.toBe(true)

    ask.mockResolvedValue(false)
    await expect(confirmDialog('msg')).resolves.toBe(false)
  })

  it('confirmDialog falls back to window.confirm on the web', async () => {
    stubEnv(false, true)
    await expect(confirmDialog('msg')).resolves.toBe(true)

    stubEnv(false, false)
    await expect(confirmDialog('msg')).resolves.toBe(false)
  })

  it('confirmDialog treats a failed native dialog as cancel', async () => {
    stubEnv(true)
    ask.mockRejectedValue(new Error('no dialog permission'))
    await expect(confirmDialog('msg')).resolves.toBe(false)
  })
})

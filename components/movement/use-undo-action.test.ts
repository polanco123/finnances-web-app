import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_WINDOW_MS, useUndoAction } from './use-undo-action'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useUndoAction', () => {
  it('is inactive initially and active after start with the label', () => {
    const { result } = renderHook(() => useUndoAction())
    expect(result.current.active).toBeNull()

    act(() => result.current.start('Movimiento eliminado', async () => {}))
    expect(result.current.active).toEqual({ label: 'Movimiento eliminado' })
  })

  it('expires after the undo window and cannot be run afterwards', () => {
    const undo = vi.fn(async () => {})
    const { result } = renderHook(() => useUndoAction())
    act(() => result.current.start('x', undo))

    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 1)
    })
    expect(result.current.active).toEqual({ label: 'x' })

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.active).toBeNull()

    act(() => {
      result.current.run()
    })
    expect(undo).not.toHaveBeenCalled()
  })

  it('window is at least 5s (target ~6s)', () => {
    expect(UNDO_WINDOW_MS).toBeGreaterThanOrEqual(5000)
    expect(UNDO_WINDOW_MS).toBe(6000)
  })

  it('run invokes the undo once and clears the toast', async () => {
    const undo = vi.fn(async () => {})
    const { result } = renderHook(() => useUndoAction())
    act(() => result.current.start('x', undo))

    await act(async () => {
      await result.current.run()
    })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBeNull()

    await act(async () => {
      await result.current.run()
    })
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('pause stops the timer and resume continues with the remaining time', () => {
    const { result } = renderHook(() => useUndoAction())
    act(() => result.current.start('x', async () => {}))

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    act(() => result.current.pause())
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(result.current.active).toEqual({ label: 'x' })

    act(() => result.current.resume())
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(result.current.active).toEqual({ label: 'x' })
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.active).toBeNull()
  })

  it('a second start replaces the first undo and resets the timer', async () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    const { result } = renderHook(() => useUndoAction())

    act(() => result.current.start('one', first))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    act(() => result.current.start('two', second))
    expect(result.current.active).toEqual({ label: 'two' })

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.active).toEqual({ label: 'two' })

    await act(async () => {
      await result.current.run()
    })
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('start while paused begins a fresh running window', () => {
    const { result } = renderHook(() => useUndoAction())
    act(() => result.current.start('one', async () => {}))
    act(() => result.current.pause())
    act(() => result.current.start('two', async () => {}))

    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS)
    })
    expect(result.current.active).toBeNull()
  })

  it('clears the timer on unmount (no state update after unmount)', () => {
    const { result, unmount } = renderHook(() => useUndoAction())
    act(() => result.current.start('x', async () => {}))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

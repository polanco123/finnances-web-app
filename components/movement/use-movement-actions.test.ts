import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./movement-service', () => ({
  updateMovimiento: vi.fn(),
  deleteMovimiento: vi.fn(),
  restoreMovimiento: vi.fn(),
  updateTransferencia: vi.fn(),
  deleteTransferencia: vi.fn(),
  restoreTransferencia: vi.fn(),
}))

import * as service from './movement-service'
import type { Movimiento, MovimientoCursor } from './movement-service'
import { useMovementActions } from './use-movement-actions'
import { UNDO_WINDOW_MS } from './use-undo-action'

const mocked = vi.mocked(service)

const row = (id: string, over: Partial<Movimiento> = {}): Movimiento => ({
  id,
  monto: -100,
  fecha: '2026-11-10',
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: '2026-11-10T12:00:00Z',
  ...over,
})

const r1 = row('r1', { fecha: '2026-11-12' })
const r2 = row('r2', { fecha: '2026-11-11' })
const r3 = row('r3', { fecha: '2026-11-10' })
const origen = row('o', { fecha: '2026-11-11', monto: -200, es_transferencia: true, transferencia_id: 't1', cuenta_id: 'A', hora: '09:00:00' })
const destino = row('d', { fecha: '2026-11-11', monto: 200, es_transferencia: true, transferencia_id: 't1', cuenta_id: 'B', hora: '09:00:00' })

const ids = (rows: Movimiento[]) => rows.map((r) => r.id)

function setup(initial: Movimiento[], paging: { cursor: MovimientoCursor | null; hasMore: boolean } = { cursor: null, hasMore: false }) {
  const onChanged = vi.fn()
  const hook = renderHook(() => {
    const [movements, setMovements] = useState(initial)
    const actions = useMovementActions({ setMovements, onChanged, ...paging })
    return { movements, actions }
  })
  return { ...hook, onChanged }
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  vi.useRealTimers()
})

describe('edit regular movement', () => {
  it('patches the row in place, bumps refresh and starts an undo', async () => {
    const updated = { ...r2, monto: -150, cuenta_id: 'B' }
    mocked.updateMovimiento.mockResolvedValue(updated)
    const { result, onChanged } = setup([r1, r2, r3])

    let ok = false
    await act(async () => {
      ok = await result.current.actions.editMovimiento(r2, { monto: 150, cuentaId: 'B' })
    })

    expect(ok).toBe(true)
    expect(mocked.updateMovimiento).toHaveBeenCalledWith(r2, { monto: 150, cuentaId: 'B' })
    expect(ids(result.current.movements)).toEqual(['r1', 'r2', 'r3'])
    expect(result.current.movements[1]).toEqual(updated)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(result.current.actions.undo.active).not.toBeNull()
    expect(result.current.actions.error).toBeNull()
  })

  it('undo edit restores previous monto and account', async () => {
    const updated = { ...r2, monto: -150, cuenta_id: 'B' }
    mocked.updateMovimiento.mockResolvedValueOnce(updated).mockResolvedValueOnce(r2)
    const { result, onChanged } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.editMovimiento(r2, { monto: 150, cuentaId: 'B' })
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })

    expect(mocked.updateMovimiento).toHaveBeenLastCalledWith(r2, { monto: 100, cuentaId: 'A' })
    expect(result.current.movements[1]).toEqual(r2)
    expect(onChanged).toHaveBeenCalledTimes(2)
    expect(result.current.actions.undo.active).toBeNull()
  })

  it('failure leaves the list unchanged, surfaces an error and starts no undo', async () => {
    mocked.updateMovimiento.mockRejectedValue(new Error('rls'))
    const { result, onChanged } = setup([r1, r2, r3])

    let ok = true
    await act(async () => {
      ok = await result.current.actions.editMovimiento(r2, { monto: 150, cuentaId: 'B' })
    })

    expect(ok).toBe(false)
    expect(result.current.movements).toEqual([r1, r2, r3])
    expect(result.current.actions.error).toBeTruthy()
    expect(result.current.actions.undo.active).toBeNull()
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('edit transfer', () => {
  it('patches both legs and undo restores the previous accounts and amount', async () => {
    const newOrigen = { ...origen, monto: -300, cuenta_id: 'A' }
    const newDestino = { ...destino, monto: 300, cuenta_id: 'C' }
    mocked.updateTransferencia
      .mockResolvedValueOnce([newOrigen, newDestino])
      .mockResolvedValueOnce([origen, destino])
    const { result } = setup([r1, origen, destino, r3])

    await act(async () => {
      await result.current.actions.editTransferencia(origen, destino, { monto: 300, cuentaOrigen: 'A', cuentaDestino: 'C' })
    })
    expect(mocked.updateTransferencia).toHaveBeenCalledWith('t1', { monto: 300, cuentaOrigen: 'A', cuentaDestino: 'C' })
    expect(result.current.movements).toEqual([r1, newOrigen, newDestino, r3])

    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.updateTransferencia).toHaveBeenLastCalledWith('t1', { monto: 200, cuentaOrigen: 'A', cuentaDestino: 'B' })
    expect(result.current.movements).toEqual([r1, origen, destino, r3])
  })

  it('failure leaves both legs unchanged', async () => {
    mocked.updateTransferencia.mockRejectedValue(new Error('rpc missing'))
    const { result } = setup([origen, destino])

    await act(async () => {
      await result.current.actions.editTransferencia(origen, destino, { monto: 300, cuentaOrigen: 'A', cuentaDestino: 'C' })
    })
    expect(result.current.movements).toEqual([origen, destino])
    expect(result.current.actions.error).toBeTruthy()
  })
})

describe('delete regular movement', () => {
  it('removes the row and undo re-inserts it at its original position', async () => {
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockResolvedValue([r2])
    const { result, onChanged } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    expect(mocked.deleteMovimiento).toHaveBeenCalledWith('r2')
    expect(ids(result.current.movements)).toEqual(['r1', 'r3'])
    expect(result.current.actions.undo.active).not.toBeNull()

    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.restoreMovimiento).toHaveBeenCalledWith([r2])
    expect(ids(result.current.movements)).toEqual(['r1', 'r2', 'r3'])
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('failure leaves the list unchanged and surfaces an error', async () => {
    mocked.deleteMovimiento.mockRejectedValue(new Error('nope'))
    const { result } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    expect(ids(result.current.movements)).toEqual(['r1', 'r2', 'r3'])
    expect(result.current.actions.error).toBeTruthy()
    expect(result.current.actions.undo.active).toBeNull()
  })

  it('no undo is available after the window expires', async () => {
    mocked.deleteMovimiento.mockResolvedValue([r2])
    const { result } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS)
    })
    expect(result.current.actions.undo.active).toBeNull()

    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.restoreMovimiento).not.toHaveBeenCalled()
  })

  it('undo failure surfaces an error and leaves the list unchanged', async () => {
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockRejectedValue(new Error('dup'))
    const { result } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(ids(result.current.movements)).toEqual(['r1', 'r3'])
    expect(result.current.actions.error).toBeTruthy()
  })

  it('undo skips re-insertion past the cursor when more pages exist', async () => {
    const cursor: MovimientoCursor = { fecha: '2026-11-10', hora: '12:00:00', createdAt: r3.created_at, id: 'r3' }
    const older = row('old', { fecha: '2026-11-01' })
    mocked.deleteMovimiento.mockResolvedValue([older])
    mocked.restoreMovimiento.mockResolvedValue([older])
    const { result } = setup([r1, r2, r3], { cursor, hasMore: true })

    await act(async () => {
      await result.current.actions.deleteMovimiento(older)
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(ids(result.current.movements)).toEqual(['r1', 'r2', 'r3'])
  })
})

describe('delete transfer', () => {
  it('removes both legs and undo restores both through the RPC', async () => {
    mocked.deleteTransferencia.mockResolvedValue([origen, destino])
    mocked.restoreTransferencia.mockResolvedValue([origen, destino])
    const { result } = setup([r1, origen, destino, r3])

    await act(async () => {
      await result.current.actions.deleteTransferencia('t1')
    })
    expect(mocked.deleteTransferencia).toHaveBeenCalledWith('t1')
    expect(ids(result.current.movements)).toEqual(['r1', 'r3'])

    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.restoreTransferencia).toHaveBeenCalledWith([origen, destino])
    expect(ids(result.current.movements).sort()).toEqual(['d', 'o', 'r1', 'r3'])
    expect(ids(result.current.movements)[0]).toBe('r1')
    expect(ids(result.current.movements)[3]).toBe('r3')
  })

  it('failure keeps both legs', async () => {
    mocked.deleteTransferencia.mockRejectedValue(new Error('legs'))
    const { result } = setup([origen, destino])

    await act(async () => {
      await result.current.actions.deleteTransferencia('t1')
    })
    expect(result.current.movements).toEqual([origen, destino])
    expect(result.current.actions.error).toBeTruthy()
  })
})

describe('single active undo and error handling', () => {
  it('a second action replaces the first undo', async () => {
    mocked.deleteMovimiento.mockResolvedValueOnce([r2]).mockResolvedValueOnce([r3])
    mocked.restoreMovimiento.mockResolvedValue([r3])
    const { result } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    await act(async () => {
      await result.current.actions.deleteMovimiento(r3)
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.restoreMovimiento).toHaveBeenCalledTimes(1)
    expect(mocked.restoreMovimiento).toHaveBeenCalledWith([r3])
  })

  it('clearError resets the error and a later success clears it', async () => {
    mocked.deleteMovimiento.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([r2])
    const { result } = setup([r1, r2])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    expect(result.current.actions.error).toBeTruthy()

    act(() => result.current.actions.clearError())
    expect(result.current.actions.error).toBeNull()

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    expect(result.current.actions.error).toBeNull()
  })
})

describe('undo retry after failure', () => {
  it('keeps the undo available after a failed restore and a retry succeeds', async () => {
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockRejectedValueOnce(new Error('dup')).mockResolvedValueOnce([r2])
    const { result, onChanged } = setup([r1, r2, r3])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(result.current.actions.error).toBeTruthy()
    expect(result.current.actions.undo.active).toEqual({ label: 'Movimiento eliminado' })
    expect(ids(result.current.movements)).toEqual(['r1', 'r3'])

    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(mocked.restoreMovimiento).toHaveBeenCalledTimes(2)
    expect(ids(result.current.movements)).toEqual(['r1', 'r2', 'r3'])
    expect(result.current.actions.error).toBeNull()
    expect(result.current.actions.undo.active).toBeNull()
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('keeps the undo available after a failed transfer edit undo', async () => {
    mocked.updateTransferencia
      .mockResolvedValueOnce([origen, destino])
      .mockRejectedValueOnce(new Error('rpc'))
    const { result } = setup([origen, destino])

    await act(async () => {
      await result.current.actions.editTransferencia(origen, destino, { monto: 200, cuentaOrigen: 'A', cuentaDestino: 'B' })
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(result.current.actions.undo.active).not.toBeNull()
  })
})

describe('error logging', () => {
  it('logs the original error when an edit fails', async () => {
    const boom = new Error('rls denied')
    mocked.updateMovimiento.mockRejectedValue(boom)
    const { result } = setup([r1, r2])

    await act(async () => {
      await result.current.actions.editMovimiento(r2, { monto: 1, cuentaId: 'A' })
    })
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), boom)
  })

  it('logs the original error when a delete fails', async () => {
    const boom = new Error('fk violation')
    mocked.deleteTransferencia.mockRejectedValue(boom)
    const { result } = setup([origen, destino])

    await act(async () => {
      await result.current.actions.deleteTransferencia('t1')
    })
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), boom)
  })

  it('logs the original error when an undo fails', async () => {
    const boom = new Error('duplicate key')
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockRejectedValue(boom)
    const { result } = setup([r1, r2])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    await act(async () => {
      await result.current.actions.undo.run()
    })
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), boom)
  })

  it('does not log on success', async () => {
    mocked.deleteMovimiento.mockResolvedValue([r2])
    const { result } = setup([r1, r2])

    await act(async () => {
      await result.current.actions.deleteMovimiento(r2)
    })
    expect(consoleError).not.toHaveBeenCalled()
  })
})

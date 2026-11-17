import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: Array<{ method: string; args: unknown[] }> = []
let result: { data: unknown; error: unknown } = { data: null, error: null }

function chain(): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) => resolve(result)
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
          return proxy
        }
      },
    },
  )
  return proxy
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      calls.push({ method: 'from', args })
      return chain()
    },
    rpc: (...args: unknown[]) => {
      calls.push({ method: 'rpc', args })
      return chain()
    },
  }),
}))

import {
  deleteMovimiento,
  deleteTransferencia,
  restoreMovimiento,
  restoreTransferencia,
  updateMovimiento,
  updateTransferencia,
  type Movimiento,
} from './movement-service'

const row = (over: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  monto: -100,
  fecha: '2026-11-01',
  hora: '10:00:00',
  cuenta_id: 'A',
  categoria_id: 'c1',
  created_at: '2026-11-01T10:00:00Z',
  ...over,
})

const findCall = (method: string) => calls.find((c) => c.method === method)

beforeEach(() => {
  calls.length = 0
  result = { data: null, error: null }
})

describe('updateMovimiento', () => {
  it('keeps the original sign for negative rows (expense -100 -> input 150 = -150)', async () => {
    result = { data: [row({ monto: -150, cuenta_id: 'B' })], error: null }
    const out = await updateMovimiento(row(), { monto: 150, cuentaId: 'B' })

    expect(findCall('from')?.args).toEqual(['movimiento'])
    expect(findCall('update')?.args).toEqual([{ monto: -150, cuenta_id: 'B' }])
    expect(findCall('eq')?.args).toEqual(['id', 'm1'])
    expect(out).toEqual(row({ monto: -150, cuenta_id: 'B' }))
  })

  it('keeps a positive sign for income rows and ignores input sign', async () => {
    result = { data: [row({ monto: 80 })], error: null }
    await updateMovimiento(row({ monto: 50 }), { monto: -80, cuentaId: 'A' })
    expect(findCall('update')?.args).toEqual([{ monto: 80, cuenta_id: 'A' }])
  })

  it('throws the supabase error', async () => {
    const err = new Error('rls')
    result = { data: null, error: err }
    await expect(updateMovimiento(row(), { monto: 1, cuentaId: 'A' })).rejects.toBe(err)
  })

  it('throws when no row was updated (missing row or policy)', async () => {
    result = { data: [], error: null }
    await expect(updateMovimiento(row(), { monto: 1, cuentaId: 'A' })).rejects.toThrow(/not updated/i)
  })
})

describe('deleteMovimiento', () => {
  it('deletes by id and returns the deleted rows', async () => {
    result = { data: [row()], error: null }
    const out = await deleteMovimiento('m1')

    expect(findCall('delete')).toBeDefined()
    expect(findCall('eq')?.args).toEqual(['id', 'm1'])
    expect(out).toEqual([row()])
  })

  it('throws the supabase error', async () => {
    const err = new Error('boom')
    result = { data: null, error: err }
    await expect(deleteMovimiento('m1')).rejects.toBe(err)
  })

  it('throws when nothing was deleted', async () => {
    result = { data: [], error: null }
    await expect(deleteMovimiento('m1')).rejects.toThrow(/not deleted/i)
  })
})

describe('restoreMovimiento', () => {
  it('re-inserts rows with their original id and created_at', async () => {
    const rows = [row()]
    result = { data: rows, error: null }
    const out = await restoreMovimiento(rows)

    expect(findCall('insert')?.args).toEqual([rows])
    expect(out).toEqual(rows)
  })

  it('throws the supabase error', async () => {
    const err = new Error('dup')
    result = { data: null, error: err }
    await expect(restoreMovimiento([row()])).rejects.toBe(err)
  })
})

describe('transfer RPCs', () => {
  it('updateTransferencia calls the RPC with abs monto and both accounts', async () => {
    const legs = [row({ monto: -300 }), row({ id: 'm2', monto: 300, cuenta_id: 'C' })]
    result = { data: legs, error: null }
    const out = await updateTransferencia('t1', { monto: -300, cuentaOrigen: 'A', cuentaDestino: 'C' })

    expect(findCall('rpc')?.args).toEqual([
      'update_transferencia',
      { p_transferencia_id: 't1', p_monto: 300, p_cuenta_origen: 'A', p_cuenta_destino: 'C' },
    ])
    expect(out).toEqual(legs)
  })

  it('updateTransferencia throws the rpc error', async () => {
    const err = new Error('function not found')
    result = { data: null, error: err }
    await expect(
      updateTransferencia('t1', { monto: 1, cuentaOrigen: 'A', cuentaDestino: 'B' }),
    ).rejects.toBe(err)
  })

  it('deleteTransferencia returns the deleted legs', async () => {
    const legs = [row({ monto: -200 }), row({ id: 'm2', monto: 200 })]
    result = { data: legs, error: null }
    const out = await deleteTransferencia('t1')

    expect(findCall('rpc')?.args).toEqual(['delete_transferencia', { p_transferencia_id: 't1' }])
    expect(out).toEqual(legs)
  })

  it('deleteTransferencia throws the rpc error', async () => {
    const err = new Error('legs != 2')
    result = { data: null, error: err }
    await expect(deleteTransferencia('t1')).rejects.toBe(err)
  })

  it('restoreTransferencia sends the legs as p_rows', async () => {
    const legs = [row({ monto: -200 }), row({ id: 'm2', monto: 200 })]
    result = { data: legs, error: null }
    const out = await restoreTransferencia(legs)

    expect(findCall('rpc')?.args).toEqual(['restore_transferencia', { p_rows: legs }])
    expect(out).toEqual(legs)
  })

  it('restoreTransferencia throws the rpc error', async () => {
    const err = new Error('dup key')
    result = { data: null, error: err }
    await expect(restoreTransferencia([row()])).rejects.toBe(err)
  })
})

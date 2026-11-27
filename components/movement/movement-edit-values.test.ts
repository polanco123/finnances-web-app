import { describe, expect, it } from 'vitest'
import { deriveEditInitialValues, toEditPayload } from './movement-edit-values'
import type { Movimiento } from './movement-service'

const row = (over: Partial<Movimiento>): Movimiento => ({
  id: 'x',
  monto: -100.5,
  fecha: '2026-11-10',
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: '2026-11-10T12:00:00Z',
  ...over,
})

describe('deriveEditInitialValues', () => {
  it('derives gasto from a negative amount with an absolute monto string', () => {
    expect(deriveEditInitialValues({ kind: 'movimiento', row: row({}) })).toEqual({
      tipo: 'gasto',
      monto: '100.5',
      cuentaId: 'A',
    })
  })

  it('derives ingreso from a positive amount', () => {
    expect(deriveEditInitialValues({ kind: 'movimiento', row: row({ monto: 50, cuenta_id: 'B' }) })).toEqual({
      tipo: 'ingreso',
      monto: '50',
      cuentaId: 'B',
    })
  })

  it('derives transferencia from the pair', () => {
    const origen = row({ monto: -200, cuenta_id: 'A', es_transferencia: true, transferencia_id: 't' })
    const destino = row({ monto: 200, cuenta_id: 'B', es_transferencia: true, transferencia_id: 't' })
    expect(deriveEditInitialValues({ kind: 'transfer', origen, destino })).toEqual({
      tipo: 'transferencia',
      monto: '200',
      cuentaOrigenId: 'A',
      cuentaDestinoId: 'B',
    })
  })
})

describe('toEditPayload', () => {
  it('maps a regular submission to monto + cuentaId', () => {
    expect(toEditPayload({ tipo: 'gasto', monto: 150, cuentaId: 'B' })).toEqual({ monto: 150, cuentaId: 'B' })
  })

  it('maps a transfer submission to origen/destino', () => {
    expect(
      toEditPayload({ tipo: 'transferencia', monto: 300, cuentaOrigenId: 'A', cuentaDestinoId: 'C' }),
    ).toEqual({ monto: 300, cuentaOrigen: 'A', cuentaDestino: 'C' })
  })
})

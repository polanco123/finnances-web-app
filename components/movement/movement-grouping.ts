import type { Movimiento } from './movement-service'

export type DisplayItem =
  | { kind: 'movimiento'; data: Movimiento }
  | { kind: 'merged-transfer'; transferenciaId: string; origen: Movimiento; destino: Movimiento }

export function groupMovimientos(movimientos: Movimiento[]): DisplayItem[] {
  const pairs = new Map<string, Movimiento[]>()

  for (const row of movimientos) {
    if (!row.es_transferencia || !row.transferencia_id) continue
    const existing = pairs.get(row.transferencia_id)
    if (existing) {
      existing.push(row)
    } else {
      pairs.set(row.transferencia_id, [row])
    }
  }

  const emitted = new Set<string>()
  const result: DisplayItem[] = []

  for (const row of movimientos) {
    if (!row.es_transferencia || !row.transferencia_id) {
      result.push({ kind: 'movimiento', data: row })
      continue
    }

    const pair = pairs.get(row.transferencia_id)

    if (pair && pair.length === 2 && !emitted.has(row.transferencia_id)) {
      const origen = pair[0].monto < 0 ? pair[0] : pair[1]
      const destino = pair[0].monto < 0 ? pair[1] : pair[0]
      emitted.add(row.transferencia_id)
      result.push({
        kind: 'merged-transfer',
        transferenciaId: row.transferencia_id,
        origen,
        destino,
      })
      continue
    }

    if (emitted.has(row.transferencia_id)) continue

    result.push({ kind: 'movimiento', data: row })
  }

  return result
}

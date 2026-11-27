import type { Movimiento, MovimientoEdit, TransferenciaEdit } from './movement-service'

export type EditTarget =
  | { kind: 'movimiento'; row: Movimiento }
  | { kind: 'transfer'; origen: Movimiento; destino: Movimiento }

export type EditTipo = 'gasto' | 'ingreso' | 'transferencia'

export interface EditInitialValues {
  tipo: EditTipo
  monto: string
  cuentaId?: string
  cuentaOrigenId?: string
  cuentaDestinoId?: string
}

export interface EditSubmission {
  tipo: EditTipo
  monto: number
  cuentaId?: string
  cuentaOrigenId?: string
  cuentaDestinoId?: string
}

/** The form tab is derived from the row (sign / transfer), never chosen in edit mode. */
export function deriveEditInitialValues(target: EditTarget): EditInitialValues {
  if (target.kind === 'transfer') {
    return {
      tipo: 'transferencia',
      monto: String(Math.abs(target.origen.monto)),
      cuentaOrigenId: target.origen.cuenta_id,
      cuentaDestinoId: target.destino.cuenta_id,
    }
  }
  const { row } = target
  return {
    tipo: row.monto < 0 ? 'gasto' : 'ingreso',
    monto: String(Math.abs(row.monto)),
    cuentaId: row.cuenta_id,
  }
}

export function toEditPayload(values: EditSubmission): MovimientoEdit | TransferenciaEdit {
  if (values.tipo === 'transferencia') {
    return {
      monto: values.monto,
      cuentaOrigen: values.cuentaOrigenId as string,
      cuentaDestino: values.cuentaDestinoId as string,
    }
  }
  return { monto: values.monto, cuentaId: values.cuentaId as string }
}

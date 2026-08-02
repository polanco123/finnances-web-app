/**
 * Hardcoded Diversión personal categoria ID.
 * Matches data/categoria.ts → af6b676c-04db-4fda-b9f7-349123d75e1a
 */
export const DIVERSION_CATEGORIA_ID = 'af6b676c-04db-4fda-b9f7-349123d75e1a'

/** Payload shape for inserting a movimiento row. */
export interface MovimientoInsert {
  monto: number
  descripcion: string
  fecha: string
  hora: string | null
  cuenta_id: string
  categoria_id: string
  msi_id: string | null
  transferencia_id: string | null
  es_transferencia: boolean
  es_ajuste: boolean
  fuente: string
  notas: string | null
}

/**
 * Builds a Diversión personal gasto movimiento payload.
 *
 * Forces `monto = -Math.abs(Number(monto))` so the sign is always negative
 * (gasto), matching the existing `movement-mapper.js` sign convention where
 * negative = expense and positive = income/refund.
 *
 * Hardcodes `categoria_id` to the Diversión personal category and sets
 * sensible defaults for all other movimiento fields.
 */
export function crearGastoDiversion({
  cuenta_id,
  monto,
  fecha,
}: {
  cuenta_id: string
  monto: number
  fecha: string
}): MovimientoInsert {
  return {
    monto: -Math.abs(Number(monto)),
    descripcion: '',
    fecha,
    hora: null,
    cuenta_id,
    categoria_id: DIVERSION_CATEGORIA_ID,
    msi_id: null,
    transferencia_id: null,
    es_transferencia: false,
    es_ajuste: false,
    fuente: 'manual',
    notas: null,
  }
}

import { createClient } from '@/lib/supabase/client'

export interface MovimientoCursor {
  fecha: string
  hora: string | null
  createdAt: string
  id: string
}

export interface Movimiento {
  id: string
  monto: number
  descripcion?: string | null
  fecha: string
  hora?: string | null
  cuenta_id: string
  categoria_id: string
  notas?: string | null
  created_at: string
  es_transferencia?: boolean | null
  transferencia_id?: string | null
  msi_id?: string | number | null
}

export interface MovimientosPage {
  movimientos: Movimiento[]
  nextCursor: MovimientoCursor | null
  hasMore: boolean
}

const SELECT_FIELDS =
  'id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id, msi_id'

/**
 * Builds the PostgREST `.or()` predicate for "strictly before `cursor` in
 * `fecha DESC, hora DESC NULLS LAST, created_at DESC, id DESC` order" —
 * i.e. the next page's rows. `hora` can be null (legacy rows), and with
 * NULLS LAST a null `hora` sorts after every non-null value within the same
 * `fecha`, so a non-null `cursor.hora` must also match null-`hora` rows.
 */
function buildCursorFilter(cursor: MovimientoCursor): string {
  const { fecha, hora, createdAt, id } = cursor
  const horaMatch = hora === null ? 'hora.is.null' : `hora.eq.${hora}`

  const clauses = [
    `fecha.lt.${fecha}`,
    // NULLS LAST: a null hora sorts after every non-null hora within the
    // same fecha, so only a non-null cursor.hora needs this "any null row
    // is further along" clause — if the cursor itself is null-hora, its
    // only remaining tiebreak is created_at/id among other null-hora rows.
    ...(hora !== null ? [`and(fecha.eq.${fecha},hora.is.null)`, `and(fecha.eq.${fecha},hora.lt.${hora})`] : []),
    `and(fecha.eq.${fecha},${horaMatch},created_at.lt.${createdAt})`,
    `and(fecha.eq.${fecha},${horaMatch},created_at.eq.${createdAt},id.lt.${id})`,
  ]

  return clauses.join(',')
}

export async function fetchMovimientosPage(
  cursor: MovimientoCursor | null,
  pageSize: number = 10,
): Promise<MovimientosPage> {
  const supabase = createClient()
  let query = supabase
    .from('movimiento')
    .select(SELECT_FIELDS)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(buildCursorFilter(cursor))
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last
    ? { fecha: last.fecha, hora: last.hora ?? null, createdAt: last.created_at, id: last.id }
    : null

  return { movimientos: page, nextCursor, hasMore }
}

export async function insertarMovimiento(movimiento: Record<string, unknown>): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('movimiento')
    .insert(movimiento)
    .select()
  if (error) throw error
  return data
}

export async function insertarTransferencia(
  movimientoOrigen: Record<string, unknown>,
  movimientoDestino: Record<string, unknown>,
): Promise<{ origen: Movimiento[]; destino: Movimiento[] }> {
  const supabase = createClient()
  const { data: dataOrigen, error: errorOrigen } = await supabase
    .from('movimiento')
    .insert(movimientoOrigen)
    .select()
  if (errorOrigen) throw errorOrigen
  const { data: dataDestino, error: errorDestino } = await supabase
    .from('movimiento')
    .insert(movimientoDestino)
    .select()
  if (errorDestino) throw errorDestino
  return { origen: dataOrigen, destino: dataDestino }
}

export interface MovimientoEdit {
  monto: number
  cuentaId: string
}

export interface TransferenciaEdit {
  monto: number
  cuentaOrigen: string
  cuentaDestino: string
}

/** Edited amount keeps the sign of the original row (type change is out of scope). */
export async function updateMovimiento(original: Movimiento, edit: MovimientoEdit): Promise<Movimiento> {
  const supabase = createClient()
  const sign = original.monto < 0 ? -1 : 1
  const { data, error } = await supabase
    .from('movimiento')
    .update({ monto: sign * Math.abs(edit.monto), cuenta_id: edit.cuentaId })
    .eq('id', original.id)
    .select(SELECT_FIELDS)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Movement not updated')
  return data[0]
}

/**
 * Returns the deleted rows (every column) so the caller can restore them
 * (undo) without losing columns that are not part of `SELECT_FIELDS`.
 */
export async function deleteMovimiento(id: string): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('movimiento')
    .delete()
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Movement not deleted')
  return data
}

/** Re-inserts full rows keeping their original id and created_at. */
export async function restoreMovimiento(rows: Movimiento[]): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('movimiento')
    .insert(rows)
    .select()
  if (error) throw error
  return data ?? []
}

export async function updateTransferencia(
  transferenciaId: string,
  edit: TransferenciaEdit,
): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('update_transferencia', {
    p_transferencia_id: transferenciaId,
    p_monto: Math.abs(edit.monto),
    p_cuenta_origen: edit.cuentaOrigen,
    p_cuenta_destino: edit.cuentaDestino,
  })
  if (error) throw error
  return data ?? []
}

/** Returns both deleted legs so the caller can restore them (undo). */
export async function deleteTransferencia(transferenciaId: string): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('delete_transferencia', {
    p_transferencia_id: transferenciaId,
  })
  if (error) throw error
  return data ?? []
}

export async function restoreTransferencia(rows: Movimiento[]): Promise<Movimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('restore_transferencia', { p_rows: rows })
  if (error) throw error
  return data ?? []
}

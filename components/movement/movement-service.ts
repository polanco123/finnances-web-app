import { createClient } from '@/lib/supabase/client'

export interface MovimientoCursor {
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
}

export interface MovimientosPage {
  movimientos: Movimiento[]
  nextCursor: MovimientoCursor | null
  hasMore: boolean
}

const SELECT_FIELDS =
  'id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id'

export async function fetchMovimientosPage(
  cursor: MovimientoCursor | null,
  pageSize: number = 10,
): Promise<MovimientosPage> {
  const supabase = createClient()
  let query = supabase
    .from('movimiento')
    .select(SELECT_FIELDS)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? { createdAt: last.created_at, id: last.id } : null

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

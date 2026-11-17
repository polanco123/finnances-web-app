import type { Movimiento, MovimientoCursor } from './movement-service'

interface SortKey {
  fecha: string
  hora?: string | null
  created_at: string
  id: string
}

/** Descending comparison; negative when `a` comes before `b` in the page order. */
function desc(a: string, b: string): number {
  return a === b ? 0 : a > b ? -1 : 1
}

/**
 * Same order as the paginated query:
 * `fecha desc, hora desc nulls last, created_at desc, id desc`.
 */
function compareKeys(a: SortKey, b: SortKey): number {
  const byFecha = desc(a.fecha, b.fecha)
  if (byFecha !== 0) return byFecha

  const aHora = a.hora ?? null
  const bHora = b.hora ?? null
  if (aHora !== bHora) {
    if (aHora === null) return 1
    if (bHora === null) return -1
    return desc(aHora, bHora)
  }

  return desc(a.created_at, b.created_at) || desc(a.id, b.id)
}

export function compareMovimiento(a: Movimiento, b: Movimiento): number {
  return compareKeys(a, b)
}

function cursorKey(cursor: MovimientoCursor): SortKey {
  return { fecha: cursor.fecha, hora: cursor.hora, created_at: cursor.createdAt, id: cursor.id }
}

export function removeByIds(rows: Movimiento[], ids: string[]): Movimiento[] {
  const remove = new Set(ids)
  return rows.filter((row) => !remove.has(row.id))
}

/** Replaces rows in place by id; unknown ids are ignored. Order is preserved. */
export function replaceRows(rows: Movimiento[], updated: Movimiento[]): Movimiento[] {
  const byId = new Map(updated.map((row) => [row.id, row]))
  return rows.map((row) => byId.get(row.id) ?? row)
}

interface PagingState {
  cursor: MovimientoCursor | null
  hasMore: boolean
}

/**
 * Inserts rows at their query-order position. A row that sorts after the
 * cursor while more pages exist is skipped: the next page will return it.
 * Rows already present are not duplicated.
 */
export function insertSorted(
  rows: Movimiento[],
  toInsert: Movimiento[],
  { cursor, hasMore }: PagingState,
): Movimiento[] {
  const result = [...rows]

  for (const row of toInsert) {
    if (result.some((existing) => existing.id === row.id)) continue
    if (hasMore && cursor && compareKeys(row, cursorKey(cursor)) > 0) continue

    const index = result.findIndex((existing) => compareMovimiento(row, existing) < 0)
    result.splice(index === -1 ? result.length : index, 0, row)
  }

  return result
}

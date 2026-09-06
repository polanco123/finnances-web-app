import { createClient } from '@/lib/supabase/client'
import { fetchMovimientosEnPeriodo } from '@/components/categorias/categorias-service'
import { getRangoDelMes, getMesAnterior } from '@/components/presupuestos/presupuestos-dates'

/** Postgres unique_violation error code. */
const PG_UNIQUE_VIOLATION = '23505'

export interface Presupuesto {
  id: string
  categoriaId: string
  monto: number
  anio: number
  mes: number
  createdAt: string
}

/** Domain error for the (user_id, categoria_id, anio, mes) duplicate. */
export class PresupuestoDuplicadoError extends Error {}

/** Presupuesto + client-side computed gasto. Never persisted. */
export interface PresupuestoConGasto extends Presupuesto {
  gastado: number
  porcentaje: number
  excedente: number
}

interface PresupuestoRow {
  id: string
  categoria_id: string
  monto: number
  anio: number
  mes: number
  created_at: string
}

function mapRow(row: PresupuestoRow): Presupuesto {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    monto: row.monto,
    anio: row.anio,
    mes: row.mes,
    createdAt: row.created_at,
  }
}

/** Mirrors `diversion-service.ts`'s `requireUserId` exactly. */
async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user.id
}

/**
 * SELECT * FROM presupuesto WHERE user_id=:userId AND anio=:anio AND mes=:mes
 *
 * Explicit `.eq('user_id', userId)` in addition to RLS — with RLS active a
 * query that forgets the filter does not fail, it silently returns 0 rows;
 * explicit filters make that bug visible in code review, not only at runtime.
 *
 * @throws On Supabase error
 */
export async function fetchPresupuestosDelMes(anio: number, mes: number): Promise<Presupuesto[]> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('presupuesto')
    .select('id, categoria_id, monto, anio, mes, created_at')
    .eq('user_id', userId)
    .eq('anio', anio)
    .eq('mes', mes)

  if (error) throw error
  return (data ?? []).map(mapRow)
}

/**
 * Reuses `fetchMovimientosEnPeriodo` (no `user_id` filter — `movimiento` is
 * single-user real, see design.md's Architecture Decisions). Aggregates
 * `SUM(ABS(monto))` per `categoria_id`, restricted to `categoriaIds`.
 * A category with no matching movimiento resolves to `0`, never throws.
 *
 * @throws On Supabase error
 */
export async function fetchGastoPorCategorias(
  categoriaIds: string[],
  anio: number,
  mes: number,
): Promise<Map<string, number>> {
  const { desde, hasta } = getRangoDelMes(anio, mes)
  const movimientos = await fetchMovimientosEnPeriodo(desde, hasta)

  const gastoPorCategoria = new Map<string, number>()
  for (const categoriaId of categoriaIds) {
    gastoPorCategoria.set(categoriaId, 0)
  }

  for (const mov of movimientos) {
    if (!gastoPorCategoria.has(mov.categoria_id)) continue
    const acumulado = gastoPorCategoria.get(mov.categoria_id) ?? 0
    gastoPorCategoria.set(mov.categoria_id, acumulado + Math.abs(mov.monto))
  }

  return gastoPorCategoria
}

/** Pure, no Supabase call. */
export function computePresupuestoConGasto(presupuesto: Presupuesto, gastado: number): PresupuestoConGasto {
  const porcentaje = presupuesto.monto > 0 ? (gastado / presupuesto.monto) * 100 : 0
  const excedente = Math.max(0, gastado - presupuesto.monto)
  return { ...presupuesto, gastado, porcentaje, excedente }
}

/**
 * Plain `INSERT`. NEVER modifies an existing presupuesto: if one already
 * exists for (user_id, categoria_id, anio, mes), Postgres rejects with
 * `23505` and this function translates it to `PresupuestoDuplicadoError` so
 * the UI can show the error while leaving the already-saved monto untouched.
 *
 * @throws {PresupuestoDuplicadoError} On unique constraint violation
 * @throws On any other Supabase error
 */
export async function crearPresupuesto(
  categoriaId: string,
  monto: number,
  anio: number,
  mes: number,
): Promise<Presupuesto> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('presupuesto')
    .insert({ user_id: userId, categoria_id: categoriaId, monto, anio, mes })
    .select('id, categoria_id, monto, anio, mes, created_at')
    .single()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new PresupuestoDuplicadoError('Ya existe un presupuesto para esta categoría en este mes')
    }
    throw error
  }

  return mapRow(data)
}

/** UPDATE presupuesto SET monto WHERE id=:id AND user_id=:userId */
export async function updatePresupuestoMonto(id: string, monto: number): Promise<Presupuesto> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('presupuesto')
    .update({ monto })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, categoria_id, monto, anio, mes, created_at')
    .single()

  if (error) throw error
  return mapRow(data)
}

/**
 * DELETE FROM presupuesto WHERE id=:id AND user_id=:userId — hard delete.
 * There is no `activa` column and no soft-delete path in this domain.
 *
 * @throws On Supabase error
 */
export async function eliminarPresupuesto(id: string): Promise<void> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { error } = await supabase
    .from('presupuesto')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Copies the previous month's presupuestos into the destination month,
 * excluding categorías that already have a presupuesto in the destination
 * BEFORE inserting. With a plain `INSERT` (no `ON CONFLICT`) this filter is
 * what guarantees no insert collides with the unique constraint — without
 * it, copying onto a partially-budgeted month would abort on the first
 * duplicate instead of copying what's missing.
 *
 * @throws On Supabase error
 */
export async function copiarPresupuestosMesAnterior(anio: number, mes: number): Promise<Presupuesto[]> {
  const anterior = getMesAnterior(anio, mes)

  const [origen, destino] = await Promise.all([
    fetchPresupuestosDelMes(anterior.anio, anterior.mes),
    fetchPresupuestosDelMes(anio, mes),
  ])

  const porCopiar = origen.filter(
    (p) => !destino.some((d) => d.categoriaId === p.categoriaId),
  )

  const copiados: Presupuesto[] = []
  for (const presupuesto of porCopiar) {
    const creado = await crearPresupuesto(presupuesto.categoriaId, presupuesto.monto, anio, mes)
    copiados.push(creado)
  }

  return copiados
}

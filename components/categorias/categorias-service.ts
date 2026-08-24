// TODO: Verify movimiento RLS/grants against live Supabase before final deployment.
// If queries return permissions errors, run in Supabase SQL Editor:
//   GRANT SELECT ON public.movimiento TO authenticated;

import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS, esCategoriaDeGasto } from '@/data/categoria'
import type { Categoria } from '@/data/categoria'

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

export interface CategoriaConGasto {
  categoriaId: string
  nombre: string
  icono: string | null
  total: number
  count: number
  porcentaje: number
  movimientos: Movimiento[]
}

/**
 * Fetches all gasto movimientos (`monto < 0`) dated within `[desde, hasta]`
 * (inclusive both ends).
 *
 * No `user_id` filter — the `movimiento` table does not have a `user_id`
 * column and is single-user at the data-model level. One bounded fetch,
 * no pagination — caller-supplied range is expected to stay reasonably
 * small (single period at a time).
 *
 * @throws On Supabase error
 */
export async function fetchMovimientosEnPeriodo(desde: string, hasta: string): Promise<Movimiento[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .select('id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .lt('monto', 0)

  if (error) throw error
  return data ?? []
}

/**
 * Aggregates gasto movimientos in `[desde, hasta]` per gasto category
 * (`tipo` IN `('compromiso','discrecional','suscripcion','trabajo','hogar')`
 * — see `esCategoriaDeGasto`), sorted descending by total spend.
 *
 * 100% client-side filtering/aggregation against the static `data/categoria.ts`
 * catalog — no RPC, no server-side GROUP BY, same architecture as
 * `patrimonio-service.ts`'s `fetchCategoriasDelMes()`.
 *
 * @throws On Supabase error
 */
export async function fetchCategoriasConGasto(desde: string, hasta: string): Promise<CategoriaConGasto[]> {
  const movimientos = await fetchMovimientosEnPeriodo(desde, hasta)

  const buckets = new Map<string, { total: number; count: number; movimientos: Movimiento[] }>()

  for (const mov of movimientos) {
    const categoria = CATEGORIAS.find((c) => c.id === mov.categoria_id)
    if (!categoria || !esCategoriaDeGasto(categoria.tipo)) continue

    const bucket = buckets.get(mov.categoria_id) ?? { total: 0, count: 0, movimientos: [] }
    bucket.total += Math.abs(mov.monto)
    bucket.count += 1
    bucket.movimientos.push(mov)
    buckets.set(mov.categoria_id, bucket)
  }

  const sumaTotal = Array.from(buckets.values()).reduce((sum, b) => sum + b.total, 0)

  const categorias: CategoriaConGasto[] = Array.from(buckets.entries()).map(([categoriaId, bucket]) => {
    const categoria = CATEGORIAS.find((c) => c.id === categoriaId)
    const nombre = categoria?.nombre ?? 'Sin categoría'
    const icono = categoria?.icono ?? null
    return {
      categoriaId,
      nombre,
      icono,
      total: bucket.total,
      count: bucket.count,
      porcentaje: sumaTotal > 0 ? Math.round((bucket.total / sumaTotal) * 100) : 0,
      movimientos: bucket.movimientos,
    }
  })

  return categorias.sort((a, b) => b.total - a.total)
}

/**
 * Updates the `icono` field for a single categoria.
 *
 * No `user_id` filter — the `categoria` table does not have a `user_id`
 * column and is single-user at the data-model level.
 *
 * @param id    The categoria UUID to update
 * @param icono The new icon name (must be a key of `ICON_CATALOG`)
 * @returns The updated categoria row
 * @throws On Supabase error
 */
export async function updateCategoriaIcono(id: string, icono: string): Promise<Categoria> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('categoria')
    .update({ icono })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

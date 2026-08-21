import { createClient } from '@/lib/supabase/client'

export interface Meta {
  id: string
  nombre: string
  montoObjetivo: number
  montoInicial: number
  fechaObjetivo: string | null // ISO date, nullable
  activa: boolean
  createdAt: string
}

export interface MetaAbono {
  id: string
  metaId: string
  monto: number // signed: positive = contribution, negative = withdrawal
  fecha: string // ISO date, required
  nota: string | null
  createdAt: string
}

/** Meta + client-computed progress. Never persisted — recomputed on every render from `meta` + `meta_abono`. */
export interface MetaConProgreso extends Meta {
  montoActual: number // montoInicial + SUM(abonos.monto)
  porcentaje: number // montoActual / montoObjetivo * 100 — may exceed 100 or be negative
  cumplida: boolean // montoActual >= montoObjetivo
}

/** Maps a raw snake_case `meta` row to the camelCase `Meta` shape. */
function mapMeta(row: Record<string, unknown>): Meta {
  return {
    id: row.id as string,
    nombre: row.nombre as string,
    montoObjetivo: row.monto_objetivo as number,
    montoInicial: row.monto_inicial as number,
    fechaObjetivo: (row.fecha_objetivo as string | null) ?? null,
    activa: row.activa as boolean,
    createdAt: row.created_at as string,
  }
}

/** Maps a raw snake_case `meta_abono` row to the camelCase `MetaAbono` shape. */
function mapMetaAbono(row: Record<string, unknown>): MetaAbono {
  return {
    id: row.id as string,
    metaId: row.meta_id as string,
    monto: row.monto as number,
    fecha: row.fecha as string,
    nota: (row.nota as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/**
 * Fetches all active goals.
 *
 * @returns Array of active `meta` rows ordered by `nombre` ascending — empty array if none found
 * @throws On Supabase error
 */
export async function fetchActiveMetas(): Promise<Meta[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('meta')
    .select('*')
    .eq('activa', true)
    .order('nombre', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapMeta)
}

/**
 * Fetches every `meta_abono` row belonging to any of the given goal ids, in
 * one bounded query — one bounded fetch for all goals' abonos, matching this
 * project's "one bounded fetch + client-side aggregation" convention.
 *
 * @param metaIds The goals' UUIDs to fetch abonos for
 * @returns All matching `meta_abono` rows, ordered by `fecha` ascending — empty array if `metaIds` is empty
 * @throws On Supabase error
 */
export async function fetchAbonosPorMetas(metaIds: string[]): Promise<MetaAbono[]> {
  if (metaIds.length === 0) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('meta_abono')
    .select('*')
    .in('meta_id', metaIds)
    .order('fecha', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapMetaAbono)
}

/**
 * Pure, no Supabase call. `abonos` MUST already be filtered to this meta's id.
 *
 * @param meta   The goal to compute progress for
 * @param abonos This goal's own `meta_abono` entries only
 * @returns The goal enriched with `montoActual`, `porcentaje`, and `cumplida`
 */
export function computeProgreso(meta: Meta, abonos: MetaAbono[]): MetaConProgreso {
  const montoActual = meta.montoInicial + abonos.reduce((sum, a) => sum + a.monto, 0)
  const porcentaje = meta.montoObjetivo > 0 ? (montoActual / meta.montoObjetivo) * 100 : 0
  return { ...meta, montoActual, porcentaje, cumplida: montoActual >= meta.montoObjetivo }
}

/**
 * Creates a brand-new `meta` row.
 *
 * @param nombre         Goal name
 * @param montoObjetivo  Target amount
 * @param montoInicial   Starting amount (may be non-zero)
 * @param fechaObjetivo  Optional target date, ISO date or `null`
 * @returns The created row (`activa=true` by default)
 * @throws On Supabase error
 */
export async function crearMeta(
  nombre: string,
  montoObjetivo: number,
  montoInicial: number,
  fechaObjetivo: string | null,
): Promise<Meta> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('meta')
    .insert({
      nombre,
      monto_objetivo: montoObjetivo,
      monto_inicial: montoInicial,
      fecha_objetivo: fechaObjetivo,
    })
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo crear la meta')
  }
  return mapMeta(data[0])
}

/**
 * Updates fields on a known, existing `meta` row — by `id`.
 *
 * @param id      The `meta` row's UUID
 * @param updates Partial fields to update
 * @returns The updated row
 * @throws On Supabase error
 */
export async function updateMeta(
  id: string,
  updates: Partial<Pick<Meta, 'nombre' | 'montoObjetivo' | 'montoInicial' | 'fechaObjetivo'>>,
): Promise<Meta> {
  const supabase = createClient()

  const payload: Record<string, unknown> = {}
  if (updates.nombre !== undefined) payload.nombre = updates.nombre
  if (updates.montoObjetivo !== undefined) payload.monto_objetivo = updates.montoObjetivo
  if (updates.montoInicial !== undefined) payload.monto_inicial = updates.montoInicial
  if (updates.fechaObjetivo !== undefined) payload.fecha_objetivo = updates.fechaObjetivo

  const { data, error } = await supabase.from('meta').update(payload).eq('id', id).select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró la meta para actualizar')
  }
  return mapMeta(data[0])
}

/**
 * Soft-deletes a goal by setting `activa = false` — no hard `DELETE` is ever
 * issued on `meta`.
 *
 * @param id The `meta` row's UUID
 * @returns The updated row
 * @throws On Supabase error
 */
export async function archivarMeta(id: string): Promise<Meta> {
  const supabase = createClient()

  const { data, error } = await supabase.from('meta').update({ activa: false }).eq('id', id).select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró la meta para archivar')
  }
  return mapMeta(data[0])
}

/**
 * Creates a new `meta_abono` entry (a dated contribution or withdrawal).
 *
 * @param metaId The owning goal's UUID
 * @param monto  Signed amount — positive = contribution, negative = withdrawal
 * @param fecha  ISO date, required
 * @param nota   Optional note, `null` if omitted
 * @returns The created row
 * @throws On Supabase error
 */
export async function crearAbono(
  metaId: string,
  monto: number,
  fecha: string,
  nota: string | null,
): Promise<MetaAbono> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('meta_abono')
    .insert({ meta_id: metaId, monto, fecha, nota })
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo crear el abono')
  }
  return mapMetaAbono(data[0])
}

/**
 * Updates fields on a known, existing `meta_abono` row — by `id`.
 *
 * @param id      The `meta_abono` row's UUID
 * @param updates Partial fields to update
 * @returns The updated row
 * @throws On Supabase error
 */
export async function updateAbono(
  id: string,
  updates: Partial<Pick<MetaAbono, 'monto' | 'fecha' | 'nota'>>,
): Promise<MetaAbono> {
  const supabase = createClient()

  const payload: Record<string, unknown> = {}
  if (updates.monto !== undefined) payload.monto = updates.monto
  if (updates.fecha !== undefined) payload.fecha = updates.fecha
  if (updates.nota !== undefined) payload.nota = updates.nota

  const { data, error } = await supabase.from('meta_abono').update(payload).eq('id', id).select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el abono para actualizar')
  }
  return mapMetaAbono(data[0])
}

/**
 * Deletes a `meta_abono` row — the only hard delete in this domain, per
 * spec's "individually deleted" requirement.
 *
 * @param id The `meta_abono` row's UUID
 * @throws On Supabase error
 */
export async function deleteAbono(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('meta_abono').delete().eq('id', id)

  if (error) throw error
}

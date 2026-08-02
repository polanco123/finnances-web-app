// TODO: Verify fondo_semanal schema against live Supabase before final deployment
// Si aún da error de permisos, ejecutar en el SQL Editor de Supabase:
//   GRANT SELECT, INSERT, UPDATE ON public.fondo_semanal TO authenticated;

import { createClient } from '@/lib/supabase/client'

const DIVERSION_CATEGORIA_ID = 'af6b676c-04db-4fda-b9f7-349123d75e1a'

export const DEFAULT_MONTO_PRESUPUESTADO = 1500

export interface FondoSemanal {
  id: string
  fecha_inicio: string
  fecha_fin: string
  monto_presupuestado: number
  activo: boolean
}

export interface Movimiento {
  monto: number
  descripcion?: string | null
  fecha: string
  hora?: string | null
  cuenta_id: string
  categoria_id: string
  notas?: string | null
}

/** Gets the authenticated user's ID, or throws if not logged in. */
async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user.id
}

/**
 * Resolves the active `fondo_semanal` row whose date range contains today,
 * scoped to the authenticated user.
 *
 * Uses date-containment (`fecha_inicio <= today <= fecha_fin`) as the primary
 * predicate. The `activo` boolean is NOT used for filtering per design decision
 * (its semantics are unconfirmed; trusting an unverified flag risks hiding a
 * valid week).
 *
 * @param today ISO date string (YYYY-MM-DD) representing "today"
 * @returns The matching row, or `null` if no row contains today
 */
export async function fetchActiveWeek(today: string): Promise<FondoSemanal | null> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('fondo_semanal')
    .select('id, fecha_inicio, fecha_fin, monto_presupuestado, activo')
    .eq('user_id', userId)
    .lte('fecha_inicio', today)
    .gte('fecha_fin', today)
    .order('fecha_inicio', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] ?? null
}

/**
 * Fetches all Diversión personal movimientos within a date range.
 *
 * @param fecha_inicio Start of the range (YYYY-MM-DD)
 * @param fecha_fin   End of the range (YYYY-MM-DD)
 * @returns Array of movimientos — empty array if none found
 */
export async function fetchWeekMovements(
  fecha_inicio: string,
  fecha_fin: string,
): Promise<Movimiento[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .select('monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas')
    .eq('categoria_id', DIVERSION_CATEGORIA_ID)
    .gte('fecha', fecha_inicio)
    .lte('fecha', fecha_fin)
    .order('fecha', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Inserts a new movimiento row for a Diversión personal expense.
 *
 * @param payload The movimiento row to insert (from `crearGastoDiversion()`)
 * @returns The inserted row
 * @throws On Supabase error
 */
export async function insertDiversionMovimiento(
  payload: Record<string, unknown>,
): Promise<Movimiento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .insert(payload)
    .select()

  if (error) throw error
  return data?.[0] as Movimiento
}

/**
 * Creates a new `fondo_semanal` row for the given date range with a default
 * budget amount, scoped to the authenticated user.
 *
 * @param fecha_inicio Start of the range (YYYY-MM-DD)
 * @param fecha_fin   End of the range (YYYY-MM-DD)
 * @param monto_presupuestado Budget amount to seed the week with
 * @returns The inserted row
 * @throws On Supabase error
 */
export async function createDefaultFondoSemanal(
  fecha_inicio: string,
  fecha_fin: string,
  monto_presupuestado: number = DEFAULT_MONTO_PRESUPUESTADO,
): Promise<FondoSemanal> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { error: deactivateError } = await supabase
    .from('fondo_semanal')
    .update({ activo: false })
    .eq('user_id', userId)
    .eq('activo', true)

  if (deactivateError) throw deactivateError

  const { data, error } = await supabase
    .from('fondo_semanal')
    .insert({
      user_id: userId,
      fecha_inicio,
      fecha_fin,
      monto_presupuestado,
      activo: true,
    })
    .select()

  if (error) throw error
  return data?.[0] as FondoSemanal
}

/**
 * Updates `monto_presupuestado` on the active `fondo_semanal` row,
 * scoped to the authenticated user.
 *
 * @param fondoSemanalId  The row's UUID
 * @param montoPresupuestado New budget value
 * @throws If the Supabase call fails or zero rows are affected
 */
export async function updateBudget(
  fondoSemanalId: string,
  montoPresupuestado: number,
): Promise<void> {
  const supabase = createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('fondo_semanal')
    .update({ monto_presupuestado: montoPresupuestado })
    .eq('id', fondoSemanalId)
    .eq('user_id', userId)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el registro de fondo semanal para actualizar')
  }
}

// TODO: Verify cuenta and movimiento RLS/grants against live Supabase before final deployment.
// If queries return permissions errors, run in Supabase SQL Editor:
//   GRANT SELECT ON public.cuenta TO authenticated;
//   GRANT SELECT ON public.movimiento TO authenticated;

import { createClient } from '@/lib/supabase/client'

export interface Cuenta {
  id: string
  nombre: string
  tipo: string
  saldo_real: number
  activa: boolean
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

/**
 * Fetches all active bank accounts from the live `cuenta` table.
 *
 * No `user_id` filter — the `cuenta` table does not have a `user_id` column
 * and is single-user at the data-model level.
 *
 * @returns Array of active accounts — empty array if none found
 * @throws On Supabase error
 */
export async function fetchActiveCuentas(): Promise<Cuenta[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('*')
    .eq('activa', true)
    .order('nombre', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Fetches the N most recent movimientos for a given account.
 *
 * No `user_id` filter — the `movimiento` table does not have a `user_id` column
 * and is single-user at the data-model level.
 *
 * @param cuentaId The account UUID to scope the query to
 * @param limit    Maximum number of rows to return (default 5)
 * @returns Array of movimientos ordered by `fecha` descending — empty array if none found
 * @throws On Supabase error
 */
export async function fetchRecentMovimientos(
  cuentaId: string,
  limit: number = 5,
): Promise<Movimiento[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .select('*')
    .eq('cuenta_id', cuentaId)
    .order('fecha', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/**
 * Fetches every movimiento row (both legs) belonging to the given
 * transferencia_id values, regardless of which account they belong to.
 *
 * Used to complete transfer pairs for display: a single account's own
 * recent movimientos only ever contains ITS side of a transfer (matching
 * `cuenta_id`), never the paired account's side. Fetching by
 * `transferencia_id` returns both legs so they can be merged into one
 * card via `groupMovimientos()`, mirroring `/movimientos`' behavior.
 *
 * @param transferenciaIds Distinct transferencia_id values to resolve
 * @returns All matching rows (both legs per id) — empty array if none/no ids given
 * @throws On Supabase error
 */
export async function fetchTransferSiblings(
  transferenciaIds: string[],
): Promise<Movimiento[]> {
  if (transferenciaIds.length === 0) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .select('*')
    .in('transferencia_id', transferenciaIds)

  if (error) throw error
  return data ?? []
}

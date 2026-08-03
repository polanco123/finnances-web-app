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
  monto: number
  descripcion?: string | null
  fecha: string
  hora?: string | null
  cuenta_id: string
  categoria_id: string
  notas?: string | null
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

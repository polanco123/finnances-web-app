// TODO: Verify deuda_pago RLS/grants against live Supabase before final deployment.
// If queries return permissions errors, run in Supabase SQL Editor:
//   GRANT SELECT, INSERT, UPDATE ON public.deuda_pago TO authenticated;
//
// TODO: `notas` reads/writes below assume
// supabase/migrations/20260812000000_add_deuda_pago_notas.sql has been
// applied live. Until then, `notas` will be absent from fetched rows
// (mapped as null) and `updateNotas` will fail against the live DB.

import { createClient } from '@/lib/supabase/client'
import type { Cuenta } from '@/data/cuenta'
import {
  clampDayToMonth,
  getTodayLocalDate,
  nextDueDate,
  toISODate,
} from '@/components/patrimonio/patrimonio-dates'

export interface DeudaPago {
  id: string
  cuentaId: string
  periodo: string // ISO date — this account's own due date at creation/edit time (not a shared page-wide period)
  montoPlaneado: number
  pagado: boolean
  montoPagado: number | null
  notas: string | null
  createdAt: string
}

export interface DeudaAccountWithPago {
  cuenta: Cuenta
  pago: DeudaPago | null // null = no record yet for this account
}

/** Maps a raw snake_case `deuda_pago` row to the camelCase `DeudaPago` shape. */
function mapDeudaPago(row: Record<string, unknown>): DeudaPago {
  return {
    id: row.id as string,
    cuentaId: row.cuenta_id as string,
    periodo: row.periodo as string,
    montoPlaneado: row.monto_planeado as number,
    pagado: row.pagado as boolean,
    montoPagado: (row.monto_pagado as number | null) ?? null,
    notas: (row.notas as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/**
 * Computes the `periodo` (ISO date) to use for a fresh `deuda_pago` record
 * belonging to `cuenta`, derived from THAT account's own `dia_pago` — not a
 * single "current month" shared across every deuda account on the page.
 *
 * Reuses `nextDueDate()` (already established by `patrimonio-dates.ts` and
 * consumed by the `/reportes` "Próximo vencimiento" widget) for BOTH:
 *  - computing the periodo when creating a fresh record for an account with
 *    no existing record, and
 *  - suggesting the next periodo after the account's latest record was
 *    marked paid.
 * Both call sites intentionally share this one helper — there is no separate
 * "next period after paid" date rule.
 *
 * @returns `null` when `cuenta.dia_pago` is not set. Callers MUST treat a
 * `null` result as "this account cannot have a payment record created for it
 * yet" — there is no day-1-of-month fallback.
 */
export function computePeriodoParaCuenta(cuenta: Cuenta, today: Date = getTodayLocalDate()): string | null {
  if (cuenta.dia_pago === null || cuenta.dia_pago === undefined) return null
  return toISODate(nextDueDate(cuenta.dia_pago, today))
}

/**
 * Computes the clamped due date (ISO date) for `diaPago` within a SPECIFIC
 * target month/year — used by the `/deudas` table's month tabs when creating
 * a "sin registrar" row for a month other than the current one.
 *
 * Unlike `computePeriodoParaCuenta`, this does NOT roll forward to "next
 * occurrence from today" — the target month is already explicitly chosen by
 * the caller (a month tab), so only `clampDayToMonth` is needed, reused
 * directly from `patrimonio-dates.ts`.
 *
 * @param diaPago Day of month the account is due to be paid (1-31)
 * @param year    Full year, e.g. 2026
 * @param month   Month, 0-indexed (0 = January, 11 = December) — matches JS `Date`/`clampDayToMonth` convention
 */
export function computePeriodoParaMes(diaPago: number, year: number, month: number): string {
  const day = clampDayToMonth(year, month, diaPago)
  return toISODate(new Date(year, month, day))
}

/**
 * Fetches all active `tipo='deuda'` accounts.
 *
 * @returns Array of active debt accounts ordered by `nombre` ascending — empty array if none found
 * @throws On Supabase error
 */
export async function fetchDeudaAccounts(): Promise<Cuenta[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('*')
    .eq('tipo', 'deuda')
    .eq('activa', true)
    .order('nombre', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Fetches every `deuda_pago` row whose `periodo` falls within `year`, in one
 * bounded query (`periodo >= {year}-01-01 AND periodo <= {year}-12-31`).
 *
 * The `/deudas` page's month-tab table does the client-side month-bucketing
 * and account×month row construction from this flat list — this function
 * only fetches, it does not group.
 *
 * @param year Full calendar year to fetch, e.g. 2026
 * @returns All `deuda_pago` rows for the year, ordered by `periodo` ascending
 * @throws On Supabase error
 */
export async function fetchPagosDelAnio(year: number): Promise<DeudaPago[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .select('*')
    .gte('periodo', `${year}-01-01`)
    .lte('periodo', `${year}-12-31`)
    .order('periodo', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapDeudaPago)
}

/**
 * Fetches the LATEST `deuda_pago` row (by `periodo DESC`) for each of the
 * given accounts, in one bounded query — mirrors this project's established
 * "one bounded fetch + client-side aggregation, no RPC/join" convention
 * (`patrimonio-service.ts`'s `fetchCategoriasDelMes`, `categorias-service.ts`'s
 * `fetchCategoriasConGasto`).
 *
 * @param cuentaIds The debt accounts' UUIDs to fetch latest records for
 * @returns Map of `cuentaId -> latest DeudaPago` — accounts with no record are absent from the map
 * @throws On Supabase error
 */
export async function fetchLatestPagosPorCuentas(cuentaIds: string[]): Promise<Map<string, DeudaPago>> {
  const result = new Map<string, DeudaPago>()
  if (cuentaIds.length === 0) return result

  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .select('*')
    .in('cuenta_id', cuentaIds)
    .order('periodo', { ascending: false })

  if (error) throw error

  for (const row of data ?? []) {
    const pago = mapDeudaPago(row)
    // Rows arrive ordered by periodo DESC, so the first row seen per
    // cuentaId is already its latest — skip any later (older) rows.
    if (!result.has(pago.cuentaId)) {
      result.set(pago.cuentaId, pago)
    }
  }

  return result
}

/**
 * Creates a brand-new `deuda_pago` record for an account that has none yet.
 *
 * A plain `INSERT` (NOT upsert) — there is no existing row to conflict with
 * in this state, so a genuine DB error (e.g. an unexpected UNIQUE collision)
 * must surface rather than be silently absorbed by an upsert.
 *
 * @param cuentaId      The debt account's UUID
 * @param periodo       ISO date — from `computePeriodoParaCuenta()`, editable by the user before confirming
 * @param montoPlaneado Initial planned amount for this new record
 * @returns The created row
 * @throws On Supabase error
 */
export async function crearRegistroPago(
  cuentaId: string,
  periodo: string,
  montoPlaneado: number,
): Promise<DeudaPago> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .insert({ cuenta_id: cuentaId, periodo, monto_planeado: montoPlaneado })
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo crear el registro de pago')
  }
  return mapDeudaPago(data[0])
}

/**
 * Updates only `monto_planeado` on a known, existing row — by `id`, not
 * upsert-by-(cuenta,periodo), since we are updating a specific known row and
 * must NOT touch `pagado`/`monto_pagado`/`periodo`.
 *
 * @param id    The `deuda_pago` row's UUID
 * @param monto New `monto_planeado` value
 * @returns The updated row
 * @throws On Supabase error
 */
export async function updateMontoPlaneado(id: string, monto: number): Promise<DeudaPago> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .update({ monto_planeado: monto })
    .eq('id', id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el registro de pago para actualizar')
  }
  return mapDeudaPago(data[0])
}

/**
 * Updates only `periodo` on a known, existing row — by `id`. Used when the
 * user manually adjusts the date of a still-unpaid record.
 *
 * May throw a `UNIQUE (cuenta_id, periodo)` violation if the chosen date
 * collides with another existing record for the same account — this is
 * intentionally NOT caught/swallowed here; callers must surface the error.
 *
 * @param id      The `deuda_pago` row's UUID
 * @param periodo New `periodo` ISO date value
 * @returns The updated row
 * @throws On Supabase error, including UNIQUE constraint violations
 */
export async function updatePeriodo(id: string, periodo: string): Promise<DeudaPago> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .update({ periodo })
    .eq('id', id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el registro de pago para actualizar')
  }
  return mapDeudaPago(data[0])
}

/**
 * Updates only `notas` on a known, existing row — by `id`. Follows the same
 * "plain UPDATE by id" pattern as `updateMontoPlaneado`/`updatePeriodo`.
 *
 * Requires the `notas` column added by
 * `supabase/migrations/20260812000000_add_deuda_pago_notas.sql`, which is
 * assumed live going forward (this repo's convention: write code against a
 * not-yet-applied migration's schema, the operator applies it separately).
 *
 * @param id    The `deuda_pago` row's UUID
 * @param notas New notas value — `null` clears it
 * @returns The updated row
 * @throws On Supabase error
 */
export async function updateNotas(id: string, notas: string | null): Promise<DeudaPago> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .update({ notas })
    .eq('id', id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el registro de pago para actualizar')
  }
  return mapDeudaPago(data[0])
}

/**
 * Marks an existing `deuda_pago` row as paid with the given actual amount.
 *
 * Caller must already hold an existing row `id` (obtained from
 * `crearRegistroPago` or `fetchLatestPagosPorCuentas`) — a record that
 * doesn't exist yet cannot be marked paid directly.
 *
 * @param id          The `deuda_pago` row's UUID
 * @param montoPagado Actual amount paid (may differ from `monto_planeado`)
 * @returns The updated row
 * @throws On Supabase error
 */
export async function marcarPagado(id: string, montoPagado: number): Promise<DeudaPago> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('deuda_pago')
    .update({ pagado: true, monto_pagado: montoPagado })
    .eq('id', id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se encontró el registro de pago para actualizar')
  }
  return mapDeudaPago(data[0])
}

// TODO: Verify patrimonio_snapshot RLS/grants against live Supabase before final deployment.
// If queries return permissions errors, run in Supabase SQL Editor:
//   GRANT SELECT ON public.patrimonio_snapshot TO authenticated;

import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS, esCategoriaDeGasto } from '@/data/categoria'
import {
  addMonths,
  diasRestantes as diasRestantesHelper,
  getTodayLocalDate,
  monthsAgoStart,
  startOfMonth,
  toISODate,
} from './patrimonio-dates'
import { fetchLatestPagosPorCuentas } from '@/components/deudas/deudas-service'

export interface PatrimonioSnapshot {
  id: string
  fecha: string
  patrimonio_neto: number
  patrimonio_disponible: number
  total_activos: number
  total_deudas: number
}

export interface VencimientoCuenta {
  id: string
  nombre: string
  diaPago: number
  diasRestantes: number
  montoPlaneado?: number
  montoPagado?: number | null
  pagado?: boolean
}

export interface CategoriaHeat {
  categoriaId: string
  nombre: string
  gastoMes: number
  ratio: number | null
  heat: 'hot' | 'warm' | 'normal'
}

export interface RetiroSummary {
  total: number
  count: number
}

/**
 * Sums `saldo_calculado` across all active `cuenta` rows.
 *
 * Computed live (not read from `patrimonio_snapshot`) so it always
 * reconciles with `/cuentas`, which uses the same `saldo_calculado` source.
 *
 * @throws On Supabase error
 */
export async function fetchNetWorth(): Promise<number> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('saldo_calculado')
    .eq('activa', true)

  if (error) throw error
  return (data ?? []).reduce((sum, c) => sum + c.saldo_calculado, 0)
}

/**
 * Sums `saldo_calculado` across active `cuenta` rows flagged `es_fondo_retiro = true`,
 * and returns how many such accounts exist (drives the split's "N cuentas"
 * sub-label per `dashboard-patrimonio-net-worth` spec — a single query serves
 * both, so this returns `{ total, count }` rather than the sum alone).
 *
 * `es_fondo_retiro` is deliberately separate from `cuenta.tipo` — see
 * proposal.md's Resolved Decisions.
 *
 * @throws On Supabase error
 */
export async function fetchRetiroTotal(): Promise<RetiroSummary> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('saldo_calculado')
    .eq('activa', true)
    .eq('es_fondo_retiro', true)

  if (error) throw error
  const rows = data ?? []
  return {
    total: rows.reduce((sum, c) => sum + c.saldo_calculado, 0),
    count: rows.length,
  }
}

/**
 * Fetches up to the last `days` `patrimonio_snapshot` rows, returned in
 * ascending `fecha` order (oldest first, left-to-right for the sparkline).
 *
 * Sparse history (0 or 1 row) is expected on day 1 and MUST NOT throw —
 * callers must not pad the result with fabricated zero-value rows.
 *
 * @throws On Supabase error
 */
export async function fetchSnapshotHistory(days: number): Promise<PatrimonioSnapshot[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('patrimonio_snapshot')
    .select('id, fecha, patrimonio_neto, patrimonio_disponible, total_activos, total_deudas')
    .order('fecha', { ascending: false })
    .limit(days)

  if (error) throw error
  return (data ?? []).reverse()
}

/**
 * Fetches active `deuda` accounts (`dia_pago IS NOT NULL`) whose next
 * `dia_pago` occurrence falls within `windowDays` of today (inclusive),
 * sorted by ascending `diasRestantes` (most urgent first). Each entry is
 * enriched with its latest `deuda_pago` record (if any) via the same
 * "latest record per account" resolution `/deudas` itself uses, so the
 * widget's monto data always reconciles with the `/deudas` page.
 *
 * @param windowDays Alert window size in days (default 7)
 * @throws On Supabase error
 */
export async function fetchProximosVencimientos(windowDays: number = 7): Promise<VencimientoCuenta[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('id, nombre, dia_pago')
    .eq('activa', true)
    .eq('tipo', 'deuda')
    .not('dia_pago', 'is', null)

  if (error) throw error

  const today = getTodayLocalDate()

  const vencimientos = (data ?? [])
    .map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
      diaPago: c.dia_pago as number,
      diasRestantes: diasRestantesHelper(c.dia_pago as number, today),
    }))
    .filter((v) => v.diasRestantes >= 0 && v.diasRestantes <= windowDays)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  if (vencimientos.length === 0) return vencimientos

  const pagosPorCuenta = await fetchLatestPagosPorCuentas(vencimientos.map((v) => v.id))

  return vencimientos.map((v) => {
    const pago = pagosPorCuenta.get(v.id)
    if (!pago) return v
    return {
      ...v,
      montoPlaneado: pago.montoPlaneado,
      montoPagado: pago.montoPagado,
      pagado: pago.pagado,
    }
  })
}

/**
 * Computes each category's current-month spend against its trailing-3-month
 * average, classifying it hot (`ratio > 1.5`), warm (`ratio > 1.15`), or
 * normal otherwise. Categories with no prior-month spend render normal with
 * `ratio: null` — no division by zero.
 *
 * Bounded to a single fetch spanning the trailing 3 months plus the current
 * month; all aggregation happens client-side (no Postgres RPC — see design.md's
 * Architecture Decisions).
 *
 * @throws On Supabase error
 */
export async function fetchCategoriasDelMes(): Promise<CategoriaHeat[]> {
  const supabase = createClient()

  const today = getTodayLocalDate()
  const rangeStart = toISODate(monthsAgoStart(today, 3))
  const rangeEndExclusive = toISODate(addMonths(startOfMonth(today), 1))
  const currentMonthStart = toISODate(startOfMonth(today))

  const { data, error } = await supabase
    .from('movimiento')
    .select('categoria_id, monto, fecha')
    .gte('fecha', rangeStart)
    .lt('fecha', rangeEndExclusive)
    .lt('monto', 0)

  if (error) throw error

  const gastoMesActual = new Map<string, number>()
  const gastoTrailing = new Map<string, number>()

  for (const row of data ?? []) {
    const categoriaId = row.categoria_id as string
    const categoria = CATEGORIAS.find((c) => c.id === categoriaId)
    if (!categoria || !esCategoriaDeGasto(categoria.tipo)) continue

    const monto = Math.abs(row.monto as number)
    const fecha = row.fecha as string
    const bucket = fecha >= currentMonthStart ? gastoMesActual : gastoTrailing
    bucket.set(categoriaId, (bucket.get(categoriaId) ?? 0) + monto)
  }

  const categoriaIds = new Set([...gastoMesActual.keys(), ...gastoTrailing.keys()])

  const categorias: CategoriaHeat[] = Array.from(categoriaIds)
    .map((categoriaId) => {
      const nombre = CATEGORIAS.find((c) => c.id === categoriaId)?.nombre ?? 'Sin categoría'
      const gastoMes = gastoMesActual.get(categoriaId) ?? 0
      const trailingTotal = gastoTrailing.get(categoriaId) ?? 0

      if (trailingTotal <= 0) {
        return { categoriaId, nombre, gastoMes, ratio: null, heat: 'normal' as const }
      }

      const promedioTrimestral = trailingTotal / 3
      const ratio = gastoMes / promedioTrimestral
      const heat: CategoriaHeat['heat'] = ratio > 1.5 ? 'hot' : ratio > 1.15 ? 'warm' : 'normal'

      return { categoriaId, nombre, gastoMes, ratio, heat }
    })
    .filter((c) => c.gastoMes > 0)

  return categorias.sort((a, b) => b.gastoMes - a.gastoMes)
}

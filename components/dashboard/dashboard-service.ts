// TODO: Verify movimiento RLS/grants against live Supabase before final deployment.
// If queries return permissions errors, run in Supabase SQL Editor:
//   GRANT SELECT ON public.movimiento TO authenticated;

import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS } from '@/lib/catalogs/catalog-store'
import {
  addMonths,
  getTodayLocalDate,
  startOfMonth,
  toISODate,
} from '@/components/patrimonio/patrimonio-dates'
import {
  fetchCategoriasConGasto,
  type CategoriaConGasto,
} from '@/components/categorias/categorias-service'
import { fetchActiveCuentas, type Cuenta } from '@/components/cuentas/cuentas-service'
import { fetchNetWorth } from '@/components/patrimonio/patrimonio-service'

export interface ResumenMes {
  ingresos: number // Σ monto where monto > 0, transfers excluded
  gastos: number // Σ |monto| where monto < 0, transfers excluded
  neto: number // ingresos - gastos
}

export interface PuntoTendencia {
  anio: number
  mes: number // 1-12
  etiqueta: string // e.g. "sep 2026", X axis label of the AreaChart
  total: number // Σ |monto| where monto < 0, transfers excluded
}

export interface ResumenCategorias {
  totalGastado: number // Σ across every gasto category of the month
  compromisos: number // tipo ∈ { compromiso, trabajo, hogar }
  discrecionales: number // tipo ∈ { discrecional, suscripcion }
}

const COMPROMISO_TIPOS = ['compromiso', 'trabajo', 'hogar']
const DISCRECIONAL_TIPOS = ['discrecional', 'suscripcion']

/**
 * Returns the `[desde, hasta]` ISO range covering the whole calendar month
 * `mes` (1-12) of `anio`, both ends inclusive.
 *
 * `hasta` is the month's last calendar day (not "today") so that
 * `fetchResumenMes` and `fetchCategoriasConGasto` always share the exact same
 * window — a movimiento with a future `fecha` inside the current month must
 * land in both or neither.
 */
function monthRange(anio: number, mes: number): { desde: string; hasta: string } {
  const ultimoDia = new Date(anio, mes, 0).getDate()
  const mm = String(mes).padStart(2, '0')
  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

/** Returns the `[desde, hasta]` ISO range of the calendar month currently in progress. */
function currentMonthRange(): { desde: string; hasta: string; anio: number; mes: number } {
  const today = getTodayLocalDate()
  const anio = today.getFullYear()
  const mes = today.getMonth() + 1
  return { ...monthRange(anio, mes), anio, mes }
}

/**
 * SELECT monto, es_transferencia FROM movimiento
 *   WHERE fecha >= :desde AND fecha <= :hasta
 *     [AND cuenta_id = :cuentaId]
 *
 * Filters client-side on `es_transferencia !== true` (legacy rows carry
 * `null`, and only a strict `true` marks a transfer leg). A transfer writes
 * two rows (`+monto` / `-monto`); counting them would inflate ingresos and
 * gastos by the same amount for a purely internal balance move.
 *
 * A month with no movimientos yields `{ 0, 0, 0 }` — it never throws except
 * on a Supabase error.
 *
 * @param anio     Full year (e.g. 2026)
 * @param mes      Month, 1-indexed (1 = January, 12 = December)
 * @param cuentaId Optional account UUID to scope the query to
 * @throws On Supabase error
 */
export async function fetchResumenMes(
  anio: number,
  mes: number,
  cuentaId?: string,
): Promise<ResumenMes> {
  const supabase = createClient()
  const { desde, hasta } = monthRange(anio, mes)

  let query = supabase
    .from('movimiento')
    .select('monto, es_transferencia')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (cuentaId) {
    query = query.eq('cuenta_id', cuentaId)
  }

  const { data, error } = await query
  if (error) throw error

  let ingresos = 0
  let gastos = 0

  for (const row of data ?? []) {
    if (row.es_transferencia === true) continue
    const monto = row.monto as number
    if (monto > 0) ingresos += monto
    else if (monto < 0) gastos += Math.abs(monto)
  }

  return { ingresos, gastos, neto: ingresos - gastos }
}

/**
 * A single SELECT monto, fecha, es_transferencia FROM movimiento over the
 * trailing `meses` calendar months (current month included), `monto < 0`,
 * aggregated client-side per `(anio, mes)` bucket. Months with no gasto are
 * zero-filled so the AreaChart keeps an even X axis. Ascending by date.
 *
 * Transfers are excluded explicitly here: unlike `fetchCategoriasConGasto`,
 * which drops them as a side effect of filtering by gasto `tipo`, this trend
 * sums raw `monto < 0` and would otherwise count the outgoing leg as spend.
 *
 * Same bounded-fetch pattern as `patrimonio-service.ts`'s `fetchCategoriasDelMes`.
 *
 * @param meses Window size in calendar months, current month included (default 6)
 * @throws On Supabase error
 */
export async function fetchGastoMensualTrailing(meses: number = 6): Promise<PuntoTendencia[]> {
  const supabase = createClient()

  const today = getTodayLocalDate()
  const windowStart = addMonths(startOfMonth(today), -(meses - 1))
  const rangeStart = toISODate(windowStart)
  const rangeEndExclusive = toISODate(addMonths(startOfMonth(today), 1))

  const { data, error } = await supabase
    .from('movimiento')
    .select('monto, fecha, es_transferencia')
    .gte('fecha', rangeStart)
    .lt('fecha', rangeEndExclusive)
    .lt('monto', 0)

  if (error) throw error

  const totales = new Map<string, number>()

  for (const row of data ?? []) {
    if (row.es_transferencia === true) continue
    // `fecha` is a plain YYYY-MM-DD string — slicing avoids a Date round-trip
    // (and the timezone shift it would introduce) just to read the bucket.
    const key = (row.fecha as string).slice(0, 7)
    totales.set(key, (totales.get(key) ?? 0) + Math.abs(row.monto as number))
  }

  const etiquetaFormatter = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' })

  const puntos: PuntoTendencia[] = []
  for (let i = 0; i < meses; i += 1) {
    const bucketStart = addMonths(windowStart, i)
    const anio = bucketStart.getFullYear()
    const mes = bucketStart.getMonth() + 1
    const key = `${anio}-${String(mes).padStart(2, '0')}`
    puntos.push({
      anio,
      mes,
      etiqueta: etiquetaFormatter.format(bucketStart),
      total: totales.get(key) ?? 0,
    })
  }

  return puntos
}

/**
 * Pure, no Supabase. Crosses `categorias` against the `CATEGORIAS` catalog by
 * `categoriaId` to read `tipo` and bucket the spend.
 *
 * A category with no catalog match still counts toward `totalGastado` but
 * lands in neither bucket, so `compromisos + discrecionales` is not
 * guaranteed to equal `totalGastado`.
 */
export function resumirMes(categorias: CategoriaConGasto[]): ResumenCategorias {
  let totalGastado = 0
  let compromisos = 0
  let discrecionales = 0

  for (const entry of categorias) {
    totalGastado += entry.total

    const categoria = CATEGORIAS.find((c) => c.id === entry.categoriaId)
    if (!categoria) continue

    if (COMPROMISO_TIPOS.includes(categoria.tipo)) compromisos += entry.total
    else if (DISCRECIONAL_TIPOS.includes(categoria.tipo)) discrecionales += entry.total
  }

  return { totalGastado, compromisos, discrecionales }
}

/**
 * Orchestrates the dashboard's global load — everything that does not depend
 * on the selected account. The account-scoped slice (month summary + latest
 * movimientos) is deliberately NOT loaded here: the page fetches it in its own
 * `useEffect([cuentaSeleccionada])` so toggling an account pill never refetches
 * the trend or the account catalog.
 *
 * @throws On Supabase error
 */
export async function fetchDashboardData(): Promise<{
  netWorth: number
  cuentas: Cuenta[]
  categorias: CategoriaConGasto[]
  resumenMes: ResumenCategorias
  tendencia: PuntoTendencia[]
}> {
  const { desde, hasta } = currentMonthRange()

  const [netWorth, cuentas, categorias, tendencia] = await Promise.all([
    fetchNetWorth(),
    fetchActiveCuentas(),
    fetchCategoriasConGasto(desde, hasta),
    fetchGastoMensualTrailing(6),
  ])

  return {
    netWorth,
    cuentas,
    categorias,
    resumenMes: resumirMes(categorias),
    tendencia,
  }
}

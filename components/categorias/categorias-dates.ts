/**
 * Date helpers for the Categorías gasto-por-periodo page.
 *
 * All "today" comparisons operate in local time, consistent with
 * `components/diversion/diversion-week-range.ts`'s `getTodayLocal` and
 * `components/patrimonio/patrimonio-dates.ts`'s `getTodayLocal`.
 * No date library dependency, no shared import — hand-rolled `Date` logic,
 * a deliberate third near-duplicate per this change's proposal (see
 * "Accepted, not silently fixed" in proposal.md's Resolved Decisions).
 */

import { getCurrentWeekRange } from '@/components/diversion/diversion-week-range'

export interface RangoFecha {
  desde: string
  hasta: string
}

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function getTodayLocal(): string {
  return toISODate(new Date())
}

/** Returns today at local midnight as a `Date` object. */
export function getTodayLocalDate(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Formats a `Date` as YYYY-MM-DD using its local (not UTC) components. */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today only. */
export function getRangoDia(): RangoFecha {
  const today = getTodayLocal()
  return { desde: today, hasta: today }
}

/** The current week, Monday through Sunday, inclusive — wraps `getCurrentWeekRange()`. */
export function getRangoSemanal(): RangoFecha {
  const { fecha_inicio, fecha_fin } = getCurrentWeekRange()
  return { desde: fecha_inicio, hasta: fecha_fin }
}

/**
 * Day 1-15 of the current month if today falls within that range, otherwise
 * day 16-end-of-month of the current month.
 */
export function getRangoQuincenal(): RangoFecha {
  const today = getTodayLocalDate()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  if (day <= 15) {
    return { desde: toISODate(new Date(year, month, 1)), hasta: toISODate(new Date(year, month, 15)) }
  }

  const lastDay = new Date(year, month + 1, 0).getDate() // day 0 of next month = last day of this month
  return { desde: toISODate(new Date(year, month, 16)), hasta: toISODate(new Date(year, month, lastDay)) }
}

/** The 1st through the last day of the current calendar month. */
export function getRangoMensual(): RangoFecha {
  const today = getTodayLocalDate()
  const year = today.getFullYear()
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return { desde: toISODate(new Date(year, month, 1)), hasta: toISODate(new Date(year, month, lastDay)) }
}

/** January 1 through December 31 of the current calendar year. */
export function getRangoAnual(): RangoFecha {
  const year = getTodayLocalDate().getFullYear()
  return { desde: toISODate(new Date(year, 0, 1)), hasta: toISODate(new Date(year, 11, 31)) }
}

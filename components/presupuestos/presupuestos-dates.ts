/**
 * Date helpers for the Presupuestos monthly navigation.
 *
 * Unlike `categorias-dates.ts`'s `getRangoMensual()`, which is anchored to
 * "today", these helpers accept an arbitrary `(anio, mes)` pair so the page
 * can navigate to any past or future calendar month. Hand-rolled `Date`
 * logic, no date library — same "deliberate near-duplicate" precedent
 * documented in `categorias-dates.ts`'s header comment.
 */

export interface RangoFecha {
  desde: string
  hasta: string
}

/** Formats a `Date` as YYYY-MM-DD using its local (not UTC) components. */
function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The 1st through the last day of the given calendar month.
 *
 * @param anio Calendar year (e.g. 2026)
 * @param mes  Calendar month, 1-12
 */
export function getRangoDelMes(anio: number, mes: number): RangoFecha {
  const lastDay = new Date(anio, mes, 0).getDate() // day 0 of next month = last day of this month
  return {
    desde: toISODate(new Date(anio, mes - 1, 1)),
    hasta: toISODate(new Date(anio, mes - 1, lastDay)),
  }
}

/** Returns the previous calendar month, rolling the year back on January. */
export function getMesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  if (mes === 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

/** Returns the next calendar month, rolling the year forward on December. */
export function getMesSiguiente(anio: number, mes: number): { anio: number; mes: number } {
  if (mes === 12) return { anio: anio + 1, mes: 1 }
  return { anio, mes: mes + 1 }
}

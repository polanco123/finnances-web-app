/** Formats a `Date` as YYYY-MM-DD using its LOCAL components — never `toISOString()`,
 * which converts to UTC first and can shift the date by one day in the evening
 * for timezones behind UTC (e.g. Mexico, UTC-6). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns the Monday-Sunday week range containing `date`, as ISO date strings.
 *
 * No date library dependency — hand-rolled Date logic consistent with the
 * rest of the project.
 */
export function getWeekRangeFor(date: Date): { fecha_inicio: string; fecha_fin: string } {
  const day = date.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Days to subtract to reach Monday: if Sunday (0) → 6, else day - 1
  const daysToMonday = day === 0 ? 6 : day - 1

  const monday = new Date(date)
  monday.setDate(date.getDate() - daysToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    fecha_inicio: toLocalDateString(monday),
    fecha_fin: toLocalDateString(sunday),
  }
}

/**
 * Returns the current week's Monday-Sunday date range as ISO date strings.
 */
export function getCurrentWeekRange(): { fecha_inicio: string; fecha_fin: string } {
  return getWeekRangeFor(new Date())
}

/**
 * Shifts a week range (identified by its `fecha_inicio`) by `deltaWeeks`
 * whole weeks — negative for past weeks, positive for future weeks.
 */
export function shiftWeekRange(
  fecha_inicio: string,
  deltaWeeks: number,
): { fecha_inicio: string; fecha_fin: string } {
  const [y, m, d] = fecha_inicio.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  monday.setDate(monday.getDate() + deltaWeeks * 7)
  return getWeekRangeFor(monday)
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 *
 * Avoids the UTC-vs-local mismatch from `new Date().toISOString().split('T')[0]`
 * which shifts to the next UTC day after 6 PM UTC-6 / midnight UTC.
 */
export function getTodayLocal(): string {
  return toLocalDateString(new Date())
}

/**
 * Returns the number of days remaining in the active week, inclusive of today.
 *
 * Uses millisecond diff with `Math.round` to guard against DST-related day
 * miscounts (Math.floor would silently miss a day when diffMs/86400000
 * is 0.958 or 1.042). Result is floored at 1 to prevent Infinity/NaN if the
 * active-week invariant is ever violated.
 */
export function getDaysRemainingInclusive(fechaFin: string, today: string): number {
  const diffMs = new Date(fechaFin).getTime() - new Date(today).getTime()
  const diffDays = Math.round(diffMs / 86_400_000)
  const daysInclusive = diffDays + 1
  return Math.max(1, daysInclusive)
}

/** Formats a week range as "18 - 24 ago" (or "28 ago - 3 sep" when it spans two months). */
export function formatWeekRangeLabel(range: { fecha_inicio: string; fecha_fin: string }): string {
  const [y1, m1, d1] = range.fecha_inicio.split('-').map(Number)
  const [y2, m2, d2] = range.fecha_fin.split('-').map(Number)
  const start = new Date(y1, m1 - 1, d1)
  const end = new Date(y2, m2 - 1, d2)

  const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'short' })
  const sameMonth = m1 === m2 && y1 === y2

  if (sameMonth) {
    return `${d1} - ${d2} ${monthFmt.format(start)}`
  }
  return `${d1} ${monthFmt.format(start)} - ${d2} ${monthFmt.format(end)}`
}

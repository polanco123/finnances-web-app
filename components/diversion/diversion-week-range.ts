/**
 * Returns the current week's Monday-Sunday date range as ISO date strings.
 *
 * No date library dependency — uses hand-rolled Date logic consistent
 * with the rest of the project.
 */
export function getCurrentWeekRange(): { fecha_inicio: string; fecha_fin: string } {
  const today = new Date()
  const day = today.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Days to subtract to reach Monday: if Sunday (0) → 6, else day - 1
  const daysToMonday = day === 0 ? 6 : day - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date): string => d.toISOString().split('T')[0]

  return {
    fecha_inicio: fmt(monday),
    fecha_fin: fmt(sunday),
  }
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 *
 * Avoids the UTC-vs-local mismatch from `new Date().toISOString().split('T')[0]`
 * which shifts to the next UTC day after 6 PM UTC-6 / midnight UTC.
 */
export function getTodayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

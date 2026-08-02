/**
 * Date helpers for the Patrimonio dashboard.
 *
 * All "today" comparisons operate in local time, consistent with
 * `components/diversion/diversion-week-range.ts`'s `getTodayLocal`.
 * No date library dependency — hand-rolled `Date` logic per project convention.
 */

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function getTodayLocal(): string {
  return toISODate(new Date())
}

/** Returns today at local midnight as a `Date` object. */
export function getTodayLocalDate(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Returns the first day of `date`'s month, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Returns a new `Date` set to the first day of the month `months` away from
 * `date`'s month (negative values move backward). Always day 1, so it never
 * overflows into an unexpected month.
 */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

/** Returns the first day of the month `months` months before `date`'s month. */
export function monthsAgoStart(date: Date, months: number): Date {
  return addMonths(startOfMonth(date), -months)
}

/** Formats a `Date` as YYYY-MM-DD using its local (not UTC) components. */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Clamps `day` down to the last valid day of the given month.
 *
 * JS `Date` silently overflows invalid days (`new Date(2026, 1, 30)` rolls
 * into March), which would corrupt the due date rather than just its display —
 * this clamp must run before any `Date` is constructed from `day`.
 *
 * @param year  Full year (e.g. 2026)
 * @param month Month, 0-indexed (0 = January, 11 = December)
 * @param day   Requested day of month
 */
export function clampDayToMonth(year: number, month: number, day: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDayOfMonth)
}

/**
 * Resolves the next occurrence of `diaPago` on/after `today`.
 *
 * If this month's clamped due date has already passed, rolls to next month's
 * clamped due date (year rolls over automatically past December).
 */
export function nextDueDate(diaPago: number, today: Date): Date {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const thisMonthDay = clampDayToMonth(today.getFullYear(), today.getMonth(), diaPago)
  let due = new Date(today.getFullYear(), today.getMonth(), thisMonthDay)

  if (due < startOfToday) {
    const nextMonth = addMonths(today, 1)
    const nextMonthDay = clampDayToMonth(nextMonth.getFullYear(), nextMonth.getMonth(), diaPago)
    due = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDay)
  }

  return due
}

/** Returns the whole number of days from today (today itself = 0) until `diaPago`'s next occurrence. */
export function diasRestantes(diaPago: number, today: Date): number {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const due = nextDueDate(diaPago, today)
  const diffMs = due.getTime() - startOfToday.getTime()
  return Math.round(diffMs / 86_400_000)
}

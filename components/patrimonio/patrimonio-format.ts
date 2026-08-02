import type { PatrimonioSnapshot } from './patrimonio-service'

export interface DeltaLabel {
  label: string
  delta: number
  direction: 'up' | 'down' | 'neutral'
}

/** Formats a monetary amount as MXN currency, matching the project-wide convention. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Builds the net-worth delta chip label comparing `current` (today's live value)
 * against the most recent prior `patrimonio_snapshot` row.
 *
 * The comparison snapshot is not necessarily "yesterday" — the label always
 * reflects the actual number of calendar days between `previous.fecha` and
 * `today`, per the `dashboard-patrimonio-net-worth` spec.
 *
 * @param current  Today's live `patrimonio_neto`
 * @param previous The most recent snapshot row dated strictly before today, or `null` if none exists
 * @param today    ISO date string (YYYY-MM-DD) representing "today"; defaults to the actual local today
 */
export function formatDeltaLabel(
  current: number,
  previous: PatrimonioSnapshot | null,
  today: string = new Date().toISOString().slice(0, 10),
): DeltaLabel {
  if (!previous) {
    return { label: 'Sin datos previos', delta: 0, direction: 'neutral' }
  }

  const delta = current - previous.patrimonio_neto
  const direction: DeltaLabel['direction'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'

  const diffMs = new Date(today).getTime() - new Date(previous.fecha).getTime()
  const daysAgo = Math.max(1, Math.round(diffMs / 86_400_000))
  const dayWord = daysAgo === 1 ? 'día' : 'días'

  return { label: `desde hace ${daysAgo} ${dayWord}`, delta, direction }
}

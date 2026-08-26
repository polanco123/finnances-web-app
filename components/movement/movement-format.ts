/** Strips the trailing period Intl leaves on es-MX short weekday/month
 * abbreviations (e.g. "lun." -> "lun") and capitalizes the first letter. */
function capitalizeAbbrev(s: string): string {
  const clean = s.replace('.', '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** Formats fecha ("YYYY-MM-DD") + hora ("HH:MM:SS") as "Lun 17-Ago-26 12:56pm".
 * Parses fecha into local (not UTC) components, matching the convention used
 * elsewhere in the app (see cuentas-card.tsx's toLocalISODate). */
export function formatFechaHora(fecha: string, hora?: string | null): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1)

  const diaSemana = capitalizeAbbrev(
    new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(parsed),
  )
  const mes = capitalizeAbbrev(new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(parsed))
  const dd = String(day).padStart(2, '0')
  const yy = String(year).slice(-2)

  let result = `${diaSemana} ${dd}-${mes}-${yy}`

  if (hora) {
    const [h, m] = hora.split(':').map(Number)
    const period = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    result += ` ${h12}:${String(m).padStart(2, '0')}${period}`
  }

  return result
}

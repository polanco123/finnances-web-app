'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import './presupuestos-mes-selector.css'

interface PresupuestosMesSelectorProps {
  anio: number
  mes: number
  onAnterior: () => void
  onSiguiente: () => void
}

/** Formats "agosto de 2026" -> "Agosto de 2026" (capitalize first letter only). */
function formatMesLabel(anio: number, mes: number): string {
  const parsed = new Date(anio, mes - 1, 1)
  const label = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(parsed)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Prev/next month navigation only — no free year/month range picker, per
 * spec's "Navegación de mes anclada al mes actual". Purely controlled: it
 * renders the `(anio, mes)` it receives and reports arrow clicks to the
 * parent via `onAnterior`/`onSiguiente`; it never fetches and never owns the
 * selected month itself.
 */
export default function PresupuestosMesSelector({
  anio,
  mes,
  onAnterior,
  onSiguiente,
}: PresupuestosMesSelectorProps) {
  return (
    <div className="presupuestos-mes-selector">
      <button
        type="button"
        className="presupuestos-mes-selector__btn"
        onClick={onAnterior}
        aria-label="Mes anterior"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <span className="presupuestos-mes-selector__label">{formatMesLabel(anio, mes)}</span>
      <button
        type="button"
        className="presupuestos-mes-selector__btn"
        onClick={onSiguiente}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}

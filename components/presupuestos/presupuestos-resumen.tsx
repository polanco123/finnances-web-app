'use client'

import PresupuestoProgress from './presupuesto-progress'
import './presupuestos-resumen.css'

interface PresupuestosResumenProps {
  totalPresupuestado: number
  totalGastado: number
}

/**
 * Aggregate bar for the selected month: total presupuestado vs. total
 * gastado, summed only over the presupuestos the caller already fetched for
 * that month (never fetches, never knows about categories without a
 * presupuesto). Reuses `PresupuestoProgress` for the bar itself so the
 * aggregate and per-category bars share the same clamp/color/excedente
 * behavior.
 */
export default function PresupuestosResumen({
  totalPresupuestado,
  totalGastado,
}: PresupuestosResumenProps) {
  return (
    <div className="presupuestos-resumen">
      <span className="presupuestos-resumen__title">Resumen del mes</span>
      <PresupuestoProgress gastado={totalGastado} monto={totalPresupuestado} />
    </div>
  )
}

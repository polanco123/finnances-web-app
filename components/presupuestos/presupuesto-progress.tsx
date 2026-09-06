'use client'

import './presupuesto-progress.css'

interface PresupuestoProgressProps {
  gastado: number
  monto: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Progress bar for a monthly presupuesto: `gastado` vs `monto` presupuestado.
 * Width clamps to [0, 100] — same clamp technique as `metas-progress.tsx:27`,
 * copied verbatim since a `<div>` cannot render negative or over-100% width —
 * but the numeric label/percentage always shows the true value, never
 * clamped. Turns red when `gastado` exceeds `monto`; the excess renders as
 * separate text below the bar, never by stretching the fill past 100%.
 */
export default function PresupuestoProgress({ gastado, monto }: PresupuestoProgressProps) {
  const porcentaje = monto > 0 ? (gastado / monto) * 100 : 0
  const widthPct = monto > 0 ? Math.max(0, Math.min(100, porcentaje)) : 0
  const excedido = gastado > monto
  const excedente = Math.max(0, gastado - monto)

  return (
    <div className="presupuesto-progress">
      <div className="presupuesto-progress__header">
        <span
          className={`presupuesto-progress__label${excedido ? ' presupuesto-progress__label--excedido' : ''}`}
        >
          {formatCurrency(gastado)} de {formatCurrency(monto)}
        </span>
        <span
          className={`presupuesto-progress__pct${excedido ? ' presupuesto-progress__label--excedido' : ''}`}
        >
          {Math.round(porcentaje)}%
        </span>
      </div>
      <div className="presupuesto-progress__track">
        <div
          className={`presupuesto-progress__fill${excedido ? ' presupuesto-progress__fill--excedido' : ''}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      {excedido && (
        <span className="presupuesto-progress__excedente">
          +{formatCurrency(excedente)} sobre el presupuesto
        </span>
      )}
    </div>
  )
}

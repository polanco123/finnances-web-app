'use client'

import './metas-progress.css'

interface MetaProgressBarProps {
  montoActual: number
  montoObjetivo: number
  cumplida: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Cumulative (non-resetting) progress bar for a savings goal. Width clamps to
 * [0, 100] since a `<div>` cannot render negative or over-100% width, but the
 * numeric label always shows the true `montoActual`/percentage — never
 * clamped — colored to signal negative progress explicitly.
 */
export default function MetaProgressBar({ montoActual, montoObjetivo, cumplida }: MetaProgressBarProps) {
  const porcentaje = montoObjetivo > 0 ? (montoActual / montoObjetivo) * 100 : 0
  const widthPct = montoObjetivo > 0 ? Math.max(0, Math.min(100, porcentaje)) : 0
  const isNegative = montoActual < 0

  return (
    <div className="metas-progress">
      <div className="metas-progress__header">
        <span
          className={`metas-progress__label${isNegative ? ' metas-progress__label--negative' : ''}`}
        >
          {formatCurrency(montoActual)} de {formatCurrency(montoObjetivo)}
        </span>
        <span
          className={`metas-progress__pct${isNegative ? ' metas-progress__label--negative' : ''}`}
        >
          {Math.round(porcentaje)}%
        </span>
      </div>
      <div className="metas-progress__track">
        <div
          className={`metas-progress__fill${cumplida ? ' metas-progress__fill--cumplida' : ''}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      {cumplida && <span className="metas-progress__badge">Cumplida</span>}
    </div>
  )
}

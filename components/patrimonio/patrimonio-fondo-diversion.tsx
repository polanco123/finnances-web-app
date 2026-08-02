'use client'

import { formatMoney } from './patrimonio-format'
import PatrimonioDayPips from './patrimonio-day-pips'
import './patrimonio-fondo-diversion.css'

interface PatrimonioFondoDiversionProps {
  budget: number
  spent: number
  daysLeft: number
  daysElapsed: number
}

export default function PatrimonioFondoDiversion({
  budget,
  spent,
  daysElapsed,
}: PatrimonioFondoDiversionProps) {
  const hasBudget = budget > 0

  if (!hasBudget) {
    return (
      <section className="patrimonio-card patrimonio-fondo patrimonio-fondo--empty">
        <p className="patrimonio-section-title">Fondo diversión</p>
        <p className="patrimonio-fondo__empty-message">Sin semana activa</p>
      </section>
    )
  }

  const percentage = (spent / budget) * 100
  const isOverBudget = percentage > 100
  const barWidth = Math.min(100, percentage)
  const remainderOrExcess = isOverBudget ? spent - budget : budget - spent
  const averagePerDay = spent / Math.max(1, daysElapsed)

  return (
    <section className="patrimonio-card patrimonio-fondo">
      <p className="patrimonio-section-title">Fondo diversión</p>

      <div className="patrimonio-fondo__row">
        <span className="patrimonio-fondo__spent">{formatMoney(spent)}</span>
        <span
          className={`patrimonio-fondo__pct${isOverBudget ? ' patrimonio-fondo__pct--over' : ''}`}
        >
          {Math.round(percentage)}%
        </span>
      </div>

      <div className="patrimonio-fondo__track">
        <div
          className={`patrimonio-fondo__fill${isOverBudget ? ' patrimonio-fondo__fill--over' : ''}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <PatrimonioDayPips totalDays={7} daysElapsed={daysElapsed} />

      <div className="patrimonio-fondo__footer">
        <span className="patrimonio-fondo__remainder">
          {isOverBudget ? 'Excedido por ' : 'Restante '}
          <strong>{formatMoney(remainderOrExcess)}</strong>
        </span>
        <span className="patrimonio-fondo__average">{formatMoney(averagePerDay)}/día promedio</span>
      </div>
    </section>
  )
}

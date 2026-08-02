'use client'

import { useMemo } from 'react'
import './diversion-progress.css'

interface DiversionProgressProps {
  spent: number
  budget: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function DiversionProgress({ spent, budget }: DiversionProgressProps) {
  const safeSpent = Math.max(0, spent)

  const widthPercent = useMemo(() => {
    if (budget <= 0) return 0
    return Math.min(100, (safeSpent / budget) * 100)
  }, [safeSpent, budget])

  const isEmpty = budget <= 0

  return (
    <div className="diversion-progress">
      <div className="diversion-progress__header">
        <span className="diversion-progress__label">
          {isEmpty
            ? 'Sin presupuesto'
            : `${formatCurrency(safeSpent)} gastado de ${formatCurrency(budget)} presupuestado`}
        </span>
        {!isEmpty && (
          <span className="diversion-progress__pct">
            {Math.round(widthPercent)}%
          </span>
        )}
      </div>
      <div className="diversion-progress__track">
        <div
          className="diversion-progress__fill"
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  )
}

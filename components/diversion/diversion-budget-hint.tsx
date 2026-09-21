'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import {
  fetchActiveWeek,
  fetchWeekMovements,
  type FondoSemanal,
} from './diversion-service'
import {
  getCurrentWeekRange,
  getDaysRemainingInclusive,
  getTodayLocal,
} from './diversion-week-range'
import DiversionProgress from './diversion-progress'
import './diversion-budget-hint.css'

interface DiversionBudgetHintProps {
  /** Bump this to force a refetch (e.g. after a movimiento is saved). */
  refreshToken?: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Shows how much of the current week's Diversión budget is already spent,
 * so the amount is on screen while the expense is being typed.
 *
 * Stays visible until dismissed with its close button; the parent unmounts it
 * when the selected categoria is no longer a Diversión one, which also resets
 * the dismissed state for the next time it is picked.
 */
export default function DiversionBudgetHint({ refreshToken }: DiversionBudgetHintProps) {
  const [budget, setBudget] = useState<FondoSemanal | null>(null)
  const [spent, setSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)

    try {
      const range = getCurrentWeekRange()
      const activeWeek = await fetchActiveWeek(getTodayLocal())
      const movements = await fetchWeekMovements(range.fecha_inicio, range.fecha_fin)

      setBudget(activeWeek)
      setSpent(Math.max(0, -movements.reduce((sum, m) => sum + m.monto, 0)))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  // A failed lookup must never block registering the movimiento: stay silent.
  if (dismissed || failed) return null

  if (loading) {
    return (
      <div className="diversion-budget-hint diversion-budget-hint--loading">
        <p className="diversion-budget-hint__message">Consultando tu fondo semanal...</p>
      </div>
    )
  }

  const budgetAmount = budget?.monto_presupuestado ?? 0
  const remaining = budgetAmount - spent
  const isOver = budgetAmount > 0 && remaining < 0
  const isTight = budgetAmount > 0 && !isOver && spent / budgetAmount >= 0.8

  const modifier = isOver
    ? 'diversion-budget-hint--over'
    : isTight
      ? 'diversion-budget-hint--tight'
      : ''

  let message: string
  let detail: string | null = null

  if (!budget) {
    message = `No hay fondo semanal activo. Llevas ${formatCurrency(spent)} en Diversión esta semana.`
  } else if (isOver) {
    message = `Te pasaste ${formatCurrency(Math.abs(remaining))} del fondo de Diversión de esta semana.`
  } else {
    const daysLeft = getDaysRemainingInclusive(budget.fecha_fin, getTodayLocal())
    message = `Te quedan ${formatCurrency(remaining)} de Diversión esta semana.`
    detail = `${formatCurrency(Math.floor(remaining / daysLeft))} por día durante los ${daysLeft} días que restan.`
  }

  return (
    <div className={`diversion-budget-hint ${modifier}`.trim()} role="status">
      <button
        type="button"
        className="diversion-budget-hint__close"
        onClick={() => setDismissed(true)}
        aria-label="Ocultar el resumen del fondo de Diversión"
      >
        <X size={16} />
      </button>

      <p className="diversion-budget-hint__message">{message}</p>
      {detail && <p className="diversion-budget-hint__detail">{detail}</p>}

      {budget && <DiversionProgress spent={spent} budget={budgetAmount} />}

      <Link className="diversion-budget-hint__link" href="/diversion">
        Ver el detalle de la semana
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}

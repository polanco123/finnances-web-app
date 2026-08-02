'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import {
  fetchActiveWeek,
  fetchWeekMovements,
  updateBudget,
  createDefaultFondoSemanal,
  DEFAULT_MONTO_PRESUPUESTADO,
} from '@/components/diversion/diversion-service'
import type { FondoSemanal, Movimiento } from '@/components/diversion/diversion-service'
import { getCurrentWeekRange, getDaysRemainingInclusive, getTodayLocal } from '@/components/diversion/diversion-week-range'
import DiversionEmptyState from '@/components/diversion/diversion-empty-state'
import DiversionProgress from '@/components/diversion/diversion-progress'
import DiversionDailyAllowance from '@/components/diversion/diversion-daily-allowance'
import DiversionBudgetEdit from '@/components/diversion/diversion-budget-edit'
import DiversionForm from '@/components/diversion/diversion-form'
import DiversionListItem from '@/components/diversion/diversion-list-item'
import DiversionMissingBudgetAlert from '@/components/diversion/diversion-missing-budget-alert'
import './page.css'

function DiversionContent() {
  const [activeWeek, setActiveWeek] = useState<FondoSemanal | null>(null)
  const [movements, setMovements] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const loadActiveWeek = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAlertDismissed(false)

    const today = getTodayLocal()

    try {
      const week = await fetchActiveWeek(today)
      setActiveWeek(week)

      if (week) {
        const movs = await fetchWeekMovements(week.fecha_inicio, week.fecha_fin)
        setMovements(movs)
      } else {
        setMovements([])
      }
    } catch {
      setError('Error al cargar los datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refetchMovements = useCallback(async () => {
    if (!activeWeek) return
    setError(null)
    try {
      const movs = await fetchWeekMovements(
        activeWeek.fecha_inicio,
        activeWeek.fecha_fin,
      )
      setMovements(movs)
    } catch {
      setError('Error al cargar los movimientos.')
    }
  }, [activeWeek])

  const handleBudgetUpdate = useCallback(
    async (newBudget: number) => {
      if (!activeWeek) return
      setError(null)
      try {
        await updateBudget(activeWeek.id, newBudget)
        const today = getTodayLocal()
        const updatedWeek = await fetchActiveWeek(today)
        setActiveWeek(updatedWeek)
      } catch {
        setError('Error al actualizar el presupuesto.')
      }
    },
    [activeWeek],
  )

  const handleCreateDefaultBudget = useCallback(async () => {
    const { fecha_inicio, fecha_fin } = getCurrentWeekRange()
    await createDefaultFondoSemanal(fecha_inicio, fecha_fin, DEFAULT_MONTO_PRESUPUESTADO)
    await loadActiveWeek()
  }, [loadActiveWeek])

  useEffect(() => {
    loadActiveWeek()
  }, [loadActiveWeek])

  // --- Derived state ---
  const spent = Math.max(
    0,
    -movements.reduce((sum, m) => sum + m.monto, 0),
  )

  const today = getTodayLocal()
  const remaining = activeWeek ? activeWeek.monto_presupuestado - spent : 0
  const daysLeft = activeWeek
    ? getDaysRemainingInclusive(activeWeek.fecha_fin, today)
    : 1
  const dailyAllowance = Math.floor(remaining / daysLeft)

  // --- Loading ---
  if (loading) {
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          <div className="diversion-page__loading">Cargando...</div>
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error && !activeWeek) {
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          <div className="diversion-page__error">{error}</div>
        </div>
      </div>
    )
  }

  // --- Empty state (no active week) ---
  if (!activeWeek) {
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          {!alertDismissed && (
            <DiversionMissingBudgetAlert
              defaultAmount={DEFAULT_MONTO_PRESUPUESTADO}
              onAccept={handleCreateDefaultBudget}
              onClose={() => setAlertDismissed(true)}
            />
          )}
          <DiversionEmptyState />
        </div>
      </div>
    )
  }

  // --- Main content ---
  return (
    <div className="diversion-page">
      <div className="diversion-page__container">
        <h1 className="diversion-page__title">Diversión</h1>

        {error && <div className="diversion-page__error">{error}</div>}

        <DiversionProgress spent={spent} budget={activeWeek.monto_presupuestado} />

        <DiversionDailyAllowance amount={dailyAllowance} />

        <DiversionBudgetEdit
          currentBudget={activeWeek.monto_presupuestado}
          onUpdate={handleBudgetUpdate}
        />

        <DiversionForm onMovimientoCreado={refetchMovements} />

        <div className="diversion-page__list">
          {movements.length === 0 ? (
            <p className="diversion-page__empty-list">
              No hay gastos registrados esta semana.
            </p>
          ) : (
            movements.map((movimiento, index) => (
              <DiversionListItem key={index} movimiento={movimiento} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="diversion-page">
          <div className="diversion-page__container">
            <div className="diversion-page__loading">Cargando...</div>
          </div>
        </div>
      }
    >
      <DiversionContent />
    </Suspense>
  )
}

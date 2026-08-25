'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  fetchActiveWeek,
  fetchWeekMovements,
  updateBudget,
  createDefaultFondoSemanal,
  DEFAULT_MONTO_PRESUPUESTADO,
} from '@/components/diversion/diversion-service'
import type { FondoSemanal, Movimiento } from '@/components/diversion/diversion-service'
import {
  getCurrentWeekRange,
  getDaysRemainingInclusive,
  getTodayLocal,
  shiftWeekRange,
  formatWeekRangeLabel,
} from '@/components/diversion/diversion-week-range'
import DiversionEmptyState from '@/components/diversion/diversion-empty-state'
import DiversionProgress from '@/components/diversion/diversion-progress'
import DiversionDailyAllowance from '@/components/diversion/diversion-daily-allowance'
import DiversionBudgetEdit from '@/components/diversion/diversion-budget-edit'
import DiversionForm from '@/components/diversion/diversion-form'
import DiversionListItem from '@/components/diversion/diversion-list-item'
import DiversionMissingBudgetAlert from '@/components/diversion/diversion-missing-budget-alert'
import './page.css'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

function DiversionContent() {
  const [weekRange, setWeekRange] = useState(() => getCurrentWeekRange())
  const [weekBudget, setWeekBudget] = useState<FondoSemanal | null>(null)
  const [movements, setMovements] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const isCurrentWeek = weekRange.fecha_inicio === getCurrentWeekRange().fecha_inicio

  const loadWeek = useCallback(async (range: { fecha_inicio: string; fecha_fin: string }) => {
    setLoading(true)
    setError(null)
    setAlertDismissed(false)

    try {
      const budget = await fetchActiveWeek(range.fecha_inicio)
      setWeekBudget(budget)
      const movs = await fetchWeekMovements(range.fecha_inicio, range.fecha_fin)
      setMovements(movs)
    } catch {
      setError('Error al cargar los datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refetchMovements = useCallback(async () => {
    setError(null)
    try {
      const movs = await fetchWeekMovements(weekRange.fecha_inicio, weekRange.fecha_fin)
      setMovements(movs)
    } catch {
      setError('Error al cargar los movimientos.')
    }
  }, [weekRange])

  const handleBudgetUpdate = useCallback(
    async (newBudget: number) => {
      if (!weekBudget) return
      setError(null)
      try {
        await updateBudget(weekBudget.id, newBudget)
        const updatedWeek = await fetchActiveWeek(weekRange.fecha_inicio)
        setWeekBudget(updatedWeek)
      } catch {
        setError('Error al actualizar el presupuesto.')
      }
    },
    [weekBudget, weekRange],
  )

  const handleCreateDefaultBudget = useCallback(async () => {
    const { fecha_inicio, fecha_fin } = getCurrentWeekRange()
    await createDefaultFondoSemanal(fecha_inicio, fecha_fin, DEFAULT_MONTO_PRESUPUESTADO)
    await loadWeek(weekRange)
  }, [loadWeek, weekRange])

  const handlePrevWeek = useCallback(() => {
    setWeekRange((prev) => shiftWeekRange(prev.fecha_inicio, -1))
  }, [])

  const handleNextWeek = useCallback(() => {
    setWeekRange((prev) => (isCurrentWeek ? prev : shiftWeekRange(prev.fecha_inicio, 1)))
  }, [isCurrentWeek])

  useEffect(() => {
    loadWeek(weekRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekRange])

  // --- Derived state ---
  const spent = Math.max(
    0,
    -movements.reduce((sum, m) => sum + m.monto, 0),
  )

  const today = getTodayLocal()
  const remaining = weekBudget ? weekBudget.monto_presupuestado - spent : 0
  const daysLeft = weekBudget
    ? getDaysRemainingInclusive(weekBudget.fecha_fin, today)
    : 1
  const dailyAllowance = Math.floor(remaining / daysLeft)

  const weekNav = (
    <div className="diversion-page__week-nav">
      <button
        type="button"
        className="diversion-page__week-nav-btn"
        onClick={handlePrevWeek}
        aria-label="Semana anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="diversion-page__week-label">
        {formatWeekRangeLabel(weekRange)}
        {isCurrentWeek && <span className="diversion-page__week-current-badge">Actual</span>}
      </span>
      <button
        type="button"
        className="diversion-page__week-nav-btn"
        onClick={handleNextWeek}
        disabled={isCurrentWeek}
        aria-label="Semana siguiente"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )

  // --- Loading ---
  if (loading) {
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          <h1 className="diversion-page__title">Diversión</h1>
          {weekNav}
          <div className="diversion-page__loading">Cargando...</div>
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error && !weekBudget && movements.length === 0) {
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          <h1 className="diversion-page__title">Diversión</h1>
          {weekNav}
          <div className="diversion-page__error">{error}</div>
        </div>
      </div>
    )
  }

  // --- No budget for this week ---
  if (!weekBudget) {
    // Current week with no budget yet: the original "let's set one up" flow.
    if (isCurrentWeek) {
      return (
        <div className="diversion-page">
          <div className="diversion-page__container">
            <h1 className="diversion-page__title">Diversión</h1>
            {weekNav}
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

    // Past week with no budget ever set: read-only total + movements only,
    // per the user's explicit "even if it's just the total spent" request.
    return (
      <div className="diversion-page">
        <div className="diversion-page__container">
          <h1 className="diversion-page__title">Diversión</h1>
          {weekNav}
          {error && <div className="diversion-page__error">{error}</div>}
          <p className="diversion-page__past-total">
            Total gastado: <strong>{formatCurrency(spent)}</strong>
          </p>
          <p className="diversion-page__past-note">
            No se registró un presupuesto para esta semana.
          </p>
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

  // --- Main content (budget exists for the selected week) ---
  return (
    <div className="diversion-page">
      <div className="diversion-page__container">
        <h1 className="diversion-page__title">Diversión</h1>
        {weekNav}

        {error && <div className="diversion-page__error">{error}</div>}

        <DiversionProgress spent={spent} budget={weekBudget.monto_presupuestado} />

        {isCurrentWeek && <DiversionDailyAllowance amount={dailyAllowance} />}

        {isCurrentWeek && (
          <DiversionBudgetEdit
            currentBudget={weekBudget.monto_presupuestado}
            onUpdate={handleBudgetUpdate}
          />
        )}

        {isCurrentWeek && <DiversionForm onMovimientoCreado={refetchMovements} />}

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

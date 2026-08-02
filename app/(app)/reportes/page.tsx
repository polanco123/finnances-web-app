'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  fetchNetWorth,
  fetchRetiroTotal,
  fetchSnapshotHistory,
  fetchProximosVencimientos,
  fetchCategoriasDelMes,
  type PatrimonioSnapshot,
  type VencimientoCuenta,
  type CategoriaHeat,
} from '@/components/patrimonio/patrimonio-service'
import {
  fetchActiveWeek,
  fetchWeekMovements,
  type FondoSemanal,
  type Movimiento,
} from '@/components/diversion/diversion-service'
import { getTodayLocal, getDaysRemainingInclusive } from '@/components/diversion/diversion-week-range'
import { jetbrainsMono, inter } from '@/components/patrimonio/patrimonio-fonts'
import PatrimonioHero from '@/components/patrimonio/patrimonio-hero'
import PatrimonioSplit from '@/components/patrimonio/patrimonio-split'
import PatrimonioFondoDiversion from '@/components/patrimonio/patrimonio-fondo-diversion'
import PatrimonioVencimientos from '@/components/patrimonio/patrimonio-vencimientos'
import PatrimonioCategorias from '@/components/patrimonio/patrimonio-categorias'
import '@/components/patrimonio/patrimonio-tokens.css'

interface PatrimonioState {
  netWorth: number
  retiroTotal: number
  retiroCuentas: number
  history: PatrimonioSnapshot[]
  vencimientos: VencimientoCuenta[]
  categorias: CategoriaHeat[]
  activeWeek: FondoSemanal | null
  movements: Movimiento[]
}

/** Days elapsed since `fechaInicio` through `today`, inclusive (min 1). */
function getDaysElapsedInclusive(fechaInicio: string, today: string): number {
  const diffMs = new Date(today).getTime() - new Date(fechaInicio).getTime()
  const diffDays = Math.round(diffMs / 86_400_000)
  return Math.max(1, diffDays + 1)
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jetbrainsMono.variable} ${inter.variable} patrimonio-page`}>
      <div className="patrimonio-page__container">{children}</div>
    </div>
  )
}

function ReportesContent() {
  const [state, setState] = useState<PatrimonioState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const today = getTodayLocal()

        const [netWorth, retiro, history, vencimientos, categorias, activeWeek] = await Promise.all([
          fetchNetWorth(),
          fetchRetiroTotal(),
          fetchSnapshotHistory(14),
          fetchProximosVencimientos(7),
          fetchCategoriasDelMes(),
          fetchActiveWeek(today),
        ])

        const movements = activeWeek
          ? await fetchWeekMovements(activeWeek.fecha_inicio, activeWeek.fecha_fin)
          : []

        setState({
          netWorth,
          retiroTotal: retiro.total,
          retiroCuentas: retiro.count,
          history,
          vencimientos,
          categorias,
          activeWeek,
          movements,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <PageShell>
        <p className="patrimonio-page__loading">Cargando...</p>
      </PageShell>
    )
  }

  if (error || !state) {
    return (
      <PageShell>
        <p className="patrimonio-page__error">{error ?? 'Error al cargar el dashboard'}</p>
      </PageShell>
    )
  }

  const today = getTodayLocal()
  const disponible = state.netWorth - state.retiroTotal
  const spent = Math.max(0, -state.movements.reduce((sum, m) => sum + m.monto, 0))
  const daysLeft = state.activeWeek
    ? getDaysRemainingInclusive(state.activeWeek.fecha_fin, today)
    : 0
  const daysElapsed = state.activeWeek
    ? getDaysElapsedInclusive(state.activeWeek.fecha_inicio, today)
    : 0
  const budget = state.activeWeek?.monto_presupuestado ?? 0

  return (
    <PageShell>
      <header className="patrimonio-masthead">
        <h1 className="patrimonio-masthead__title">Patrimonio</h1>
        <span className="patrimonio-masthead__date">{today}</span>
      </header>

      <PatrimonioHero netWorth={state.netWorth} history={state.history} />

      <PatrimonioSplit
        disponible={disponible}
        retiro={state.retiroTotal}
        retiroCuentas={state.retiroCuentas}
      />

      <PatrimonioFondoDiversion
        budget={budget}
        spent={spent}
        daysLeft={daysLeft}
        daysElapsed={daysElapsed}
      />

      <PatrimonioVencimientos vencimientos={state.vencimientos} />

      <PatrimonioCategorias categorias={state.categorias} />

      <footer className="patrimonio-page__footer">Datos en tiempo real desde Supabase</footer>
    </PageShell>
  )
}

export default function ReportesPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="patrimonio-page__loading">Cargando...</p>
        </PageShell>
      }
    >
      <ReportesContent />
    </Suspense>
  )
}

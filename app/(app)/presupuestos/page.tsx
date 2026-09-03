'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import {
  fetchPresupuestosDelMes,
  fetchGastoPorCategorias,
  computePresupuestoConGasto,
  updatePresupuestoMonto,
  eliminarPresupuesto,
  copiarPresupuestosMesAnterior,
  type Presupuesto,
  type PresupuestoConGasto,
} from '@/components/presupuestos/presupuestos-service'
import { getMesAnterior, getMesSiguiente } from '@/components/presupuestos/presupuestos-dates'
import PresupuestosMesSelector from '@/components/presupuestos/presupuestos-mes-selector'
import PresupuestosResumen from '@/components/presupuestos/presupuestos-resumen'
import PresupuestoForm from '@/components/presupuestos/presupuesto-form'
import PresupuestoCard from '@/components/presupuestos/presupuesto-card'
import { CATEGORIAS } from '@/data/categoria'
import './page.css'

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="presupuestos-page">
      <div className="presupuestos-page__container">{children}</div>
    </div>
  )
}

/** Capitalizes "agosto de 2026" -> "Agosto de 2026", mirrors presupuestos-mes-selector.tsx's formatMesLabel. */
function formatMesLabel(anio: number, mes: number): string {
  const parsed = new Date(anio, mes - 1, 1)
  const label = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(parsed)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function categoriaNombreDe(categoriaId: string): string {
  return CATEGORIAS.find((c) => c.id === categoriaId)?.nombre ?? 'Categoría'
}

function PresupuestosContent() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [copiarError, setCopiarError] = useState<string | null>(null)

  const load = useCallback(async (targetAnio: number, targetMes: number) => {
    setLoading(true)
    setError(null)
    try {
      const delMes = await fetchPresupuestosDelMes(targetAnio, targetMes)
      const gastoPorCategoria = await fetchGastoPorCategorias(
        delMes.map((p) => p.categoriaId),
        targetAnio,
        targetMes,
      )
      const conGasto = delMes.map((p) =>
        computePresupuestoConGasto(p, gastoPorCategoria.get(p.categoriaId) ?? 0),
      )
      setPresupuestos(conGasto)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los presupuestos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(anio, mes)
  }, [anio, mes, load])

  function handleAnterior() {
    const prev = getMesAnterior(anio, mes)
    setShowCreateForm(false)
    setCopiarError(null)
    setAnio(prev.anio)
    setMes(prev.mes)
  }

  function handleSiguiente() {
    const next = getMesSiguiente(anio, mes)
    setShowCreateForm(false)
    setCopiarError(null)
    setAnio(next.anio)
    setMes(next.mes)
  }

  // design.md's Data Flow says the create path prepends to local state "sin
  // refetch" — that refers to not reloading the whole list, not to assuming the
  // new row has no spending. A categoría almost always already has movimientos
  // for the month by the time its presupuesto is created (budgeting mid-month
  // is the normal case), so seeding gastado=0 would render a visibly wrong
  // "$0 de $1,000 — 0%" until the user navigated away and back. Resolve the
  // real gastado for just this categoría; the list itself is still not refetched.
  async function handleCreated(creado: Presupuesto) {
    setShowCreateForm(false)

    let gastado = 0
    try {
      const gastoPorCategoria = await fetchGastoPorCategorias(
        [creado.categoriaId],
        creado.anio,
        creado.mes,
      )
      gastado = gastoPorCategoria.get(creado.categoriaId) ?? 0
    } catch {
      // The presupuesto was created successfully; only the gasto lookup failed.
      // Fall back to 0 rather than dropping the new row — the next month change
      // or reload resolves it.
      gastado = 0
    }

    setPresupuestos((prev) => {
      const nuevo = computePresupuestoConGasto(creado, gastado)
      return prev ? [nuevo, ...prev] : [nuevo]
    })
  }

  // Errors propagate to PresupuestoCard, which catches them itself and shows
  // its own inline error — this handler must NOT swallow the rejection.
  async function handleUpdateMonto(id: string, monto: number) {
    const updated = await updatePresupuestoMonto(id, monto)
    setPresupuestos((prev) =>
      prev ? prev.map((p) => (p.id === id ? computePresupuestoConGasto(updated, p.gastado) : p)) : prev,
    )
  }

  async function handleEliminar(id: string) {
    await eliminarPresupuesto(id)
    setPresupuestos((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  // Per design.md's Data Flow, "copiar" is the one action allowed to refetch.
  async function handleCopiar() {
    setCopiando(true)
    setCopiarError(null)
    try {
      await copiarPresupuestosMesAnterior(anio, mes)
      await load(anio, mes)
    } catch (err) {
      setCopiarError(err instanceof Error ? err.message : 'Error al copiar los presupuestos')
    } finally {
      setCopiando(false)
    }
  }

  const anterior = getMesAnterior(anio, mes)

  const header = (
    <header className="presupuestos-page__header">
      <h1 className="presupuestos-page__title">Presupuestos</h1>
      <button
        type="button"
        className="presupuestos-page__toggle-button"
        onClick={() => setShowCreateForm((prev) => !prev)}
      >
        {showCreateForm ? 'Cancelar' : '+ Nuevo presupuesto'}
      </button>
    </header>
  )

  const createForm = showCreateForm && (
    <div className="presupuestos-page__create-form">
      <PresupuestoForm
        anio={anio}
        mes={mes}
        presupuestos={presupuestos ?? []}
        onCreated={handleCreated}
        onCancel={() => setShowCreateForm(false)}
      />
    </div>
  )

  return (
    <PageShell>
      {header}
      <PresupuestosMesSelector
        anio={anio}
        mes={mes}
        onAnterior={handleAnterior}
        onSiguiente={handleSiguiente}
      />
      {createForm}

      {loading && <p className="presupuestos-page__loading">Cargando presupuestos...</p>}

      {!loading && error && <p className="presupuestos-page__error">{error}</p>}

      {!loading && !error && presupuestos && presupuestos.length === 0 && (
        <div className="presupuestos-page__empty">
          <p className="presupuestos-page__empty-text">
            No hay presupuestos para {formatMesLabel(anio, mes)}. Crea el primero con &quot;+ Nuevo
            presupuesto&quot;.
          </p>
          <button
            type="button"
            className="presupuestos-page__copy-button"
            onClick={handleCopiar}
            disabled={copiando}
          >
            {copiando
              ? 'Copiando...'
              : `Copiar presupuestos de ${formatMesLabel(anterior.anio, anterior.mes)}`}
          </button>
          {copiarError && <p className="presupuestos-page__error">{copiarError}</p>}
        </div>
      )}

      {!loading && !error && presupuestos && presupuestos.length > 0 && (
        <>
          <PresupuestosResumen
            totalPresupuestado={presupuestos.reduce((sum, p) => sum + p.monto, 0)}
            totalGastado={presupuestos.reduce((sum, p) => sum + p.gastado, 0)}
          />
          <div className="presupuestos-page__list">
            {presupuestos.map((p) => (
              <PresupuestoCard
                key={p.id}
                presupuesto={p}
                categoriaNombre={categoriaNombreDe(p.categoriaId)}
                onUpdateMonto={handleUpdateMonto}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="presupuestos-page">
          <p className="presupuestos-page__loading">Cargando...</p>
        </div>
      }
    >
      <PresupuestosContent />
    </Suspense>
  )
}

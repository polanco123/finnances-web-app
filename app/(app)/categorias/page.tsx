'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  getTodayLocal,
  getRangoDia,
  getRangoSemanal,
  getRangoQuincenal,
  getRangoMensual,
  getRangoAnual,
  type RangoFecha,
} from '@/components/categorias/categorias-dates'
import {
  fetchCategoriasConGasto,
  updateCategoriaIcono,
  type CategoriaConGasto,
} from '@/components/categorias/categorias-service'
import CategoriasPeriodFilter, {
  type PeriodoTipo,
} from '@/components/categorias/categorias-period-filter'
import CategoriaCard from '@/components/categorias/categorias-card'
import { CATEGORIAS, syncCategorias } from '@/lib/catalogs/catalog-store'
import './page.css'

function resolveRango(
  periodo: PeriodoTipo,
  desdePersonalizado: string,
  hastaPersonalizado: string,
): RangoFecha {
  switch (periodo) {
    case 'dia':
      return getRangoDia()
    case 'semanal':
      return getRangoSemanal()
    case 'quincenal':
      return getRangoQuincenal()
    case 'mensual':
      return getRangoMensual()
    case 'anual':
      return getRangoAnual()
    case 'periodo':
      return { desde: desdePersonalizado, hasta: hastaPersonalizado }
  }
}

function CategoriasContent() {
  const [periodo, setPeriodo] = useState<PeriodoTipo>('mensual')
  const [desdePersonalizado, setDesdePersonalizado] = useState(getTodayLocal())
  const [hastaPersonalizado, setHastaPersonalizado] = useState(getTodayLocal())
  const [categorias, setCategorias] = useState<CategoriaConGasto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { desde, hasta } = resolveRango(periodo, desdePersonalizado, hastaPersonalizado)

  async function handleUpdateCategoriaIcono(id: string, icono: string) {
    const updated = await updateCategoriaIcono(id, icono)
    setCategorias((prev) =>
      prev ? prev.map((c) => (c.categoriaId === id ? { ...c, icono: updated.icono } : c)) : prev,
    )
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      await syncCategorias()
      window.location.reload()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Error al sincronizar catálogo de categorías')
      setSyncing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCategoriasConGasto(desde, hasta)
        if (!cancelled) setCategorias(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar las categorías')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [desde, hasta])

  function handleRangoPersonalizadoChange(nuevoDesde: string, nuevoHasta: string) {
    setDesdePersonalizado(nuevoDesde)
    setHastaPersonalizado(nuevoHasta)
  }

  const catalogEmpty = CATEGORIAS.length === 0

  return (
    <div className="categorias-page">
      <div className="categorias-page__header">
        <h1 className="categorias-page__title">Categorías</h1>
        <button
          type="button"
          className="categorias-page__sync-button"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
        </button>
      </div>

      {catalogEmpty && (
        <div className="categorias-page__catalog-banner">
          Datos no sincronizados. Haz clic en Sincronizar para cargar las categorías desde Supabase.
        </div>
      )}
      {syncError && <div className="categorias-page__error">{syncError}</div>}

      <CategoriasPeriodFilter
        periodo={periodo}
        desdePersonalizado={desdePersonalizado}
        hastaPersonalizado={hastaPersonalizado}
        onPeriodoChange={setPeriodo}
        onRangoPersonalizadoChange={handleRangoPersonalizadoChange}
      />

      {loading && <div className="categorias-page__loading">Cargando categorías...</div>}

      {!loading && error && <div className="categorias-page__error">{error}</div>}

      {!loading && !error && categorias && categorias.length === 0 && (
        <div className="categorias-page__empty">
          No se encontró gasto en ninguna categoría para el periodo seleccionado
        </div>
      )}

      {!loading && !error && categorias && categorias.length > 0 && (
        <div className="categorias-page__grid">
          {categorias.map((categoria) => (
            <CategoriaCard
              key={categoria.categoriaId}
              categoria={categoria}
              onUpdateIcono={handleUpdateCategoriaIcono}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="categorias-page">
          <div className="categorias-page__loading">Cargando...</div>
        </div>
      }
    >
      <CategoriasContent />
    </Suspense>
  )
}

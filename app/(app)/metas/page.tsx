'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  archivarMeta,
  computeProgreso,
  crearAbono,
  crearMeta,
  deleteAbono,
  fetchAbonosPorMetas,
  fetchActiveMetas,
  updateAbono,
  updateMeta,
  type Meta,
  type MetaAbono,
  type MetaConProgreso,
} from '@/components/metas/metas-service'
import MetaCard from '@/components/metas/meta-card'
import MetaForm from '@/components/metas/meta-form'
import './page.css'

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="metas-page">
      <div className="metas-page__container">{children}</div>
    </div>
  )
}

function MetasContent() {
  const [metas, setMetas] = useState<Meta[] | null>(null)
  const [abonosPorMeta, setAbonosPorMeta] = useState<Record<string, MetaAbono[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const activeMetas = await fetchActiveMetas()
        const abonos = await fetchAbonosPorMetas(activeMetas.map((m) => m.id))

        const grouped: Record<string, MetaAbono[]> = {}
        for (const abono of abonos) {
          if (!grouped[abono.metaId]) grouped[abono.metaId] = []
          grouped[abono.metaId].push(abono)
        }

        setMetas(activeMetas)
        setAbonosPorMeta(grouped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar las metas')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  async function handleCrearMeta(values: {
    nombre: string
    montoObjetivo: number
    montoInicial: number
    fechaObjetivo: string | null
  }) {
    const nueva = await crearMeta(values.nombre, values.montoObjetivo, values.montoInicial, values.fechaObjetivo)
    setMetas((prev) => (prev ? [nueva, ...prev] : [nueva]))
    setShowCreateForm(false)
  }

  async function handleUpdateMeta(id: string, updates: Partial<Meta>) {
    const updated = await updateMeta(id, updates)
    setMetas((prev) => (prev ? prev.map((m) => (m.id === id ? updated : m)) : prev))
  }

  async function handleArchivar(id: string) {
    await archivarMeta(id)
    setMetas((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
    setAbonosPorMeta((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleCrearAbono(metaId: string, monto: number, fecha: string, nota: string | null) {
    const nuevo = await crearAbono(metaId, monto, fecha, nota)
    setAbonosPorMeta((prev) => ({
      ...prev,
      [metaId]: [...(prev[metaId] ?? []), nuevo],
    }))
  }

  async function handleUpdateAbono(id: string, updates: Partial<MetaAbono>) {
    const updated = await updateAbono(id, updates)
    setAbonosPorMeta((prev) => {
      const metaId = updated.metaId
      const existing = prev[metaId] ?? []
      return {
        ...prev,
        [metaId]: existing.map((a) => (a.id === id ? updated : a)),
      }
    })
  }

  async function handleDeleteAbono(id: string) {
    let ownerMetaId: string | null = null
    for (const [metaId, abonos] of Object.entries(abonosPorMeta)) {
      if (abonos.some((a) => a.id === id)) {
        ownerMetaId = metaId
        break
      }
    }

    await deleteAbono(id)

    if (ownerMetaId) {
      setAbonosPorMeta((prev) => ({
        ...prev,
        [ownerMetaId as string]: (prev[ownerMetaId as string] ?? []).filter((a) => a.id !== id),
      }))
    }
  }

  const header = (
    <header className="metas-page__header">
      <h1 className="metas-page__title">Metas</h1>
      <button
        type="button"
        className="metas-page__toggle-button"
        onClick={() => setShowCreateForm((prev) => !prev)}
      >
        {showCreateForm ? 'Cancelar' : '+ Nueva meta'}
      </button>
    </header>
  )

  const createForm = showCreateForm && (
    <div className="metas-page__create-form">
      <MetaForm onSubmit={handleCrearMeta} onCancel={() => setShowCreateForm(false)} />
    </div>
  )

  if (loading) {
    return (
      <PageShell>
        {header}
        <p className="metas-page__loading">Cargando metas...</p>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        {header}
        <p className="metas-page__error">{error}</p>
      </PageShell>
    )
  }

  if (!metas || metas.length === 0) {
    return (
      <PageShell>
        {header}
        {createForm}
        <p className="metas-page__empty">No hay metas activas. Crea la primera con &quot;+ Nueva meta&quot;.</p>
      </PageShell>
    )
  }

  const metasConProgreso: MetaConProgreso[] = metas.map((meta) =>
    computeProgreso(meta, abonosPorMeta[meta.id] ?? []),
  )

  return (
    <PageShell>
      {header}
      {createForm}
      <div className="metas-page__list">
        {metasConProgreso.map((meta) => (
          <MetaCard
            key={meta.id}
            meta={meta}
            abonos={abonosPorMeta[meta.id] ?? []}
            onUpdateMeta={handleUpdateMeta}
            onArchivar={handleArchivar}
            onCrearAbono={handleCrearAbono}
            onUpdateAbono={handleUpdateAbono}
            onDeleteAbono={handleDeleteAbono}
          />
        ))}
      </div>
    </PageShell>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="metas-page__loading">Cargando...</p>
        </PageShell>
      }
    >
      <MetasContent />
    </Suspense>
  )
}

'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import type { Meta, MetaAbono, MetaConProgreso } from './metas-service'
import MetaProgressBar from './metas-progress'
import MetaProgresoChart from './metas-progreso-chart'
import MetaForm from './meta-form'
import MetaAbonoForm from './meta-abono-form'
import './meta-card.css'

interface MetaCardProps {
  meta: MetaConProgreso
  abonos: MetaAbono[] // pre-filtered to this meta's id by the page
  onUpdateMeta: (id: string, updates: Partial<Meta>) => Promise<void>
  onArchivar: (id: string) => Promise<void>
  onCrearAbono: (metaId: string, monto: number, fecha: string, nota: string | null) => Promise<void>
  onUpdateAbono: (id: string, updates: Partial<MetaAbono>) => Promise<void>
  onDeleteAbono: (id: string) => Promise<void>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

/**
 * Accordion card for a savings goal — mirrors `cuentas-card.tsx`'s
 * `useState(expanded)` + `ChevronDown` pattern. Collapsed shows the name and
 * progress bar; expanded reveals the progress-over-time chart, the abono log
 * (with per-row edit/delete), an inline add-abono form, and the goal's own
 * edit/archive affordances.
 */
export default function MetaCard({
  meta,
  abonos,
  onUpdateMeta,
  onArchivar,
  onCrearAbono,
  onUpdateAbono,
  onDeleteAbono,
}: MetaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null)

  const sortedAbonos = [...abonos].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const handleUpdateMeta = async (values: {
    nombre: string
    montoObjetivo: number
    montoInicial: number
    fechaObjetivo: string | null
  }) => {
    await onUpdateMeta(meta.id, values)
    setEditingMeta(false)
  }

  const handleCrearAbono = async (values: { monto: number; fecha: string; nota: string | null }) => {
    await onCrearAbono(meta.id, values.monto, values.fecha, values.nota)
  }

  const handleUpdateAbono = async (
    abonoId: string,
    values: { monto: number; fecha: string; nota: string | null },
  ) => {
    await onUpdateAbono(abonoId, values)
    setEditingAbonoId(null)
  }

  return (
    <div className="meta-card">
      <button
        type="button"
        className="meta-card__row"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="meta-card__main">
          <span className="meta-card__name">{meta.nombre}</span>
          <MetaProgressBar
            montoActual={meta.montoActual}
            montoObjetivo={meta.montoObjetivo}
            cumplida={meta.cumplida}
          />
        </span>
        <ChevronDown
          className={`meta-card__chevron ${expanded ? 'meta-card__chevron--expanded' : ''}`}
          size={18}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="meta-card__detail">
          <div className="meta-card__actions">
            <button
              type="button"
              className="meta-card__action-btn"
              onClick={() => setEditingMeta((prev) => !prev)}
            >
              <Pencil size={14} aria-hidden="true" />
              Editar meta
            </button>
            <button
              type="button"
              className="meta-card__action-btn meta-card__action-btn--danger"
              onClick={() => onArchivar(meta.id)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Archivar
            </button>
          </div>

          {editingMeta && (
            <div className="meta-card__meta-form">
              <MetaForm meta={meta} onSubmit={handleUpdateMeta} onCancel={() => setEditingMeta(false)} />
            </div>
          )}

          <MetaProgresoChart montoInicial={meta.montoInicial} abonos={abonos} />

          <div className="meta-card__abonos">
            {sortedAbonos.length === 0 ? (
              <p className="meta-card__empty">Sin abonos registrados.</p>
            ) : (
              sortedAbonos.map((abono) =>
                editingAbonoId === abono.id ? (
                  <div key={abono.id} className="meta-card__abono-row meta-card__abono-row--editing">
                    <MetaAbonoForm
                      abono={abono}
                      onSubmit={(values) => handleUpdateAbono(abono.id, values)}
                      onCancel={() => setEditingAbonoId(null)}
                    />
                  </div>
                ) : (
                  <div key={abono.id} className="meta-card__abono-row">
                    <span className="meta-card__abono-fecha">{formatFecha(abono.fecha)}</span>
                    <span
                      className={`meta-card__abono-monto${abono.monto < 0 ? ' meta-card__abono-monto--negative' : ''}`}
                    >
                      {abono.monto >= 0 ? '+' : ''}
                      {formatCurrency(abono.monto)}
                    </span>
                    {abono.nota && <span className="meta-card__abono-nota">{abono.nota}</span>}
                    <span className="meta-card__abono-row-actions">
                      <button
                        type="button"
                        className="meta-card__icon-btn"
                        onClick={() => setEditingAbonoId(abono.id)}
                        aria-label="Editar abono"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="meta-card__icon-btn meta-card__icon-btn--danger"
                        onClick={() => {
                          if (window.confirm('¿Eliminar este abono? Esta acción no se puede deshacer.')) {
                            onDeleteAbono(abono.id)
                          }
                        }}
                        aria-label="Eliminar abono"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                ),
              )
            )}
          </div>

          <div className="meta-card__add-abono">
            <MetaAbonoForm onSubmit={handleCrearAbono} />
          </div>
        </div>
      )}
    </div>
  )
}

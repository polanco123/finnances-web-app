'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import type { PresupuestoConGasto } from './presupuestos-service'
import PresupuestoProgress from './presupuesto-progress'
import { CATEGORIAS } from '@/data/categoria'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import { resolveIconColor } from '@/lib/catalogs/icon-colors'
import './presupuesto-card.css'

interface PresupuestoCardProps {
  presupuesto: PresupuestoConGasto
  categoriaNombre: string
  onUpdateMonto: (id: string, monto: number) => Promise<void>
  onEliminar: (id: string) => Promise<void>
}

/** Repo convention (no shared helper) — same duplication as `presupuesto-progress.tsx`. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Accordion card for a monthly presupuesto — mirrors `meta-card.tsx`'s
 * `useState(expanded)` + `ChevronDown` pattern. Collapsed shows the
 * categoría's icon/nombre (resolved from `presupuesto.categoriaId` via
 * `CATEGORIAS`, same `resolveIcon`/`resolveIconColor` pair used by
 * `categorias-card.tsx`/`cuentas-card.tsx`) and the gastado-vs-monto progress
 * bar; expanded reveals an inline edit-monto form and a delete affordance.
 *
 * Only `monto` is editable here — categoría, año and mes identify a
 * different presupuesto entirely and are never edited from this card. Edit
 * and delete are wired identically regardless of whether `presupuesto.mes`
 * is past, current or future: there is no "mes cerrado" branch in this
 * component, per the spec's "Cualquier mes es totalmente editable y
 * eliminable" requirement. Both operations are reported upward via
 * `onUpdateMonto`/`onEliminar` so the parent page can patch local state
 * without a full refetch (mirrors `meta-card.tsx`'s `onUpdateMeta`/
 * `onArchivar` callback shape).
 */
export default function PresupuestoCard({
  presupuesto,
  categoriaNombre,
  onUpdateMonto,
  onEliminar,
}: PresupuestoCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [monto, setMonto] = useState(presupuesto.monto.toString())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const categoria = CATEGORIAS.find((c) => c.id === presupuesto.categoriaId)
  const Icon = resolveIcon(categoria?.icono, 'categoria')

  const handleStartEditing = () => {
    setMonto(presupuesto.monto.toString())
    setError(null)
    setEditing(true)
  }

  const handleCancelEditing = () => {
    setError(null)
    setEditing(false)
  }

  const handleUpdateMonto = async () => {
    const parsedMonto = Number(monto)
    if (monto.trim() === '' || isNaN(parsedMonto) || parsedMonto <= 0) {
      setError('El monto debe ser un número positivo')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onUpdateMonto(presupuesto.id, parsedMonto)
      setEditing(false)
    } catch {
      setError('Error al guardar el monto. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    if (!window.confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await onEliminar(presupuesto.id)
    } catch {
      setError('Error al eliminar el presupuesto. Intenta de nuevo.')
      setDeleting(false)
    }
  }

  return (
    <div className="presupuesto-card">
      <button
        type="button"
        className="presupuesto-card__row"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="presupuesto-card__main">
          <span className="presupuesto-card__name">
            <Icon
              className="presupuesto-card__icon"
              size={16}
              aria-hidden="true"
              style={{ color: resolveIconColor(categoria?.color) }}
            />
            {categoriaNombre}
          </span>
          <PresupuestoProgress gastado={presupuesto.gastado} monto={presupuesto.monto} />
        </span>
        <ChevronDown
          className={`presupuesto-card__chevron ${expanded ? 'presupuesto-card__chevron--expanded' : ''}`}
          size={18}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="presupuesto-card__detail">
          <div className="presupuesto-card__actions">
            <button
              type="button"
              className="presupuesto-card__action-btn"
              onClick={() => (editing ? handleCancelEditing() : handleStartEditing())}
            >
              <Pencil size={14} aria-hidden="true" />
              Editar
            </button>
            <button
              type="button"
              className="presupuesto-card__action-btn presupuesto-card__action-btn--danger"
              onClick={handleEliminar}
              disabled={deleting}
            >
              <Trash2 size={14} aria-hidden="true" />
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>

          {error && <p className="presupuesto-card__error">{error}</p>}

          {editing && (
            <div className="presupuesto-card__edit-form">
              <div className="presupuesto-card__field">
                <label
                  className="presupuesto-card__label"
                  htmlFor={`presupuesto-card-monto-${presupuesto.id}`}
                >
                  Monto
                </label>
                <input
                  id={`presupuesto-card-monto-${presupuesto.id}`}
                  className={`presupuesto-card__input ${error ? 'presupuesto-card__input--error' : ''}`}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={(e) => {
                    setMonto(e.target.value)
                    setError(null)
                  }}
                  placeholder={formatCurrency(presupuesto.monto)}
                  autoFocus
                />
              </div>

              <div className="presupuesto-card__form-actions">
                <button
                  type="button"
                  className="presupuesto-card__btn presupuesto-card__btn--save"
                  onClick={handleUpdateMonto}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="presupuesto-card__btn presupuesto-card__btn--cancel"
                  onClick={handleCancelEditing}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

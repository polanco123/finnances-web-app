'use client'

import { useState } from 'react'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { CATEGORIAS, esCategoriaDeGasto } from '@/data/categoria'
import { crearPresupuesto, PresupuestoDuplicadoError, type Presupuesto } from './presupuestos-service'
import './presupuesto-form.css'

interface PresupuestoFormProps {
  anio: number
  mes: number
  /**
   * Presupuestos already created for this `(anio, mes)`. Used to exclude
   * their categorías from the picker so a duplicate can never be attempted
   * from the UI — `PresupuestoDuplicadoError` below remains the safety net,
   * not the expected flow.
   */
  presupuestos: Presupuesto[]
  onCreated: (presupuesto: Presupuesto) => void
  onCancel?: () => void
}

/**
 * Inline creation form for a `presupuesto`: categoría + monto. Mirrors
 * `meta-form.tsx`'s structure (field/label/input, inline error, save/cancel
 * actions), but — per design.md's Data Flow ("CREAR PRESUPUESTO SUELTO") —
 * calls `crearPresupuesto` directly instead of delegating through an
 * `onSubmit` prop: the service call itself decides success (report the
 * created row up via `onCreated` so the caller can prepend it without a
 * refetch) vs. `PresupuestoDuplicadoError` (inline error only, no state
 * change), so there is nothing left for a page-level handler to branch on.
 */
export default function PresupuestoForm({
  anio,
  mes,
  presupuestos,
  onCreated,
  onCancel,
}: PresupuestoFormProps) {
  const [categoriaId, setCategoriaId] = useState('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // esCategoriaDeGasto excludes tipo='ingreso' (and any non-gasto tipo); the
  // second filter excludes categorías that already have a presupuesto this
  // month. The picker itself does not filter by type or availability —
  // filtering is the caller's responsibility (verified in
  // catalog-picker-popup.tsx, which renders `options` as given).
  const options = CATEGORIAS.filter((c) => esCategoriaDeGasto(c.tipo))
    .filter((c) => !presupuestos.some((p) => p.categoriaId === c.id))
    .map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono, color: c.color }))

  const handleSubmit = async () => {
    if (!categoriaId) {
      setError('Selecciona una categoría')
      return
    }

    const parsedMonto = Number(monto)
    if (!monto || isNaN(parsedMonto) || parsedMonto <= 0) {
      setError('El monto debe ser un número positivo')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const creado = await crearPresupuesto(categoriaId, parsedMonto, anio, mes)
      onCreated(creado)
      setCategoriaId('')
      setMonto('')
    } catch (err) {
      if (err instanceof PresupuestoDuplicadoError) {
        // Should be unreachable via the picker filter above — kept as an
        // explicit, readable message rather than letting a raw Postgres
        // error surface if this component's `presupuestos` prop is ever
        // stale relative to the server.
        setError('Ya existe un presupuesto para esta categoría en este mes')
      } else {
        setError('Error al guardar el presupuesto. Intenta de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="presupuesto-form">
      <AutocompleteInput
        label="Categoría"
        options={options}
        value={categoriaId}
        onChange={(id) => {
          setCategoriaId(id)
          setError(null)
        }}
        placeholder="Buscar categoría..."
        kind="categoria"
      />

      <div className="presupuesto-form__field">
        <label className="presupuesto-form__label" htmlFor="presupuesto-form-monto">
          Monto
        </label>
        <input
          id="presupuesto-form-monto"
          className={`presupuesto-form__input ${error ? 'presupuesto-form__input--error' : ''}`}
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            setError(null)
          }}
          placeholder="0.00"
        />
      </div>

      {error && <p className="presupuesto-form__error">{error}</p>}

      <div className="presupuesto-form__actions">
        <button
          type="button"
          className="presupuesto-form__btn presupuesto-form__btn--save"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="presupuesto-form__btn presupuesto-form__btn--cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

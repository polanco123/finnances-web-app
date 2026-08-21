'use client'

import { useState } from 'react'
import type { Meta } from './metas-service'
import './meta-form.css'

interface MetaFormValues {
  nombre: string
  montoObjetivo: number
  montoInicial: number
  fechaObjetivo: string | null
}

interface MetaFormProps {
  meta?: Meta
  onSubmit: (values: MetaFormValues) => Promise<void>
  onCancel?: () => void
}

export default function MetaForm({ meta, onSubmit, onCancel }: MetaFormProps) {
  const [nombre, setNombre] = useState(meta?.nombre ?? '')
  const [montoObjetivo, setMontoObjetivo] = useState(
    meta ? meta.montoObjetivo.toString() : '',
  )
  const [montoInicial, setMontoInicial] = useState(
    meta ? meta.montoInicial.toString() : '0',
  )
  const [fechaObjetivo, setFechaObjetivo] = useState(meta?.fechaObjetivo ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setError('El nombre es obligatorio')
      return
    }

    const parsedObjetivo = Number(montoObjetivo)
    if (isNaN(parsedObjetivo) || parsedObjetivo <= 0) {
      setError('El monto objetivo debe ser un número positivo')
      return
    }

    const parsedInicial = montoInicial === '' ? 0 : Number(montoInicial)
    if (isNaN(parsedInicial)) {
      setError('El monto inicial debe ser un número')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSubmit({
        nombre: trimmedNombre,
        montoObjetivo: parsedObjetivo,
        montoInicial: parsedInicial,
        fechaObjetivo: fechaObjetivo || null,
      })
      if (!meta) {
        setNombre('')
        setMontoObjetivo('')
        setMontoInicial('0')
        setFechaObjetivo('')
      }
    } catch {
      setError('Error al guardar la meta. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="meta-form">
      <div className="meta-form__field">
        <label className="meta-form__label" htmlFor="meta-form-nombre">
          Nombre
        </label>
        <input
          id="meta-form-nombre"
          className="meta-form__input"
          type="text"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setError(null)
          }}
          placeholder="Nombre de la meta"
          autoFocus
        />
      </div>

      <div className="meta-form__field">
        <label className="meta-form__label" htmlFor="meta-form-objetivo">
          Monto objetivo
        </label>
        <input
          id="meta-form-objetivo"
          className={`meta-form__input ${error ? 'meta-form__input--error' : ''}`}
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={montoObjetivo}
          onChange={(e) => {
            setMontoObjetivo(e.target.value)
            setError(null)
          }}
          placeholder="Monto a alcanzar"
        />
      </div>

      <div className="meta-form__field">
        <label className="meta-form__label" htmlFor="meta-form-inicial">
          Monto inicial
        </label>
        <input
          id="meta-form-inicial"
          className="meta-form__input"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={montoInicial}
          onChange={(e) => {
            setMontoInicial(e.target.value)
            setError(null)
          }}
          placeholder="0"
        />
      </div>

      <div className="meta-form__field">
        <label className="meta-form__label" htmlFor="meta-form-fecha">
          Fecha objetivo (opcional)
        </label>
        <input
          id="meta-form-fecha"
          className="meta-form__input"
          type="date"
          value={fechaObjetivo ?? ''}
          onChange={(e) => setFechaObjetivo(e.target.value)}
        />
      </div>

      {error && <p className="meta-form__error">{error}</p>}

      <div className="meta-form__actions">
        <button
          className="meta-form__btn meta-form__btn--save"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Guardando...' : meta ? 'Guardar cambios' : 'Crear meta'}
        </button>
        {onCancel && (
          <button
            className="meta-form__btn meta-form__btn--cancel"
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

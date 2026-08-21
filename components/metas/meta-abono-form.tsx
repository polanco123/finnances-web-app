'use client'

import { useState } from 'react'
import type { MetaAbono } from './metas-service'
import './meta-abono-form.css'

interface MetaAbonoFormValues {
  monto: number
  fecha: string
  nota: string | null
}

interface MetaAbonoFormProps {
  abono?: MetaAbono
  onSubmit: (values: MetaAbonoFormValues) => Promise<void>
  onCancel?: () => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MetaAbonoForm({ abono, onSubmit, onCancel }: MetaAbonoFormProps) {
  const [monto, setMonto] = useState(abono ? abono.monto.toString() : '')
  const [fecha, setFecha] = useState(abono?.fecha ?? todayIso())
  const [nota, setNota] = useState(abono?.nota ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const parsedMonto = Number(monto)
    if (monto.trim() === '' || isNaN(parsedMonto) || parsedMonto === 0) {
      setError('El monto es obligatorio y debe ser distinto de cero')
      return
    }

    if (!fecha) {
      setError('La fecha es obligatoria')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSubmit({
        monto: parsedMonto,
        fecha,
        nota: nota.trim() || null,
      })
      if (!abono) {
        setMonto('')
        setFecha(todayIso())
        setNota('')
      }
    } catch {
      setError('Error al guardar el abono. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="meta-abono-form">
      <div className="meta-abono-form__field">
        <label className="meta-abono-form__label" htmlFor="meta-abono-form-monto">
          Monto
        </label>
        <input
          id="meta-abono-form-monto"
          className={`meta-abono-form__input ${error ? 'meta-abono-form__input--error' : ''}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            setError(null)
          }}
          placeholder="Positivo = aportación, negativo = retiro"
          autoFocus
        />
      </div>

      <div className="meta-abono-form__field">
        <label className="meta-abono-form__label" htmlFor="meta-abono-form-fecha">
          Fecha
        </label>
        <input
          id="meta-abono-form-fecha"
          className="meta-abono-form__input"
          type="date"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value)
            setError(null)
          }}
        />
      </div>

      <div className="meta-abono-form__field">
        <label className="meta-abono-form__label" htmlFor="meta-abono-form-nota">
          Nota (opcional)
        </label>
        <input
          id="meta-abono-form-nota"
          className="meta-abono-form__input"
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota"
        />
      </div>

      {error && <p className="meta-abono-form__error">{error}</p>}

      <div className="meta-abono-form__actions">
        <button
          className="meta-abono-form__btn meta-abono-form__btn--save"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Guardando...' : abono ? 'Guardar cambios' : 'Agregar abono'}
        </button>
        {onCancel && (
          <button
            className="meta-abono-form__btn meta-abono-form__btn--cancel"
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

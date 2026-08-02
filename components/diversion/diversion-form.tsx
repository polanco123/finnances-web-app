'use client'

import { useState } from 'react'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { CUENTAS } from '@/lib/catalogs/cuentas'
import { crearGastoDiversion } from '@/components/diversion/diversion-mapper'
import { insertDiversionMovimiento } from '@/components/diversion/diversion-service'
import './diversion-form.css'

interface DiversionFormProps {
  onMovimientoCreado: () => void
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

export default function DiversionForm({ onMovimientoCreado }: DiversionFormProps) {
  const [monto, setMonto] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [fecha, setFecha] = useState(todayString())
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cuentasOptions = CUENTAS.map((c) => ({ id: c.id, nombre: c.nombre }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError('El monto debe ser un número positivo')
      return
    }

    if (!cuentaId) {
      setError('Selecciona una cuenta')
      return
    }

    setSaving(true)

    try {
      const payload = crearGastoDiversion({
        cuenta_id: cuentaId,
        monto: montoNum,
        fecha,
      })

      const finalPayload = {
        ...payload,
        notas: notas.trim() || null,
      }

      await insertDiversionMovimiento(finalPayload)

      // Reset form
      setMonto('')
      setCuentaId('')
      setFecha(todayString())
      setNotas('')
      setError(null)

      onMovimientoCreado()
    } catch {
      setError('Error al registrar el gasto. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="diversion-form">
      <h2 className="diversion-form__title">Registrar gasto de diversión</h2>

      {error && <p className="diversion-form__error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <AutocompleteInput
          label="Cuenta"
          options={cuentasOptions}
          value={cuentaId}
          onChange={setCuentaId}
          placeholder="Buscar cuenta..."
        />

        <div className="diversion-form__group">
          <label className="diversion-form__label">Monto</label>
          <input
            className={`diversion-form__input ${error && !monto ? 'diversion-form__input--error' : ''}`}
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

        <div className="diversion-form__group">
          <label className="diversion-form__label">Fecha</label>
          <input
            className="diversion-form__input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="diversion-form__group">
          <label className="diversion-form__label">Notas (opcional)</label>
          <textarea
            className="diversion-form__textarea"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Descripción del gasto..."
            rows={2}
          />
        </div>

        <button
          className="diversion-form__button"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Registrando...' : 'Registrar gasto'}
        </button>
      </form>
    </div>
  )
}

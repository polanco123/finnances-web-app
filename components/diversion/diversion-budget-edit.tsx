'use client'

import { useState } from 'react'
import './diversion-budget-edit.css'

interface DiversionBudgetEditProps {
  currentBudget: number
  onUpdate: (newBudget: number) => Promise<void>
}

export default function DiversionBudgetEdit({
  currentBudget,
  onUpdate,
}: DiversionBudgetEditProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleEdit = () => {
    setValue(currentBudget.toString())
    setError(null)
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    setValue('')
    setError(null)
  }

  const handleSave = async () => {
    const parsed = Number(value)
    if (isNaN(parsed) || parsed <= 0) {
      setError('El presupuesto debe ser un número positivo')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onUpdate(parsed)
      setEditing(false)
      setValue('')
    } catch {
      setError('Error al actualizar el presupuesto. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const formattedBudget = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(currentBudget)

  return (
    <div className="diversion-budget-edit">
      {editing ? (
        <div className="diversion-budget-edit__form">
          <label className="diversion-budget-edit__label">
            Presupuesto semanal
          </label>
          <input
            className={`diversion-budget-edit__input ${error ? 'diversion-budget-edit__input--error' : ''}`}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            placeholder="Monto presupuestado"
            autoFocus
          />
          {error && <p className="diversion-budget-edit__error">{error}</p>}
          <div className="diversion-budget-edit__actions">
            <button
              className="diversion-budget-edit__btn diversion-budget-edit__btn--save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              className="diversion-budget-edit__btn diversion-budget-edit__btn--cancel"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="diversion-budget-edit__display">
          <div className="diversion-budget-edit__info">
            <span className="diversion-budget-edit__label">Presupuesto semanal</span>
            <span className="diversion-budget-edit__amount">{formattedBudget}</span>
          </div>
          <button
            className="diversion-budget-edit__btn diversion-budget-edit__btn--edit"
            onClick={handleEdit}
          >
            Editar
          </button>
        </div>
      )}
    </div>
  )
}

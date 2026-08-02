'use client'

import { useState } from 'react'
import './diversion-missing-budget-alert.css'

interface DiversionMissingBudgetAlertProps {
  defaultAmount: number
  onAccept: () => Promise<void>
  onClose: () => void
}

export default function DiversionMissingBudgetAlert({
  defaultAmount,
  onAccept,
  onClose,
}: DiversionMissingBudgetAlertProps) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setCreating(true)
    setError(null)

    try {
      await onAccept()
    } catch {
      setError('Error al crear el presupuesto. Intenta de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  const formattedDefaultAmount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(defaultAmount)

  return (
    <div className="diversion-missing-budget-alert">
      <p className="diversion-missing-budget-alert__message">
        No existe fondo semanal, ¿crear uno nuevo con la cantidad default (
        {formattedDefaultAmount})?
      </p>

      {error && <p className="diversion-missing-budget-alert__error">{error}</p>}

      <div className="diversion-missing-budget-alert__actions">
        <button
          className="diversion-missing-budget-alert__btn diversion-missing-budget-alert__btn--accept"
          onClick={handleAccept}
          disabled={creating}
        >
          {creating ? 'Creando...' : 'Aceptar'}
        </button>
        <button
          className="diversion-missing-budget-alert__btn diversion-missing-budget-alert__btn--close"
          onClick={onClose}
          disabled={creating}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

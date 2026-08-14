'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import './deuda-marcar-pagado-modal.css'

interface DeudaMarcarPagadoModalProps {
  cuentaNombre: string
  montoPlaneado: number
  onConfirm: (montoPagado: number) => Promise<void>
  onCancel: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Confirmation modal for "marcar como pagado" — replaces a bare
 * `window.prompt()`. Pure CSS, no dialog/modal library. Defaults the
 * monto pagado input to the record's monto_planeado (editable in case
 * the real payment differs).
 */
export default function DeudaMarcarPagadoModal({
  cuentaNombre,
  montoPlaneado,
  onConfirm,
  onCancel,
}: DeudaMarcarPagadoModalProps) {
  const [monto, setMonto] = useState(montoPlaneado.toString())
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  async function handleConfirm() {
    const parsed = Number(monto)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      return
    }

    setConfirming(true)
    setError(null)
    try {
      await onConfirm(parsed)
    } catch {
      setError('Error al registrar el pago. Intenta de nuevo.')
      setConfirming(false)
    }
  }

  return (
    <div className="deuda-modal__overlay" onClick={onCancel}>
      <div
        className="deuda-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deuda-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="deuda-modal__header">
          <h2 id="deuda-modal-title" className="deuda-modal__title">
            Marcar como pagado
          </h2>
          <button
            type="button"
            className="deuda-modal__close"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <p className="deuda-modal__subtitle">{cuentaNombre}</p>

        <div className="deuda-modal__field">
          <label className="deuda-modal__label" htmlFor="deuda-modal-monto">
            Monto pagado
          </label>
          <input
            id="deuda-modal-monto"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            className={`deuda-modal__input ${error ? 'deuda-modal__input--error' : ''}`}
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              setError(null)
            }}
            autoFocus
          />
          <p className="deuda-modal__hint">Planeado: {formatCurrency(montoPlaneado)}</p>
          {error && <p className="deuda-modal__error">{error}</p>}
        </div>

        <div className="deuda-modal__actions">
          <button
            type="button"
            className="deuda-modal__btn deuda-modal__btn--secondary"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="deuda-modal__btn deuda-modal__btn--primary"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Guardando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

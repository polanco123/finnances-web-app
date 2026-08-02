'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Cuenta, Movimiento } from '@/components/cuentas/cuentas-service'
import MovementListItem from '@/components/movement/movement-list-item'
import './cuentas-card.css'

interface CuentaCardProps {
  cuenta: Cuenta
  movements: Movimiento[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function CuentaCard({ cuenta, movements }: CuentaCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="cuenta-card">
      <button
        type="button"
        className="cuenta-card__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <h3 className="cuenta-card__name">{cuenta.nombre}</h3>
        <span className="cuenta-card__header-right">
          <span className="cuenta-card__balance">
            {formatCurrency(cuenta.saldo_calculado)}
          </span>
          <ChevronDown
            className={`cuenta-card__chevron ${expanded ? 'cuenta-card__chevron--expanded' : ''}`}
            size={18}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div className="cuenta-card__movements">
          {movements.length === 0 ? (
            <p className="cuenta-card__empty">Sin movimientos recientes</p>
          ) : (
            movements.map((movement, index) => (
              <MovementListItem key={index} movimiento={movement} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

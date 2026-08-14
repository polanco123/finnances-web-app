'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Cuenta, Movimiento } from '@/components/cuentas/cuentas-service'
import MovementListItem from '@/components/movement/movement-list-item'
import MovementTransferCard from '@/components/movement/movement-transfer-card'
import { groupMovimientos } from '@/components/movement/movement-grouping'
import type { DisplayItem } from '@/components/movement/movement-grouping'
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

/** Sort key combining fecha + hora so ties on date order by time of day too. */
function fechaHoraKey(movimiento: Movimiento): string {
  return `${movimiento.fecha}T${movimiento.hora ?? '00:00:00'}`
}

export default function CuentaCard({ cuenta, movements }: CuentaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => fechaHoraKey(b).localeCompare(fechaHoraKey(a))),
    [movements],
  )
  const displayItems = useMemo(() => groupMovimientos(sortedMovements), [sortedMovements])

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
          {displayItems.length === 0 ? (
            <p className="cuenta-card__empty">Sin movimientos recientes</p>
          ) : (
            displayItems.map((item: DisplayItem) =>
              item.kind === 'merged-transfer' ? (
                <MovementTransferCard
                  key={`merged-${item.transferenciaId}`}
                  origen={item.origen}
                  destino={item.destino}
                />
              ) : (
                <MovementListItem key={item.data.id} movimiento={item.data} />
              ),
            )
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { CUENTAS } from '@/lib/catalogs/cuentas'
import './diversion-list-item.css'

interface MovimientoItem {
  monto: number
  descripcion?: string | null
  fecha: string
  hora?: string | null
  cuenta_id: string
  categoria_id: string
  notas?: string | null
}

interface DiversionListItemProps {
  movimiento: MovimientoItem
}

function formatCurrency(amount: number): { value: string; isPositive: boolean } {
  const absAmount = Math.abs(amount)
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(absAmount)

  return {
    value: amount < 0 ? `-${formatted}` : formatted,
    isPositive: amount >= 0,
  }
}

function resolveCuentaNombre(id: string): string {
  const cuenta = CUENTAS.find((c) => c.id === id)
  return cuenta?.nombre ?? 'Sin nombre'
}

export default function DiversionListItem({ movimiento }: DiversionListItemProps) {
  const { value, isPositive } = formatCurrency(movimiento.monto)
  const cuentaNombre = resolveCuentaNombre(movimiento.cuenta_id)

  return (
    <div className="diversion-list-item">
      <div className="diversion-list-item__header">
        <span
          className={`diversion-list-item__monto ${isPositive ? 'positive' : 'negative'}`}
        >
          {value}
        </span>
        <span className="diversion-list-item__fecha">
          {movimiento.fecha}
          {movimiento.hora && (
            <span className="diversion-list-item__hora"> {movimiento.hora}</span>
          )}
        </span>
      </div>

      <div className="diversion-list-item__details">
        <div className="diversion-list-item__detail">
          <span className="diversion-list-item__label">Cuenta</span>
          <span className="diversion-list-item__value">{cuentaNombre}</span>
        </div>
      </div>

      {movimiento.notas && (
        <div className="diversion-list-item__notas">
          <span className="diversion-list-item__label">Notas</span>
          <span className="diversion-list-item__value">{movimiento.notas}</span>
        </div>
      )}
    </div>
  )
}

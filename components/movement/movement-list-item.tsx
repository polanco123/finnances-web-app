'use client'

import { CUENTAS } from '@/lib/catalogs/cuentas'
import { CATEGORIAS } from '@/lib/catalogs/categorias'
import './movement-list-item.css'

interface MovimientoListItemProps {
  movimiento: {
    monto: number
    descripcion?: string | null
    fecha: string
    hora?: string | null
    cuenta_id: string
    categoria_id: string
    notas?: string | null
    es_transferencia?: boolean | null
    transferencia_id?: string | null
  }
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

function resolveCatalogName(id: string, catalog: { id: string; nombre: string }[]): string {
  const item = catalog.find((c) => c.id === id)
  return item?.nombre || 'Sin nombre'
}

export default function MovementListItem({ movimiento }: MovimientoListItemProps) {
  const { value, isPositive } = formatCurrency(movimiento.monto)
  const cuentaNombre = resolveCatalogName(movimiento.cuenta_id, CUENTAS)
  const categoriaNombre = resolveCatalogName(movimiento.categoria_id, CATEGORIAS)
  const isTransfer = movimiento.es_transferencia === true

  return (
    <div className={`movement-list-item ${isTransfer ? 'movement-list-item--transfer' : ''}`}>
      <div className="movement-list-item__header">
        <span className={`movement-list-item__monto ${isPositive ? 'positive' : 'negative'}`}>
          {value}
        </span>
        <span className="movement-list-item__fecha">
          {movimiento.fecha}
          {movimiento.hora && <span className="movement-list-item__hora"> {movimiento.hora}</span>}
        </span>
      </div>

      <div className="movement-list-item__details">
        {isTransfer ? (
          <div className="movement-list-item__detail">
            <span className="movement-list-item__label">Transferencia</span>
            <span className="movement-list-item__value movement-list-item__value--transfer">
              {cuentaNombre}
            </span>
          </div>
        ) : (
          <>
            <div className="movement-list-item__detail">
              <span className="movement-list-item__label">Categoría</span>
              <span className="movement-list-item__value">{categoriaNombre}</span>
            </div>
            <div className="movement-list-item__detail">
              <span className="movement-list-item__label">Cuenta</span>
              <span className="movement-list-item__value">{cuentaNombre}</span>
            </div>
          </>
        )}
      </div>

      {isTransfer && (
        <div className="movement-list-item__badge">
          <span className="movement-list-item__badge-text">Transferencia</span>
        </div>
      )}

      {movimiento.notas && (
        <div className="movement-list-item__notas">
          <span className="movement-list-item__label">Notas</span>
          <span className="movement-list-item__value">{movimiento.notas}</span>
        </div>
      )}
    </div>
  )
}

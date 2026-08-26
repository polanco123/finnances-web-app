'use client'

import { CUENTAS } from '@/lib/catalogs/cuentas'
import { CATEGORIAS } from '@/lib/catalogs/categorias'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import { resolveIconColor } from '@/lib/catalogs/icon-colors'
import { formatFechaHora } from '@/components/movement/movement-format'
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

function resolveCatalogName(
  id: string,
  catalog: { id: string; nombre: string; icono?: string | null }[]
): string {
  const item = catalog.find((c) => c.id === id)
  return item?.nombre || 'Sin nombre'
}

function resolveCatalogIcono(
  id: string,
  catalog: { id: string; nombre: string; icono?: string | null }[]
): string | null {
  const item = catalog.find((c) => c.id === id)
  return item?.icono ?? null
}

function resolveCatalogColor(
  id: string,
  catalog: { id: string; color?: string | null }[]
): string | null {
  const item = catalog.find((c) => c.id === id)
  return item?.color ?? null
}

export default function MovementListItem({ movimiento }: MovimientoListItemProps) {
  const { value, isPositive } = formatCurrency(movimiento.monto)
  const cuentaNombre = resolveCatalogName(movimiento.cuenta_id, CUENTAS)
  const categoriaNombre = resolveCatalogName(movimiento.categoria_id, CATEGORIAS)
  const CuentaIcon = resolveIcon(resolveCatalogIcono(movimiento.cuenta_id, CUENTAS), 'cuenta')
  const CategoriaIcon = resolveIcon(resolveCatalogIcono(movimiento.categoria_id, CATEGORIAS), 'categoria')
  const isTransfer = movimiento.es_transferencia === true

  const LeadingIcon = isTransfer ? CuentaIcon : CategoriaIcon
  const leadingColor = isTransfer
    ? resolveCatalogColor(movimiento.cuenta_id, CUENTAS)
    : resolveCatalogColor(movimiento.categoria_id, CATEGORIAS)

  return (
    <div className={`movement-list-item ${isTransfer ? 'movement-list-item--transfer' : ''}`}>
      <span className="movement-list-item__icon-badge">
        <LeadingIcon size={16} aria-hidden="true" style={{ color: resolveIconColor(leadingColor) }} />
      </span>

      <div className="movement-list-item__main">
        <div className="movement-list-item__title-row">
          <span className="movement-list-item__title">
            {isTransfer ? cuentaNombre : categoriaNombre}
          </span>
          {isTransfer && <span className="movement-list-item__badge-text">Transferencia</span>}
        </div>
        <div className="movement-list-item__subtitle">
          {!isTransfer && <span className="movement-list-item__subtitle-item">{cuentaNombre}</span>}
          <span className="movement-list-item__subtitle-item">
            {formatFechaHora(movimiento.fecha, movimiento.hora)}
          </span>
          {movimiento.notas && (
            <span className="movement-list-item__notas" title={movimiento.notas}>
              {movimiento.notas}
            </span>
          )}
        </div>
      </div>

      <span className={`movement-list-item__monto ${isPositive ? 'positive' : 'negative'}`}>
        {value}
      </span>
    </div>
  )
}

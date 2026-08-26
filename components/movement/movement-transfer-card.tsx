'use client'

import { ArrowRight } from 'lucide-react'
import { CUENTAS } from '@/lib/catalogs/cuentas'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import { resolveIconColor } from '@/lib/catalogs/icon-colors'
import { formatFechaHora } from '@/components/movement/movement-format'
import './movement-transfer-card.css'

interface MovementTransferCardProps {
  origen: {
    monto: number
    fecha: string
    hora?: string | null
    cuenta_id: string
    notas?: string | null
  }
  destino: {
    monto: number
    fecha: string
    hora?: string | null
    cuenta_id: string
    notas?: string | null
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
}

function resolveCatalogName(
  id: string,
  catalog: { id: string; nombre: string; icono?: string | null }[]
): string {
  const item = catalog.find((c) => c.id === id)
  return item?.nombre || 'Sin cuenta'
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

export default function MovementTransferCard({ origen, destino }: MovementTransferCardProps) {
  const amount = formatCurrency(origen.monto)
  const origenNombre = resolveCatalogName(origen.cuenta_id, CUENTAS)
  const destinoNombre = resolveCatalogName(destino.cuenta_id, CUENTAS)
  const OrigenIcon = resolveIcon(resolveCatalogIcono(origen.cuenta_id, CUENTAS), 'cuenta')
  const DestinoIcon = resolveIcon(resolveCatalogIcono(destino.cuenta_id, CUENTAS), 'cuenta')
  const origenColor = resolveIconColor(resolveCatalogColor(origen.cuenta_id, CUENTAS))
  const destinoColor = resolveIconColor(resolveCatalogColor(destino.cuenta_id, CUENTAS))
  const notas = origen.notas || destino.notas

  return (
    <div className="movement-transfer-card">
      <span className="movement-transfer-card__icon-badge">
        <ArrowRight size={16} aria-hidden="true" />
      </span>

      <div className="movement-transfer-card__main">
        <div className="movement-transfer-card__title-row">
          <span className="movement-transfer-card__title">
            <OrigenIcon
              size={14}
              className="movement-transfer-card__account-icon"
              aria-hidden="true"
              style={{ color: origenColor }}
            />
            {origenNombre}
            <ArrowRight className="movement-transfer-card__arrow" size={12} aria-hidden="true" />
            <DestinoIcon
              size={14}
              className="movement-transfer-card__account-icon"
              aria-hidden="true"
              style={{ color: destinoColor }}
            />
            {destinoNombre}
          </span>
          <span className="movement-transfer-card__badge-text">Transferencia</span>
        </div>
        <div className="movement-transfer-card__subtitle">
          <span className="movement-transfer-card__subtitle-item">
            {formatFechaHora(origen.fecha, origen.hora)}
          </span>
          {notas && (
            <span className="movement-transfer-card__notas" title={notas}>
              {notas}
            </span>
          )}
        </div>
      </div>

      <span className="movement-transfer-card__monto">{amount}</span>
    </div>
  )
}

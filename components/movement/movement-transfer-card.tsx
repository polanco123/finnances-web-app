'use client'

import { ArrowRight } from 'lucide-react'
import { CUENTAS } from '@/lib/catalogs/cuentas'
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

function resolveCatalogName(id: string, catalog: { id: string; nombre: string }[]): string {
  const item = catalog.find((c) => c.id === id)
  return item?.nombre || 'Sin cuenta'
}

export default function MovementTransferCard({ origen, destino }: MovementTransferCardProps) {
  const amount = formatCurrency(origen.monto)
  const origenNombre = resolveCatalogName(origen.cuenta_id, CUENTAS)
  const destinoNombre = resolveCatalogName(destino.cuenta_id, CUENTAS)
  const notas = origen.notas || destino.notas

  return (
    <div className="movement-transfer-card">
      <div className="movement-transfer-card__header">
        <span className="movement-transfer-card__monto">{amount}</span>
        <span className="movement-transfer-card__fecha">
          {origen.fecha}
          {origen.hora && <span className="movement-transfer-card__hora"> {origen.hora}</span>}
        </span>
      </div>

      <div className="movement-transfer-card__details">
        <div className="movement-transfer-card__detail">
          <span className="movement-transfer-card__label">Transferencia</span>
          <div className="movement-transfer-card__transfer-path">
            <span className="movement-transfer-card__account-name">{origenNombre}</span>
            <ArrowRight className="movement-transfer-card__arrow" size={16} />
            <span className="movement-transfer-card__account-name">{destinoNombre}</span>
          </div>
        </div>
      </div>

      <div className="movement-transfer-card__badge">
        <span className="movement-transfer-card__badge-text">Transferencia</span>
      </div>

      {notas && (
        <div className="movement-transfer-card__notas">
          <span className="movement-transfer-card__label">Notas</span>
          <span className="movement-transfer-card__value">{notas}</span>
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'
import type { Cuenta, Movimiento } from '@/components/cuentas/cuentas-service'
import MovementListItem from '@/components/movement/movement-list-item'
import MovementTransferCard from '@/components/movement/movement-transfer-card'
import { groupMovimientos } from '@/components/movement/movement-grouping'
import type { DisplayItem } from '@/components/movement/movement-grouping'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import IconPicker from '@/components/ui/icon-picker'
import './cuentas-card.css'

interface CuentaCardProps {
  cuenta: Cuenta
  movements: Movimiento[]
  onUpdateIcono: (id: string, icono: string) => Promise<void>
}

type SemaphoreLevel = 'up' | 'amber' | 'down'

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

/** Formats a `Date` as YYYY-MM-DD using its local (not UTC) components. */
function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Renders a movimiento's `fecha` (YYYY-MM-DD) as "Hoy", "Ayer", or a short
 * "12 ago" style date otherwise. No shared relative-date helper existed for
 * past dates (components/patrimonio/patrimonio-dates.ts only covers future
 * due dates), so this is a small local helper kept domain-scoped.
 */
function formatUltimoMovimiento(fecha: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (fecha === toLocalISODate(today)) return 'Hoy'
  if (fecha === toLocalISODate(yesterday)) return 'Ayer'

  const [year, month, day] = fecha.split('-').map(Number)
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(parsed)
}

function semaphoreLevel(utilizacion: number): SemaphoreLevel {
  if (utilizacion < 30) return 'up'
  if (utilizacion <= 50) return 'amber'
  return 'down'
}

export default function CuentaCard({ cuenta, movements, onUpdateIcono }: CuentaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingIcono, setEditingIcono] = useState(false)
  const Icon = resolveIcon(cuenta.icono, 'cuenta')
  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => fechaHoraKey(b).localeCompare(fechaHoraKey(a))),
    [movements],
  )
  const displayItems = useMemo(() => groupMovimientos(sortedMovements), [sortedMovements])

  const lastMovement = sortedMovements[0] ?? null
  const showSemaphore =
    cuenta.tipo === 'deuda' && cuenta.limite_credito != null && cuenta.limite_credito > 0

  let utilizacion = 0
  let level: SemaphoreLevel = 'up'
  if (showSemaphore && cuenta.limite_credito) {
    utilizacion = (Math.abs(cuenta.saldo_calculado) / cuenta.limite_credito) * 100
    level = semaphoreLevel(utilizacion)
  }

  return (
    <div className="acct-card">
      <button
        type="button"
        className="acct-row"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="acct-row__main">
          <span className="acct-row__name">
            <Icon className="acct-row__icon" size={16} aria-hidden="true" />
            {cuenta.nombre}
          </span>
          <span className="acct-row__meta">
            {lastMovement ? `Últ. mov. ${formatUltimoMovimiento(lastMovement.fecha)}` : 'Sin movimientos'}
            {showSemaphore && (
              <span className="acct-row__semaphore">
                <span className={`acct-row__semaphore-dot acct-row__semaphore-dot--${level}`} />
                {Math.round(utilizacion)}% del límite
              </span>
            )}
          </span>
        </span>
        <span className="acct-row__right">
          <span className="acct-row__balance">{formatCurrency(cuenta.saldo_calculado)}</span>
          <ChevronDown
            className={`acct-row__chevron ${expanded ? 'acct-row__chevron--expanded' : ''}`}
            size={18}
            aria-hidden="true"
          />
        </span>
      </button>

      {showSemaphore && (
        <div className="acct-row__progress">
          <div
            className={`acct-row__progress-fill acct-row__progress-fill--${level}`}
            style={{ width: `${Math.min(utilizacion, 100)}%` }}
          />
        </div>
      )}

      {expanded && (
        <div className="acct-card__detail">
          <div className="acct-card__actions">
            <button
              type="button"
              className="acct-card__action-btn"
              onClick={() => setEditingIcono((prev) => !prev)}
            >
              <Pencil size={14} aria-hidden="true" />
              Editar ícono
            </button>
          </div>

          {editingIcono && (
            <div className="acct-card__icon-picker">
              <IconPicker
                icono={cuenta.icono}
                kind="cuenta"
                onSelect={(iconName) => onUpdateIcono(cuenta.id, iconName)}
              />
            </div>
          )}

          {displayItems.length === 0 ? (
            <p className="acct-card__empty">Sin movimientos recientes</p>
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

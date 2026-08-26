'use client'

import { useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'
import type { CategoriaConGasto } from '@/components/categorias/categorias-service'
import MovementListItem from '@/components/movement/movement-list-item'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import { resolveIconColor } from '@/lib/catalogs/icon-colors'
import IconPicker from '@/components/ui/icon-picker'
import './categorias-card.css'

interface CategoriaCardProps {
  categoria: CategoriaConGasto
  onUpdateIcono: (id: string, icono: string) => Promise<void>
  onUpdateColor: (id: string, color: string | null) => Promise<void>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function CategoriaCard({ categoria, onUpdateIcono, onUpdateColor }: CategoriaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingIcono, setEditingIcono] = useState(false)
  const Icon = resolveIcon(categoria.icono, 'categoria')

  return (
    <div className="categoria-card">
      <button
        type="button"
        className="categoria-card__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <h3 className="categoria-card__name">
          <Icon
            className="categoria-card__icon"
            size={16}
            aria-hidden="true"
            style={{ color: resolveIconColor(categoria.color) }}
          />
          {categoria.nombre} <span className="categoria-card__count">({categoria.count})</span>
        </h3>
        <span className="categoria-card__header-right">
          <span className="categoria-card__total">{formatCurrency(categoria.total)}</span>
          <span className="categoria-card__porcentaje">{categoria.porcentaje}%</span>
          <ChevronDown
            className={`categoria-card__chevron ${expanded ? 'categoria-card__chevron--expanded' : ''}`}
            size={18}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div className="categoria-card__movements">
          <div className="categoria-card__actions">
            <button
              type="button"
              className="categoria-card__action-btn"
              onClick={() => setEditingIcono((prev) => !prev)}
            >
              <Pencil size={14} aria-hidden="true" />
              Editar ícono
            </button>
          </div>

          {editingIcono && (
            <div className="categoria-card__icon-picker">
              <IconPicker
                icono={categoria.icono}
                color={categoria.color}
                kind="categoria"
                onSelect={(iconName) => onUpdateIcono(categoria.categoriaId, iconName)}
                onSelectColor={(color) => onUpdateColor(categoria.categoriaId, color)}
              />
            </div>
          )}

          {categoria.movimientos.length === 0 ? (
            <p className="categoria-card__empty">Sin movimientos en este periodo</p>
          ) : (
            categoria.movimientos.map((movimiento) => (
              <MovementListItem key={movimiento.id} movimiento={movimiento} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

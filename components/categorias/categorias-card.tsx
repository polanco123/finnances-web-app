'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CategoriaConGasto } from '@/components/categorias/categorias-service'
import MovementListItem from '@/components/movement/movement-list-item'
import './categorias-card.css'

interface CategoriaCardProps {
  categoria: CategoriaConGasto
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function CategoriaCard({ categoria }: CategoriaCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="categoria-card">
      <button
        type="button"
        className="categoria-card__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <h3 className="categoria-card__name">
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

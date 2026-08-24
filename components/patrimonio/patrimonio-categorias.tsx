'use client'

import { formatMoney } from './patrimonio-format'
import type { CategoriaHeat } from './patrimonio-service'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import './patrimonio-categorias.css'

interface PatrimonioCategoriasProps {
  categorias: CategoriaHeat[]
}

export default function PatrimonioCategorias({ categorias }: PatrimonioCategoriasProps) {
  if (categorias.length === 0) {
    return (
      <section className="patrimonio-card patrimonio-categorias">
        <p className="patrimonio-section-title">Categorías del mes</p>
        <p className="patrimonio-categorias__empty">Sin gastos registrados este mes</p>
      </section>
    )
  }

  const max = categorias[0].gastoMes

  return (
    <section className="patrimonio-card patrimonio-categorias">
      <p className="patrimonio-section-title">Categorías del mes</p>

      {categorias.map((cat) => {
        const widthPct = max > 0 ? (cat.gastoMes / max) * 100 : 0
        const CategoriaIcon = resolveIcon(cat.icono, 'categoria')
        return (
          <div key={cat.categoriaId} className="patrimonio-categoria-row">
            <div className="patrimonio-categoria-row__header">
              <span className="patrimonio-categoria-row__nombre">
                <CategoriaIcon size={14} className="patrimonio-categoria-row__icon" />
                {cat.nombre}
              </span>
              <span className="patrimonio-categoria-row__monto">{formatMoney(cat.gastoMes)}</span>
            </div>
            <div className="patrimonio-categoria-bar-track">
              <div
                className={`patrimonio-categoria-bar patrimonio-categoria-bar--${cat.heat}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </section>
  )
}

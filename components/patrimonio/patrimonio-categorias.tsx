'use client'

import { formatMoney } from './patrimonio-format'
import type { CategoriaHeat } from './patrimonio-service'
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
        return (
          <div key={cat.categoriaId} className="patrimonio-categoria-row">
            <div className="patrimonio-categoria-row__header">
              <span className="patrimonio-categoria-row__nombre">{cat.nombre}</span>
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

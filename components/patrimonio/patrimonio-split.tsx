'use client'

import { formatMoney } from './patrimonio-format'
import './patrimonio-split.css'

interface PatrimonioSplitProps {
  disponible: number
  retiro: number
  retiroCuentas: number
}

export default function PatrimonioSplit({ disponible, retiro, retiroCuentas }: PatrimonioSplitProps) {
  const isNegative = disponible < 0

  return (
    <section className="patrimonio-split">
      <div className="patrimonio-card patrimonio-split__cell">
        <p className="patrimonio-section-title">Disponible</p>
        <p
          className={`patrimonio-split__value${isNegative ? ' patrimonio-split__value--negative' : ''}`}
        >
          {formatMoney(disponible)}
        </p>
      </div>

      <div className="patrimonio-card patrimonio-split__cell">
        <p className="patrimonio-section-title">Retiro</p>
        <p className="patrimonio-split__value">{formatMoney(retiro)}</p>
        <p className="patrimonio-split__sublabel">
          {retiroCuentas} {retiroCuentas === 1 ? 'cuenta' : 'cuentas'}
        </p>
      </div>
    </section>
  )
}

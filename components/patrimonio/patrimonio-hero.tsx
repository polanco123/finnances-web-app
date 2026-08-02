'use client'

import { formatDeltaLabel, formatMoney } from './patrimonio-format'
import { getTodayLocal } from './patrimonio-dates'
import type { PatrimonioSnapshot } from './patrimonio-service'
import PatrimonioSparkline from './patrimonio-sparkline'
import './patrimonio-hero.css'

interface PatrimonioHeroProps {
  netWorth: number
  history: PatrimonioSnapshot[]
}

export default function PatrimonioHero({ netWorth, history }: PatrimonioHeroProps) {
  const today = getTodayLocal()
  // Most recent snapshot dated strictly before today — not necessarily "yesterday".
  const priorSnapshots = history.filter((s) => s.fecha < today)
  const previous = priorSnapshots.length > 0 ? priorSnapshots[priorSnapshots.length - 1] : null

  const { label, delta, direction } = formatDeltaLabel(netWorth, previous, today)

  return (
    <section className="patrimonio-card patrimonio-hero">
      <p className="patrimonio-section-title">Patrimonio neto</p>
      <p className="patrimonio-hero__amount">{formatMoney(netWorth)}</p>

      <div className={`patrimonio-hero__delta patrimonio-hero__delta--${direction}`}>
        {direction !== 'neutral' && (
          <span className="patrimonio-hero__delta-amount">
            {delta > 0 ? '+' : ''}
            {formatMoney(delta)}
          </span>
        )}
        <span className="patrimonio-hero__delta-label">{label}</span>
      </div>

      <PatrimonioSparkline history={history} />
    </section>
  )
}

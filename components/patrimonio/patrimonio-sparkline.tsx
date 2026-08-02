'use client'

import type { PatrimonioSnapshot } from './patrimonio-service'
import './patrimonio-sparkline.css'

interface PatrimonioSparklineProps {
  history: PatrimonioSnapshot[]
}

/**
 * Hand-rolled 14-bar sparkline — NOT Recharts (proposal.md, Resolved
 * Decision #8). Renders fewer bars when history is sparse; never pads with
 * fabricated zero-value bars.
 */
export default function PatrimonioSparkline({ history }: PatrimonioSparklineProps) {
  if (history.length === 0) {
    return <div className="patrimonio-sparkline patrimonio-sparkline--empty" />
  }

  const values = history.map((h) => h.patrimonio_neto)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return (
    <div className="patrimonio-sparkline">
      {history.map((snapshot) => {
        const heightPct = range === 0 ? 50 : ((snapshot.patrimonio_neto - min) / range) * 100
        return (
          <div
            key={snapshot.id}
            className="patrimonio-sparkline__bar"
            style={{ height: `${Math.max(6, heightPct)}%` }}
            title={`${snapshot.fecha}`}
          />
        )
      })}
    </div>
  )
}

'use client'

import type { MetaAbono } from '@/components/metas/metas-service'
import './metas-progreso-chart.css'

interface MetaProgresoChartProps {
  montoInicial: number
  abonos: MetaAbono[] // any order — component sorts by fecha ascending internally
}

/**
 * Per-abono cumulative bar chart, adapted from `patrimonio-sparkline.tsx`'s
 * div-bar technique (min/max normalization + 6% floor + last-bar highlight),
 * re-scoped to `--theme-*` tokens instead of the isolated patrimonio palette.
 */
export default function MetaProgresoChart({ montoInicial, abonos }: MetaProgresoChartProps) {
  if (abonos.length === 0) {
    return <p className="metas-progreso-chart__empty">Aún no hay abonos registrados.</p>
  }

  const sorted = [...abonos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let running = montoInicial
  const points = sorted.map((a) => {
    running += a.monto
    return { fecha: a.fecha, montoActual: running }
  })

  const values = points.map((p) => p.montoActual)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return (
    <div className="metas-progreso-chart">
      {points.map((point, index) => {
        const heightPct = range === 0 ? 50 : ((point.montoActual - min) / range) * 100
        const isLast = index === points.length - 1
        return (
          <div
            key={`${point.fecha}-${index}`}
            className={`metas-progreso-chart__bar${isLast ? ' metas-progreso-chart__bar--current' : ''}`}
            style={{ height: `${Math.max(6, heightPct)}%` }}
            title={`${point.fecha}`}
          />
        )
      })}
    </div>
  )
}

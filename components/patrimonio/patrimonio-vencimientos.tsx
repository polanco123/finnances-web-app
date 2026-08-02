'use client'

import type { VencimientoCuenta } from './patrimonio-service'
import './patrimonio-vencimientos.css'

interface PatrimonioVencimientosProps {
  vencimientos: VencimientoCuenta[]
}

function labelDiasRestantes(dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  return `En ${dias} días`
}

export default function PatrimonioVencimientos({ vencimientos }: PatrimonioVencimientosProps) {
  return (
    <section className="patrimonio-vencimientos">
      <p className="patrimonio-section-title">Próximo vencimiento</p>

      {vencimientos.length === 0 ? (
        <p className="patrimonio-vencimientos__empty">Sin vencimientos próximos</p>
      ) : (
        vencimientos.map((v) => (
          <div key={v.id} className="patrimonio-card patrimonio-vencimiento-strip">
            <span className="patrimonio-vencimiento-strip__nombre">{v.nombre}</span>
            <span className="patrimonio-vencimiento-strip__dias">
              {labelDiasRestantes(v.diasRestantes)}
            </span>
          </div>
        ))
      )}
    </section>
  )
}

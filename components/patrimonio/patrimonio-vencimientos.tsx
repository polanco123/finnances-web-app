'use client'

import type { VencimientoCuenta } from './patrimonio-service'
import { formatMoney } from './patrimonio-format'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
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
        vencimientos.map((v) => {
          const VencimientoIcon = resolveIcon(v.icono, 'cuenta')
          return (
            <div key={v.id} className="patrimonio-card patrimonio-vencimiento-strip">
              <span className="patrimonio-vencimiento-strip__nombre">
                <VencimientoIcon size={14} className="patrimonio-vencimiento-strip__icon" />
                {v.nombre}
              </span>
              <span className="patrimonio-vencimiento-strip__right">
                {v.montoPlaneado !== undefined && (
                  <span
                    className={`patrimonio-vencimiento-strip__monto${
                      v.pagado ? ' patrimonio-vencimiento-strip__monto--pagado' : ''
                    }`}
                  >
                    {v.pagado ? formatMoney(v.montoPagado ?? 0) : formatMoney(v.montoPlaneado)}
                  </span>
                )}
                <span className="patrimonio-vencimiento-strip__dias">
                  {labelDiasRestantes(v.diasRestantes)}
                </span>
              </span>
            </div>
          )
        })
      )}
    </section>
  )
}

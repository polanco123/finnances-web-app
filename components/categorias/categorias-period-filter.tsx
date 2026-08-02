'use client'

import './categorias-period-filter.css'

export type PeriodoTipo = 'dia' | 'semanal' | 'quincenal' | 'mensual' | 'anual' | 'periodo'

interface CategoriasPeriodFilterProps {
  periodo: PeriodoTipo
  desdePersonalizado: string
  hastaPersonalizado: string
  onPeriodoChange: (periodo: PeriodoTipo) => void
  onRangoPersonalizadoChange: (desde: string, hasta: string) => void
}

const OPCIONES: { value: PeriodoTipo; label: string }[] = [
  { value: 'dia', label: 'Día' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
  { value: 'periodo', label: 'Por periodo' },
]

export default function CategoriasPeriodFilter({
  periodo,
  desdePersonalizado,
  hastaPersonalizado,
  onPeriodoChange,
  onRangoPersonalizadoChange,
}: CategoriasPeriodFilterProps) {
  function handleDesdeChange(desde: string) {
    // Clamp: pushing desde past hasta pulls hasta up to match.
    const hasta = desde > hastaPersonalizado ? desde : hastaPersonalizado
    onRangoPersonalizadoChange(desde, hasta)
  }

  function handleHastaChange(hasta: string) {
    // Clamp: pushing hasta before desde pulls desde down to match.
    const desde = hasta < desdePersonalizado ? hasta : desdePersonalizado
    onRangoPersonalizadoChange(desde, hasta)
  }

  return (
    <div className="categorias-period-filter">
      <div className="categorias-period-filter__group" role="group" aria-label="Periodo">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.value}
            type="button"
            className={`categorias-period-filter__button ${periodo === opcion.value ? 'categorias-period-filter__button--active' : ''}`}
            aria-pressed={periodo === opcion.value}
            onClick={() => onPeriodoChange(opcion.value)}
          >
            {opcion.label}
          </button>
        ))}
      </div>

      {periodo === 'periodo' && (
        <div className="categorias-period-filter__range">
          <label className="categorias-period-filter__range-field">
            <span className="categorias-period-filter__range-label">Desde</span>
            <input
              type="date"
              value={desdePersonalizado}
              max={hastaPersonalizado}
              onChange={(e) => handleDesdeChange(e.target.value)}
            />
          </label>
          <label className="categorias-period-filter__range-field">
            <span className="categorias-period-filter__range-label">Hasta</span>
            <input
              type="date"
              value={hastaPersonalizado}
              min={desdePersonalizado}
              onChange={(e) => handleHastaChange(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}

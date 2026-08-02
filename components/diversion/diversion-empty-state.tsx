'use client'

export default function DiversionEmptyState() {
  return (
    <div className="diversion-empty-state">
      <div className="diversion-empty-state__icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <h2 className="diversion-empty-state__title">Sin presupuesto activo</h2>
      <p className="diversion-empty-state__message">
        No hay presupuesto configurado para esta semana.
      </p>
    </div>
  )
}

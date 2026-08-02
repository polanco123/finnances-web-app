import './coming-soon.css'

interface ComingSoonProps {
  title: string
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <div className="coming-soon__content">
        <span className="coming-soon__badge">Próximamente</span>
        <h1 className="coming-soon__title">{title}</h1>
        <p className="coming-soon__text">
          Esta sección estará disponible pronto.
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { crearMovimiento } from '../movement/movement-mapper'
import { CUENTAS } from '../../lib/catalogs/cuentas'
import { CATEGORIAS } from '../../lib/catalogs/categorias'
import { insertarMovimiento } from '../movement/movement-service'
import './movement-form.css'

const toLocalDate = (d) => d.toISOString().split('T')[0]
const toLocalTime = (d) => d.toTimeString().slice(0, 5)

export default function MovementForm({ onMovimientoCreado }) {
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(CUENTAS[0]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState('')
  const [tipoMovimiento, setTipoMovimiento] = useState('gasto')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) return

    try {
      setGuardando(true)
      setError(null)

      const montoFinal = tipoMovimiento === 'gasto' ? -Math.abs(Number(monto)) : Math.abs(Number(monto))

      const movimiento = crearMovimiento({
        monto: montoFinal,
        descripcion: notas || '',
        fecha,
        hora,
        cuenta_id: cuentaId,
        categoria_id: categoriaId,
        notas: notas || null,
      })

      await insertarMovimiento(movimiento)

      setMonto('')
      setNotas('')
      if (onMovimientoCreado) onMovimientoCreado()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const handleTipoChange = () => {
    setTipoMovimiento(prev => prev === 'gasto' ? 'ingreso' : 'gasto')
  }

  return (
    <form className="movement-form" onSubmit={handleSubmit}>
      <h2 className="movement-form__title">Nuevo Movimiento</h2>

      {error && <div className="movement-form__error">{error}</div>}

      <div className="movement-form__toggle-group">
        <span className={`movement-form__toggle-label ${tipoMovimiento === 'gasto' ? 'movement-form__toggle-label--active' : ''}`}>
          Gasto
        </span>
        <label className="movement-form__toggle">
          <input
            type="checkbox"
            checked={tipoMovimiento === 'ingreso'}
            onChange={handleTipoChange}
          />
          <span className="movement-form__toggle-track"></span>
          <span className="movement-form__toggle-thumb"></span>
        </label>
        <span className={`movement-form__toggle-label ${tipoMovimiento === 'ingreso' ? 'movement-form__toggle-label--active' : ''}`}>
          Ingreso
        </span>
        <span className={`movement-form__toggle-type ${tipoMovimiento === 'gasto' ? 'movement-form__toggle-type--gasto' : 'movement-form__toggle-type--ingreso'}`}>
          {tipoMovimiento === 'gasto' ? '(Gasto)' : '(Ingreso)'}
        </span>
      </div>

      <div className="movement-form__group">
        <label className="movement-form__label">Monto</label>
        <input
          className="movement-form__input"
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>

      <div className="movement-form__group-row">
        <div className="movement-form__group">
          <label className="movement-form__label">Fecha</label>
          <input
            className="movement-form__input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div className="movement-form__group">
          <label className="movement-form__label">Hora</label>
          <input
            className="movement-form__input"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>
      </div>

      <div className="movement-form__group">
        <label className="movement-form__label">Categoría</label>
        <select
          className="movement-form__select"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
        >
          {CATEGORIAS.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      <div className="movement-form__group">
        <label className="movement-form__label">Cuenta</label>
        <select
          className="movement-form__select"
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
        >
          {CUENTAS.map((cue) => (
            <option key={cue.id} value={cue.id}>{cue.nombre}</option>
          ))}
        </select>
      </div>

      <div className="movement-form__group">
        <label className="movement-form__label">Notas</label>
        <textarea
          className="movement-form__textarea"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Comentarios opcionales..."
        />
      </div>

      <button
        className="movement-form__button"
        type="submit"
        disabled={guardando}
      >
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}

import { useState } from 'react'
import { crearMovimiento, crearMovimientoTransferencia } from '../movement/movement-mapper'
import { CUENTAS } from '../../lib/catalogs/cuentas'
import { CATEGORIAS } from '../../lib/catalogs/categorias'
import { insertarMovimiento, insertarTransferencia } from '../movement/movement-service'
import AutocompleteInput from '@/components/ui/autocomplete-input'
import './movement-form.css'

const toLocalDate = (d) => d.toISOString().split('T')[0]
const toLocalTime = (d) => d.toTimeString().slice(0, 5)

/**
 * @param {object} props
 * @param {() => void} [props.onMovimientoCreado]
 * @param {'gasto' | 'ingreso' | 'transferencia'} [props.initialTipo]
 * @param {string} [props.initialMonto]
 * @param {string} [props.initialCuentaId]
 * @param {string} [props.initialCategoriaId]
 * @param {string} [props.initialCuentaOrigenId]
 * @param {string} [props.initialCuentaDestinoId]
 * @param {string} [props.initialNotas]
 */
export default function MovementForm({
  onMovimientoCreado,
  initialTipo,
  initialMonto,
  initialCuentaId,
  initialCategoriaId,
  initialCuentaOrigenId,
  initialCuentaDestinoId,
  initialNotas,
}) {
  const [monto, setMonto] = useState(initialMonto || '')
  const [categoriaId, setCategoriaId] = useState(initialCategoriaId || CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(initialCuentaId || CUENTAS[0]?.id || '')
  const [cuentaOrigenId, setCuentaOrigenId] = useState(initialCuentaOrigenId || CUENTAS[0]?.id || '')
  const [cuentaDestinoId, setCuentaDestinoId] = useState(initialCuentaDestinoId || CUENTAS[1]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState(initialNotas || '')
  const [tipoMovimiento, setTipoMovimiento] = useState(initialTipo || 'gasto')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const isTransferencia = tipoMovimiento === 'transferencia'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) return

    if (isTransferencia && cuentaOrigenId === cuentaDestinoId) {
      setError('La cuenta origen y destino deben ser diferentes')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      if (isTransferencia) {
        const { origen, destino } = crearMovimientoTransferencia({
          monto,
          fecha,
          hora,
          cuentaOrigenId,
          cuentaDestinoId,
          notas,
        })
        await insertarTransferencia(origen, destino)
      } else {
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
      }

      setMonto('')
      setNotas('')
      if (onMovimientoCreado) onMovimientoCreado()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="movement-form" onSubmit={handleSubmit}>
      <h2 className="movement-form__title">Nuevo Movimiento</h2>

      {error && <div className="movement-form__error">{error}</div>}

      <div className="movement-form__tabs">
        <button
          type="button"
          className={`movement-form__tab ${tipoMovimiento === 'gasto' ? 'movement-form__tab--active movement-form__tab--gasto' : ''}`}
          onClick={() => setTipoMovimiento('gasto')}
        >
          Gasto
        </button>
        <button
          type="button"
          className={`movement-form__tab ${tipoMovimiento === 'ingreso' ? 'movement-form__tab--active movement-form__tab--ingreso' : ''}`}
          onClick={() => setTipoMovimiento('ingreso')}
        >
          Ingreso
        </button>
        <button
          type="button"
          className={`movement-form__tab ${tipoMovimiento === 'transferencia' ? 'movement-form__tab--active movement-form__tab--transferencia' : ''}`}
          onClick={() => setTipoMovimiento('transferencia')}
        >
          Transferencia
        </button>
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

      {isTransferencia ? (
        <>
          <AutocompleteInput
            label="Cuenta Origen"
            options={CUENTAS}
            value={cuentaOrigenId}
            onChange={setCuentaOrigenId}
          />
          <AutocompleteInput
            label="Cuenta Destino"
            options={CUENTAS}
            value={cuentaDestinoId}
            onChange={setCuentaDestinoId}
          />
        </>
      ) : (
        <>
          <AutocompleteInput
            label="Cuenta"
            options={CUENTAS}
            value={cuentaId}
            onChange={setCuentaId}
          />
          <AutocompleteInput
            label="Categoría"
            options={CATEGORIAS}
            value={categoriaId}
            onChange={setCategoriaId}
          />
          
        </>
      )}

      <div className="movement-form__group">
        <label className="movement-form__label">Notas</label>
        <textarea
          className="movement-form__textarea"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Comentarios opcionales..."
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

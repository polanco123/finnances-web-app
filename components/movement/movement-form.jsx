import { useState, useRef, useEffect } from 'react'
import { crearMovimiento, crearMovimientoTransferencia } from '../movement/movement-mapper'
import { CUENTAS } from '../../lib/catalogs/cuentas'
import { CATEGORIAS } from '../../lib/catalogs/categorias'
import { insertarMovimiento, insertarTransferencia } from '../movement/movement-service'
import './movement-form.css'

const toLocalDate = (d) => d.toISOString().split('T')[0]
const toLocalTime = (d) => d.toTimeString().slice(0, 5)

const TRANSFERENCIA_CATEGORIA_ID = '32151dbb-6732-45a7-befd-9057dc9f935a'

function AutocompleteInput({ label, options, value, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  const selectedOption = options.find(o => o.id === value)

  useEffect(() => {
    if (selectedOption && !showOptions) {
      setInputValue(selectedOption.nombre)
    }
  }, [selectedOption, showOptions])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowOptions(false)
        if (selectedOption) setInputValue(selectedOption.nombre)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption])

  const filtered = inputValue.trim() === ''
    ? options
    : options.filter(o => o.nombre.toLowerCase().includes(inputValue.toLowerCase()))

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    setShowOptions(true)
    setHighlightIndex(-1)
  }

  const handleSelect = (option) => {
    onChange(option.id)
    setInputValue(option.nombre)
    setShowOptions(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showOptions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowOptions(false)
      if (selectedOption) setInputValue(selectedOption.nombre)
    }
  }

  return (
    <div className="movement-form__group">
      <label className="movement-form__label">{label}</label>
      <div className="movement-form__autocomplete" ref={wrapperRef}>
        <input
          ref={inputRef}
          className="movement-form__input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowOptions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Escribir para buscar...'}
          autoComplete="off"
        />
        {showOptions && filtered.length > 0 && (
          <ul className="movement-form__autocomplete-list">
            {filtered.map((option, index) => (
              <li
                key={option.id}
                className={`movement-form__autocomplete-item ${index === highlightIndex ? 'movement-form__autocomplete-item--highlighted' : ''} ${option.id === value ? 'movement-form__autocomplete-item--selected' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function MovementForm({ onMovimientoCreado }) {
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(CUENTAS[0]?.id || '')
  const [cuentaOrigenId, setCuentaOrigenId] = useState(CUENTAS[0]?.id || '')
  const [cuentaDestinoId, setCuentaDestinoId] = useState(CUENTAS[1]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState('')
  const [tipoMovimiento, setTipoMovimiento] = useState('gasto')
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
            label="Categoría"
            options={CATEGORIAS}
            value={categoriaId}
            onChange={setCategoriaId}
          />
          <AutocompleteInput
            label="Cuenta"
            options={CUENTAS}
            value={cuentaId}
            onChange={setCuentaId}
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

import { useState } from 'react'
import { crearMovimiento } from '../movement/movement-mapper'
import { CUENTAS } from '../../lib/catalogs/cuentas'
import { CATEGORIAS } from '../../lib/catalogs/categorias'
import { insertarMovimiento } from '../movement/movement-service'

const toLocalDate = (d) => d.toISOString().split('T')[0]
const toLocalTime = (d) => d.toTimeString().slice(0, 5)

export default function MovementForm({ onMovimientoCreado }) {
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(CUENTAS[0]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) return

    try {
      setGuardando(true)
      setError(null)

      const movimiento = crearMovimiento({
        monto: Number(monto),
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

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Nuevo Movimiento</h2>

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      <div style={{ marginBottom: '10px' }}>
        <label>Monto</label><br />
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label>Fecha</label><br />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Hora</label><br />
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>Categoría</label><br />
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        >
          {CATEGORIAS.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>Cuenta</label><br />
        <select
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        >
          {CUENTAS.map((cue) => (
            <option key={cue.id} value={cue.id}>{cue.nombre}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>Notas</label><br />
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Comentarios opcionales..."
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <button type="submit" disabled={guardando} style={{ padding: '10px 20px' }}>
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}

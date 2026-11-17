import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/autocomplete-input', () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}))
vi.mock('./movement-service', () => ({
  insertarMovimiento: vi.fn(),
  insertarTransferencia: vi.fn(),
}))

import MovementForm from './movement-form'
import * as service from './movement-service'

const regular = { tipo: 'gasto', monto: '100', cuentaId: 'A' }
const transfer = { tipo: 'transferencia', monto: '200', cuentaOrigenId: 'A', cuentaDestinoId: 'B' }

function setup(initialValues: object, onEditSubmit = vi.fn().mockResolvedValue(true)) {
  render(<MovementForm mode="edit" initialValues={initialValues} onEditSubmit={onEditSubmit} />)
  return { onEditSubmit }
}

describe('MovementForm edit mode', () => {
  it('prefills monto and cuenta and exposes only those fields', () => {
    setup(regular)
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    expect(screen.getByLabelText('Cuenta')).toHaveValue('A')
    expect(screen.queryByLabelText('Categoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Notas')).not.toBeInTheDocument()
    expect(screen.queryByText('Fecha')).not.toBeInTheDocument()
    expect(screen.queryByText('Hora')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ingreso' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('Editar Movimiento')
  })

  it('shows origen and destino for a transfer row', () => {
    setup(transfer)
    expect(screen.getByLabelText('Cuenta Origen')).toHaveValue('A')
    expect(screen.getByLabelText('Cuenta Destino')).toHaveValue('B')
    expect(screen.queryByLabelText('Cuenta')).not.toBeInTheDocument()
  })

  it('submits the edited monto and cuenta without touching the service', async () => {
    const { onEditSubmit } = setup(regular)
    const monto = screen.getByDisplayValue('100')
    await userEvent.clear(monto)
    await userEvent.type(monto, '150')
    const cuenta = screen.getByLabelText('Cuenta')
    await userEvent.clear(cuenta)
    await userEvent.type(cuenta, 'B')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onEditSubmit).toHaveBeenCalledWith({ tipo: 'gasto', monto: 150, cuentaId: 'B' })
    expect(service.insertarMovimiento).not.toHaveBeenCalled()
  })

  it('submits transfer origen/destino', async () => {
    const { onEditSubmit } = setup(transfer)
    const destino = screen.getByLabelText('Cuenta Destino')
    await userEvent.clear(destino)
    await userEvent.type(destino, 'C')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onEditSubmit).toHaveBeenCalledWith({
      tipo: 'transferencia',
      monto: 200,
      cuentaOrigenId: 'A',
      cuentaDestinoId: 'C',
    })
  })

  it.each([
    ['empty', ''],
    ['zero', '0'],
  ])('rejects an %s amount with a message and writes nothing', async (_name, value) => {
    const { onEditSubmit } = setup(regular)
    const monto = screen.getByDisplayValue('100')
    await userEvent.clear(monto)
    if (value) await userEvent.type(monto, value)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('Ingresa un monto mayor a 0')).toBeInTheDocument()
    expect(onEditSubmit).not.toHaveBeenCalled()
  })

  it('rejects the same origen and destino', async () => {
    const { onEditSubmit } = setup({ ...transfer, cuentaDestinoId: 'A' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('La cuenta origen y destino deben ser diferentes')).toBeInTheDocument()
    expect(onEditSubmit).not.toHaveBeenCalled()
  })
})

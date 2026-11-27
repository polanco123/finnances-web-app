import { render, screen, within } from '@testing-library/react'
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

import MovementEditDialog from './movement-edit-dialog'
import type { Movimiento } from './movement-service'

const row = (over: Partial<Movimiento>): Movimiento => ({
  id: 'x',
  monto: -100,
  fecha: '2026-11-10',
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: '2026-11-10T12:00:00Z',
  ...over,
})

describe('MovementEditDialog', () => {
  it('renders nothing without a target', () => {
    render(<MovementEditDialog target={null} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a dialog with the form prefilled from a regular row', () => {
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    expect(screen.getByLabelText('Cuenta')).toHaveValue('A')
  })

  it('submits the mapped payload and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={onSubmit} onClose={onClose} />)
    const monto = screen.getByDisplayValue('100')
    await userEvent.clear(monto)
    await userEvent.type(monto, '150')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledWith({ monto: 150, cuentaId: 'A' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open when the write fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    const onClose = vi.fn()
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={onSubmit} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a visible error inside the dialog when the write fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={onSubmit} onClose={vi.fn()} />)

    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el cambio.',
    )
  })

  it('clears the error on the next submit attempt and closes when it succeeds', async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const onClose = vi.fn()
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={onSubmit} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the same error for a failed transfer edit', async () => {
    const origen = row({ monto: -200, cuenta_id: 'A', es_transferencia: true, transferencia_id: 't' })
    const destino = row({ monto: 200, cuenta_id: 'B', es_transferencia: true, transferencia_id: 't' })
    render(
      <MovementEditDialog
        target={{ kind: 'transfer', origen, destino }}
        onSubmit={vi.fn().mockResolvedValue(false)}
        onClose={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio.')
  })

  it('maps a transfer target to origen/destino', async () => {
    const origen = row({ monto: -200, cuenta_id: 'A', es_transferencia: true, transferencia_id: 't' })
    const destino = row({ monto: 200, cuenta_id: 'B', es_transferencia: true, transferencia_id: 't' })
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<MovementEditDialog target={{ kind: 'transfer', origen, destino }} onSubmit={onSubmit} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledWith({ monto: 200, cuentaOrigen: 'A', cuentaDestino: 'B' })
  })

  it('calls onClose when dismissed with Escape', async () => {
    const onClose = vi.fn()
    render(<MovementEditDialog target={{ kind: 'movimiento', row: row({}) }} onSubmit={vi.fn()} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

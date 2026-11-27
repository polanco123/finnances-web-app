import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MovementListItem from './movement-list-item'
import MovementTransferCard from './movement-transfer-card'
import type { Movimiento } from './movement-service'

const row: Movimiento = {
  id: 'm1',
  monto: -100,
  fecha: '2026-11-10',
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: '2026-11-10T12:00:00Z',
}
const origen: Movimiento = { ...row, id: 'o', monto: -200, es_transferencia: true, transferencia_id: 't1' }
const destino: Movimiento = { ...row, id: 'd', monto: 200, cuenta_id: 'B', es_transferencia: true, transferencia_id: 't1' }

describe('MovementListItem selection (opt-in)', () => {
  it('is not interactive without onSelect', () => {
    render(<MovementListItem movimiento={row} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('exposes button semantics and calls onSelect on click with the movement', async () => {
    const onSelect = vi.fn()
    render(<MovementListItem movimiento={row} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(row)
  })

  it('activates with Enter and Space', async () => {
    const onSelect = vi.fn()
    render(<MovementListItem movimiento={row} onSelect={onSelect} />)
    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('advertises the popover via aria-haspopup', () => {
    render(<MovementListItem movimiento={row} onSelect={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'dialog')
  })
})

describe('MovementTransferCard selection (opt-in)', () => {
  it('is not interactive without onSelect', () => {
    render(<MovementTransferCard origen={origen} destino={destino} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onSelect with both legs on click and keyboard', async () => {
    const onSelect = vi.fn()
    render(<MovementTransferCard origen={origen} destino={destino} onSelect={onSelect} />)
    const card = screen.getByRole('button')
    await userEvent.click(card)
    expect(onSelect).toHaveBeenLastCalledWith(origen, destino)
    card.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
  })
})

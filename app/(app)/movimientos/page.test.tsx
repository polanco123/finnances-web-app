import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/diversion/diversion-budget-hint', () => ({ default: () => null }))
vi.mock('@/components/diversion/diversion-service', () => ({ isDiversionCategoria: () => false }))
vi.mock('@/components/movement/movement-form', () => ({
  default: ({
    mode,
    onEditSubmit,
  }: {
    mode?: string
    onEditSubmit?: (v: object) => Promise<void>
  }) =>
    mode === 'edit' ? (
      <button type="button" onClick={() => onEditSubmit?.({ tipo: 'gasto', monto: 150, cuentaId: 'B' })}>
        stub-guardar
      </button>
    ) : null,
}))
vi.mock('@/components/movement/movement-service', () => ({
  fetchMovimientosPage: vi.fn(),
  updateMovimiento: vi.fn(),
  deleteMovimiento: vi.fn(),
  restoreMovimiento: vi.fn(),
  updateTransferencia: vi.fn(),
  deleteTransferencia: vi.fn(),
  restoreTransferencia: vi.fn(),
}))

import * as service from '@/components/movement/movement-service'
import type { Movimiento } from '@/components/movement/movement-service'
import Page from './page'

const mocked = vi.mocked(service)

const row = (id: string, monto: number, fecha: string, over: Partial<Movimiento> = {}): Movimiento => ({
  id,
  monto,
  fecha,
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: `${fecha}T12:00:00Z`,
  ...over,
})

const r1 = row('r1', -100, '2026-11-12')
const r2 = row('r2', -200, '2026-11-11')
const r3 = row('r3', -300, '2026-11-10')
const origen = row('o', -500, '2026-11-09', { es_transferencia: true, transferencia_id: 't1' })
const destino = row('d', 500, '2026-11-09', { es_transferencia: true, transferencia_id: 't1', cuenta_id: 'B' })

/** Order of rendered amounts, top to bottom. */
const amounts = () => screen.getAllByText(/\$\d/).map((el) => el.textContent)

async function renderPage(rows: Movimiento[]) {
  mocked.fetchMovimientosPage.mockResolvedValue({ movimientos: rows, nextCursor: null, hasMore: false })
  render(<Page />)
  await screen.findByText('Últimos movimientos')
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('movimientos page edit/delete wiring', () => {
  it('delete then Undo restores the row at its original position', async () => {
    await renderPage([r1, r2, r3])
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockResolvedValue([r2])

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(mocked.deleteMovimiento).toHaveBeenCalledWith('r2')
    expect(amounts()).toEqual(['-$100.00', '-$300.00'])
    expect(screen.getByRole('status')).toHaveTextContent('Movimiento eliminado')

    await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Deshacer' }))

    expect(mocked.restoreMovimiento).toHaveBeenCalledWith([r2])
    expect(amounts()).toEqual(['-$100.00', '-$200.00', '-$300.00'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('deletes both legs of a merged transfer through the transfer RPC', async () => {
    await renderPage([r1, origen, destino])
    mocked.deleteTransferencia.mockResolvedValue([origen, destino])

    await userEvent.click(screen.getByText('$500.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(mocked.deleteTransferencia).toHaveBeenCalledWith('t1')
    expect(amounts()).toEqual(['-$100.00'])
    expect(screen.getByRole('status')).toHaveTextContent('Transferencia eliminada')
  })

  it('does not make MSI rows selectable', async () => {
    await renderPage([r1, row('msi', -400, '2026-11-11', { msi_id: 7 })])

    await userEvent.click(screen.getByText('-$400.00'))

    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('surfaces an error and leaves the list unchanged when delete fails', async () => {
    await renderPage([r1, r2])
    mocked.deleteMovimiento.mockRejectedValue(new Error('boom'))

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar el movimiento.')
    expect(amounts()).toEqual(['-$100.00', '-$200.00'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('edits through the dialog, updates the row in place and offers Undo', async () => {
    await renderPage([r1, r2, r3])
    mocked.updateMovimiento.mockResolvedValue({ ...r2, monto: -150, cuenta_id: 'B' })

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'stub-guardar' }))

    expect(mocked.updateMovimiento).toHaveBeenCalledWith(r2, { monto: 150, cuentaId: 'B' })
    expect(amounts()).toEqual(['-$100.00', '-$150.00', '-$300.00'])
    expect(screen.getByRole('status')).toHaveTextContent('Movimiento actualizado')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

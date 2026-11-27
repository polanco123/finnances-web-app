import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/diversion/diversion-budget-hint', () => ({
  default: ({ refreshToken }: { refreshToken: number }) => <span data-testid="hint-token">{refreshToken}</span>,
}))
const diversionState = { active: false }
vi.mock('@/components/diversion/diversion-service', () => ({
  isDiversionCategoria: () => diversionState.active,
}))
vi.mock('@/components/movement/movement-form', () => ({
  default: function FormStub({
    mode,
    onEditSubmit,
    onGastoCategoriaChange,
  }: {
    mode?: string
    onEditSubmit?: (v: object) => Promise<void>
    onGastoCategoriaChange?: (id: string | null) => void
  }) {
    useEffect(() => {
      if (mode !== 'edit') onGastoCategoriaChange?.('diversion')
    }, [mode, onGastoCategoriaChange])
    return mode === 'edit' ? (
      <button type="button" onClick={() => onEditSubmit?.({ tipo: 'gasto', monto: 150, cuentaId: 'B' })}>
        stub-guardar
      </button>
    ) : null
  },
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

/** Captures every IntersectionObserver so tests can fire the infinite-scroll sentinel. */
const observers: Array<{ callback: IntersectionObserverCallback }> = []

async function scrollToSentinel() {
  const latest = observers[observers.length - 1]
  await act(async () => {
    latest.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

interface PageResult {
  movimientos: Movimiento[]
  nextCursor: null
  hasMore: boolean
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback })
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
})

beforeEach(() => {
  vi.resetAllMocks()
  observers.length = 0
  diversionState.active = false
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

describe('failed edit feedback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows the error inside the dialog (not only behind the overlay) and keeps it open', async () => {
    await renderPage([r1, r2])
    mocked.updateMovimiento.mockRejectedValue(new Error('rls'))

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'stub-guardar' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio.')
    expect(amounts()).toEqual(['-$100.00', '-$200.00'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // One alert only: the page-level banner is hidden while the dialog is open.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('does not leave a stale error on the page after the dialog is dismissed', async () => {
    await renderPage([r1, r2])
    mocked.updateMovimiento.mockRejectedValue(new Error('rls'))

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'stub-guardar' }))
    await within(await screen.findByRole('dialog')).findByRole('alert')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the dialog error for a failed transfer edit too', async () => {
    await renderPage([origen, destino])
    mocked.updateTransferencia.mockRejectedValue(new Error('rpc'))

    await userEvent.click(screen.getByText('$500.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'stub-guardar' }))

    expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el cambio.',
    )
  })
})

describe('infinite scroll vs. optimistic patches', () => {
  const page1 = {
    movimientos: [r1, r2],
    nextCursor: { fecha: r2.fecha, hora: '12:00:00', createdAt: r2.created_at, id: 'r2' },
    hasMore: true,
  }

  async function renderWithNextPage() {
    mocked.fetchMovimientosPage.mockResolvedValueOnce(page1)
    render(<Page />)
    await screen.findByText('Últimos movimientos')
  }

  it('does not resurrect a row deleted while the next page was in flight', async () => {
    await renderWithNextPage()

    const inFlight = deferred<PageResult>()
    mocked.fetchMovimientosPage.mockReturnValueOnce(inFlight.promise)
    await scrollToSentinel()

    mocked.deleteMovimiento.mockResolvedValue([r2])
    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(amounts()).toEqual(['-$100.00'])

    await act(async () => inFlight.resolve({ movimientos: [r2, r3], nextCursor: null, hasMore: false }))

    expect(amounts()).not.toContain('-$200.00')
  })

  it('does not duplicate a row restored while the next page was in flight', async () => {
    await renderWithNextPage()
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockResolvedValue([r2])
    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    const inFlight = deferred<PageResult>()
    mocked.fetchMovimientosPage.mockReturnValueOnce(inFlight.promise)
    await scrollToSentinel()
    await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Deshacer' }))
    await act(async () => inFlight.resolve({ movimientos: [r2, r3], nextCursor: null, hasMore: false }))

    expect(amounts().filter((a) => a === '-$200.00')).toHaveLength(1)
  })

  it('shows the missing rows after the discarded page is fetched again', async () => {
    await renderWithNextPage()

    const inFlight = deferred<PageResult>()
    mocked.fetchMovimientosPage.mockReturnValueOnce(inFlight.promise)
    await scrollToSentinel()
    mocked.deleteMovimiento.mockResolvedValue([r2])
    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await act(async () => inFlight.resolve({ movimientos: [r2, r3], nextCursor: null, hasMore: false }))

    // Sentinel fires again: the fresh page (server already deleted r2) is appended.
    mocked.fetchMovimientosPage.mockResolvedValueOnce({ movimientos: [r3], nextCursor: null, hasMore: false })
    await scrollToSentinel()

    expect(amounts()).toEqual(['-$100.00', '-$300.00'])
  })

  it('dedupes rows by id when a page overlaps the list', async () => {
    await renderWithNextPage()

    mocked.fetchMovimientosPage.mockResolvedValueOnce({ movimientos: [r2, r3], nextCursor: null, hasMore: false })
    await scrollToSentinel()

    expect(amounts()).toEqual(['-$100.00', '-$200.00', '-$300.00'])
  })
})

describe('unpaired transfer legs', () => {
  it('does not make a lone origen leg selectable', async () => {
    await renderPage([r1, origen])

    await userEvent.click(screen.getByText('-$500.00'))

    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('does not make a lone destino leg selectable', async () => {
    await renderPage([destino, r3])

    await userEvent.click(screen.getByText('$500.00'))

    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(mocked.deleteMovimiento).not.toHaveBeenCalled()
  })

  it('keeps a complete pair selectable', async () => {
    await renderPage([origen, destino])

    await userEvent.click(screen.getByText('$500.00'))

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('a leg whose pair arrives on the next page becomes a selectable card', async () => {
    mocked.fetchMovimientosPage.mockResolvedValueOnce({
      movimientos: [r1, origen],
      nextCursor: { fecha: origen.fecha, hora: '12:00:00', createdAt: origen.created_at, id: 'o' },
      hasMore: true,
    })
    render(<Page />)
    await screen.findByText('Últimos movimientos')
    await userEvent.click(screen.getByText('-$500.00'))
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()

    mocked.fetchMovimientosPage.mockResolvedValueOnce({ movimientos: [destino], nextCursor: null, hasMore: false })
    await scrollToSentinel()
    await userEvent.click(screen.getByText('$500.00'))

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })
})

describe('undo toast and hint refresh', () => {
  it('bumps the diversion hint refresh token after a delete and again after an undo', async () => {
    diversionState.active = true
    await renderPage([r1, r2])
    await waitFor(() => expect(screen.getByTestId('hint-token')).toHaveTextContent('0'))
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockResolvedValue([r2])

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(screen.getByTestId('hint-token')).toHaveTextContent('1')

    await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Deshacer' }))
    expect(screen.getByTestId('hint-token')).toHaveTextContent('2')
  })

  it('does not bump the token when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    diversionState.active = true
    await renderPage([r1, r2])
    mocked.deleteMovimiento.mockRejectedValue(new Error('x'))

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await screen.findByRole('alert')

    expect(screen.getByTestId('hint-token')).toHaveTextContent('0')
  })

  it('pauses the expiry while hovering the toast and resumes on leave', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderPage([r1, r2])
    mocked.deleteMovimiento.mockResolvedValue([r2])

    await user.click(screen.getByText('-$200.00'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    const toast = screen.getByRole('status')

    await user.hover(toast)
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.unhover(toast)
    await act(async () => {
      vi.advanceTimersByTime(6500)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps the toast available for a retry when the undo fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await renderPage([r1, r2])
    mocked.deleteMovimiento.mockResolvedValue([r2])
    mocked.restoreMovimiento.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce([r2])

    await userEvent.click(screen.getByText('-$200.00'))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Deshacer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo deshacer la acción.')
    expect(screen.getByRole('status')).toHaveTextContent('Movimiento eliminado')

    await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Deshacer' }))
    expect(amounts()).toEqual(['-$100.00', '-$200.00'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

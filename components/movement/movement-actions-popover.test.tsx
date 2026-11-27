import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import MovementActionsPopover from './movement-actions-popover'

beforeAll(() => {
  // Radix popper measures its anchor with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function setup(open: boolean) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <MovementActionsPopover open={open} onOpenChange={onOpenChange} onEdit={onEdit} onDelete={onDelete}>
      <div>fila</div>
    </MovementActionsPopover>,
  )
  return { onEdit, onDelete, onOpenChange }
}

describe('MovementActionsPopover', () => {
  it('shows the anchor row and no actions while closed', () => {
    setup(false)
    expect(screen.getByText('fila')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
  })

  it('shows Editar and Eliminar while open', () => {
    setup(true)
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('calls onEdit and closes when Editar is chosen', async () => {
    const { onEdit, onDelete, onOpenChange } = setup(true)
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onDelete and closes when Eliminar is chosen', async () => {
    const { onEdit, onDelete, onOpenChange } = setup(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

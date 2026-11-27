import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import UndoToast from './undo-toast'

function setup(label = 'Movimiento eliminado') {
  const onUndo = vi.fn()
  const onPause = vi.fn()
  const onResume = vi.fn()
  render(<UndoToast label={label} onUndo={onUndo} onPause={onPause} onResume={onResume} />)
  return { onUndo, onPause, onResume }
}

describe('UndoToast', () => {
  it('announces the label in a status region', () => {
    setup('Transferencia eliminada')
    expect(screen.getByRole('status')).toHaveTextContent('Transferencia eliminada')
  })

  it('calls onUndo when Deshacer is activated', async () => {
    const { onUndo } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('pauses on hover and resumes on leave', () => {
    const { onPause, onResume } = setup()
    const toast = screen.getByRole('status')
    fireEvent.mouseEnter(toast)
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onResume).not.toHaveBeenCalled()
    fireEvent.mouseLeave(toast)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('pauses on focus and resumes on blur', () => {
    const { onPause, onResume } = setup()
    const button = screen.getByRole('button', { name: 'Deshacer' })
    fireEvent.focus(button)
    expect(onPause).toHaveBeenCalledTimes(1)
    fireEvent.blur(button)
    expect(onResume).toHaveBeenCalledTimes(1)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('test harness', () => {
  it('resolves the @ alias and runs production code', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('renders JSX in jsdom with jest-dom matchers', () => {
    render(<button disabled>Guardar</button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
})

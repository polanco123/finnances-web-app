import type { KeyboardEvent } from 'react'

/**
 * Button semantics for a row that opts into selection. Returns an empty object
 * when `onSelect` is absent so non-interactive consumers render exactly as before.
 */
export function selectableProps(onSelect: (() => void) | undefined) {
  if (!onSelect) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-haspopup': 'dialog' as const,
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect()
      }
    },
  }
}

export const SELECTABLE_CLASS = 'movement-selectable'

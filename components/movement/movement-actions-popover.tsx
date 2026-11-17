'use client'

import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import './movement-actions-popover.css'

interface MovementActionsPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  /** The selectable row; the popover anchors to it. */
  children: ReactNode
}

export default function MovementActionsPopover({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  children,
}: MovementActionsPopoverProps) {
  const choose = (action: () => void) => () => {
    onOpenChange(false)
    action()
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>
        <div className="movement-actions-popover__anchor">{children}</div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content className="movement-actions-popover" sideOffset={4} align="end">
          <button type="button" className="movement-actions-popover__action" onClick={choose(onEdit)}>
            Editar
          </button>
          <button
            type="button"
            className="movement-actions-popover__action movement-actions-popover__action--danger"
            onClick={choose(onDelete)}
          >
            Eliminar
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import MovementForm from '@/components/movement/movement-form'
import {
  deriveEditInitialValues,
  toEditPayload,
  type EditSubmission,
  type EditTarget,
} from './movement-edit-values'
import type { MovimientoEdit, TransferenciaEdit } from './movement-service'
import './movement-edit-dialog.css'

interface MovementEditDialogProps {
  /** The row (or transfer pair) being edited; null keeps the dialog closed. */
  target: EditTarget | null
  /** Resolves true when the write succeeded (the dialog then closes). */
  onSubmit: (edit: MovimientoEdit | TransferenciaEdit) => Promise<boolean>
  onClose: () => void
}

export default function MovementEditDialog({ target, onSubmit, onClose }: MovementEditDialogProps) {
  const handleEditSubmit = async (values: EditSubmission) => {
    const saved = await onSubmit(toEditPayload(values))
    if (saved) onClose()
  }

  return (
    <Dialog.Root open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="movement-edit-dialog__overlay" />
        <Dialog.Content className="movement-edit-dialog" aria-describedby={undefined}>
          <Dialog.Title className="movement-edit-dialog__title">Editar movimiento</Dialog.Title>
          {target && (
            <MovementForm
              mode="edit"
              initialValues={deriveEditInitialValues(target)}
              onEditSubmit={handleEditSubmit}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

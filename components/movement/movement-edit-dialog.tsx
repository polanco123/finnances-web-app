'use client'

import { useState } from 'react'
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

const SAVE_ERROR = 'No se pudo guardar el cambio.'

interface MovementEditDialogProps {
  /** The row (or transfer pair) being edited; null keeps the dialog closed. */
  target: EditTarget | null
  /** Resolves true when the write succeeded (the dialog then closes). */
  onSubmit: (edit: MovimientoEdit | TransferenciaEdit) => Promise<boolean>
  onClose: () => void
}

type EditFormProps = Omit<MovementEditDialogProps, 'target'> & { target: EditTarget }

/** Mounted only while the dialog is open, so the error resets on every open. */
function EditForm({ target, onSubmit, onClose }: EditFormProps) {
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleEditSubmit = async (values: EditSubmission) => {
    setSaveError(null)
    const saved = await onSubmit(toEditPayload(values))
    if (saved) onClose()
    else setSaveError(SAVE_ERROR)
  }

  return (
    <>
      {saveError && (
        <div className="movement-edit-dialog__error" role="alert">
          {saveError}
        </div>
      )}
      <MovementForm
        mode="edit"
        initialValues={deriveEditInitialValues(target)}
        onEditSubmit={handleEditSubmit}
      />
    </>
  )
}

export default function MovementEditDialog({ target, onSubmit, onClose }: MovementEditDialogProps) {
  return (
    <Dialog.Root open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="movement-edit-dialog__overlay" />
        <Dialog.Content className="movement-edit-dialog" aria-describedby={undefined}>
          <Dialog.Title className="movement-edit-dialog__title">Editar movimiento</Dialog.Title>
          {target && <EditForm target={target} onSubmit={onSubmit} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { insertSorted, removeByIds, replaceRows } from './movement-list-patch'
import {
  deleteMovimiento as deleteMovimientoRow,
  deleteTransferencia as deleteTransferenciaRows,
  restoreMovimiento,
  restoreTransferencia,
  updateMovimiento,
  updateTransferencia,
  type Movimiento,
  type MovimientoCursor,
  type MovimientoEdit,
  type TransferenciaEdit,
} from './movement-service'
import { useUndoAction, type UseUndoAction } from './use-undo-action'

export interface UseMovementActionsOptions {
  setMovements: Dispatch<SetStateAction<Movimiento[]>>
  cursor: MovimientoCursor | null
  hasMore: boolean
  /** Called after every successful write or undo (e.g. to bump `hintRefreshToken`). */
  onChanged: () => void
}

export interface UseMovementActions {
  editMovimiento(original: Movimiento, edit: MovimientoEdit): Promise<boolean>
  editTransferencia(origen: Movimiento, destino: Movimiento, edit: TransferenciaEdit): Promise<boolean>
  deleteMovimiento(row: Movimiento): Promise<boolean>
  deleteTransferencia(transferenciaId: string): Promise<boolean>
  undo: UseUndoAction
  error: string | null
  clearError(): void
}

const MESSAGES = {
  edit: 'No se pudo guardar el cambio.',
  delete: 'No se pudo eliminar el movimiento.',
  undo: 'No se pudo deshacer la acción.',
} as const

export function useMovementActions({
  setMovements,
  cursor,
  hasMore,
  onChanged,
}: UseMovementActionsOptions): UseMovementActions {
  const undo = useUndoAction()
  const startUndo = undo.start
  const [error, setError] = useState<string | null>(null)

  // Undo closures outlive renders; read the latest paging state at call time.
  const pagingRef = useRef({ cursor, hasMore })
  useEffect(() => {
    pagingRef.current = { cursor, hasMore }
  }, [cursor, hasMore])

  const patchReplace = useCallback(
    (rows: Movimiento[]) => setMovements((prev) => replaceRows(prev, rows)),
    [setMovements],
  )
  const patchRemove = useCallback(
    (rows: Movimiento[]) => {
      const ids = rows.map((row) => row.id)
      setMovements((prev) => removeByIds(prev, ids))
    },
    [setMovements],
  )
  const patchInsert = useCallback(
    (rows: Movimiento[]) => setMovements((prev) => insertSorted(prev, rows, pagingRef.current)),
    [setMovements],
  )

  /** Runs a write; on failure surfaces `message` and returns null (list untouched). */
  const attempt = useCallback(async <T,>(message: string, write: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await write()
      setError(null)
      return result
    } catch (err) {
      console.error(`[movement-actions] ${message}`, err)
      setError(message)
      return null
    }
  }, [])

  const commit = useCallback(
    (label: string, inverse: () => Promise<void>) => {
      onChanged()
      startUndo(label, async () => {
        try {
          await inverse()
          setError(null)
          onChanged()
        } catch (err) {
          console.error(`[movement-actions] ${MESSAGES.undo}`, err)
          setError(MESSAGES.undo)
          // Rethrow so the undo slot stays available for a retry.
          throw err
        }
      })
    },
    [onChanged, startUndo],
  )

  const editMovimiento = useCallback(
    async (original: Movimiento, edit: MovimientoEdit) => {
      const updated = await attempt(MESSAGES.edit, () => updateMovimiento(original, edit))
      if (!updated) return false
      patchReplace([updated])
      commit('Movimiento actualizado', async () => {
        const restored = await updateMovimiento(original, {
          monto: Math.abs(original.monto),
          cuentaId: original.cuenta_id,
        })
        patchReplace([restored])
      })
      return true
    },
    [attempt, patchReplace, commit],
  )

  const editTransferencia = useCallback(
    async (origen: Movimiento, destino: Movimiento, edit: TransferenciaEdit) => {
      const transferenciaId = origen.transferencia_id as string
      const updated = await attempt(MESSAGES.edit, () => updateTransferencia(transferenciaId, edit))
      if (!updated) return false
      patchReplace(updated)
      commit('Transferencia actualizada', async () => {
        const restored = await updateTransferencia(transferenciaId, {
          monto: Math.abs(origen.monto),
          cuentaOrigen: origen.cuenta_id,
          cuentaDestino: destino.cuenta_id,
        })
        patchReplace(restored)
      })
      return true
    },
    [attempt, patchReplace, commit],
  )

  const deleteMovimiento = useCallback(
    async (row: Movimiento) => {
      const deleted = await attempt(MESSAGES.delete, () => deleteMovimientoRow(row.id))
      if (!deleted) return false
      patchRemove(deleted)
      commit('Movimiento eliminado', async () => {
        const restored = await restoreMovimiento(deleted)
        patchInsert(restored)
      })
      return true
    },
    [attempt, patchRemove, patchInsert, commit],
  )

  const deleteTransferencia = useCallback(
    async (transferenciaId: string) => {
      const deleted = await attempt(MESSAGES.delete, () => deleteTransferenciaRows(transferenciaId))
      if (!deleted) return false
      patchRemove(deleted)
      commit('Transferencia eliminada', async () => {
        const restored = await restoreTransferencia(deleted)
        patchInsert(restored)
      })
      return true
    },
    [attempt, patchRemove, patchInsert, commit],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    editMovimiento,
    editTransferencia,
    deleteMovimiento,
    deleteTransferencia,
    undo,
    error,
    clearError,
  }
}

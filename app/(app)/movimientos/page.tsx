'use client'

import {
  Fragment,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useSearchParams } from 'next/navigation'
import MovementForm from '@/components/movement/movement-form'
import MovementListItem from '@/components/movement/movement-list-item'
import MovementTransferCard from '@/components/movement/movement-transfer-card'
import MovementActionsPopover from '@/components/movement/movement-actions-popover'
import MovementEditDialog from '@/components/movement/movement-edit-dialog'
import UndoToast from '@/components/movement/undo-toast'
import { useMovementActions } from '@/components/movement/use-movement-actions'
import type { EditTarget } from '@/components/movement/movement-edit-values'
import { groupMovimientos } from '@/components/movement/movement-grouping'
import { appendNewRows } from '@/components/movement/movement-list-patch'
import type { DisplayItem } from '@/components/movement/movement-grouping'
import {
  type Movimiento,
  type MovimientoCursor,
  type MovimientoEdit,
  type TransferenciaEdit,
  fetchMovimientosPage,
} from '@/components/movement/movement-service'
// import VoiceEntryButton from '@/components/voice-entry/voice-entry-button'
import DiversionBudgetHint from '@/components/diversion/diversion-budget-hint'
import { isDiversionCategoria } from '@/components/diversion/diversion-service'
import type { ParsedMovimiento } from '@/components/voice-entry/voice-parser'
import './page.css'

const PAGE_SIZE = 10

const VALID_TIPOS = ['gasto', 'ingreso', 'transferencia']

function MovimientosContent() {
  const searchParams = useSearchParams()
  const tipoParam = searchParams.get('tipo')
  const categoriaParam = searchParams.get('categoria')
  const initialTipoFromUrl = VALID_TIPOS.includes(tipoParam ?? '')
    ? (tipoParam as 'gasto' | 'ingreso' | 'transferencia')
    : undefined

  const [movements, setMovements] = useState<Movimiento[]>([])
  const [cursor, setCursor] = useState<MovimientoCursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [voicePrefill, setVoicePrefill] = useState<ParsedMovimiento | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [gastoCategoriaId, setGastoCategoriaId] = useState<string | null>(null)
  const [hintRefreshToken, setHintRefreshToken] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

  // Bumped on every optimistic patch (edit/delete/undo). A page fetched before a
  // patch is stale (it can resurrect deleted rows or hold pre-edit values).
  const patchEpochRef = useRef(0)
  const patchMovements = useCallback<Dispatch<SetStateAction<Movimiento[]>>>((update) => {
    patchEpochRef.current += 1
    setMovements(update)
  }, [])

  const bumpHintRefreshToken = useCallback(() => setHintRefreshToken((t) => t + 1), [])
  const actions = useMovementActions({
    setMovements: patchMovements,
    cursor,
    hasMore,
    onChanged: bumpHintRefreshToken,
  })

  const loadInitial = useCallback(async () => {
    try {
      setLoadingInitial(true)
      setError(null)
      const page = await fetchMovimientosPage(null, PAGE_SIZE)
      setMovements(page.movimientos)
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar movimientos')
    } finally {
      setLoadingInitial(false)
    }
  }, [])

  const loadNextPage = useCallback(async () => {
    if (!cursor) return
    try {
      setLoadingMore(true)
      setError(null)
      const epoch = patchEpochRef.current
      const page = await fetchMovimientosPage(cursor, PAGE_SIZE)
      // Patched while in flight: drop the stale page; the sentinel refetches it.
      if (epoch !== patchEpochRef.current) return
      setMovements((prev) => appendNewRows(prev, page.movimientos))
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar más movimientos')
    } finally {
      setLoadingMore(false)
    }
  }, [cursor])

  const handleMovimientoCreado = useCallback(() => {
    setMovements([])
    setCursor(null)
    setHasMore(true)
    setHintRefreshToken((t) => t + 1)
    loadInitial()
  }, [loadInitial])

  const handleVoiceParsed = useCallback((parsed: ParsedMovimiento) => {
    setVoicePrefill(parsed)
    setFormKey((k) => k + 1)
  }, [])

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
        loadNextPage()
      }
    },
    [hasMore, loadingMore, loadNextPage],
  )

  const sentinelCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      if (!node) return
      observerRef.current = new IntersectionObserver(handleIntersect, {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      })
      observerRef.current.observe(node)
    },
    [handleIntersect],
  )

  const handleEditSubmit = useCallback(
    (edit: MovimientoEdit | TransferenciaEdit) => {
      if (!editTarget) return Promise.resolve(false)
      return editTarget.kind === 'transfer'
        ? actions.editTransferencia(editTarget.origen, editTarget.destino, edit as TransferenciaEdit)
        : actions.editMovimiento(editTarget.row, edit as MovimientoEdit)
    },
    [actions, editTarget],
  )

  const { clearError } = actions
  const handleEditClose = useCallback(() => {
    setEditTarget(null)
    clearError()
  }, [clearError])

  const displayItems = useMemo(() => groupMovimientos(movements), [movements])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  return (
    <div className="movimientos-page">
      <div className="movimientos-page__container">
        {/* Botón de voz desactivado temporalmente - faltan detalles por afinar */}
        {/* <VoiceEntryButton onParsed={handleVoiceParsed} /> */}

        {isDiversionCategoria(gastoCategoriaId) && (
          <DiversionBudgetHint refreshToken={hintRefreshToken} />
        )}

        <MovementForm
          key={formKey}
          onMovimientoCreado={handleMovimientoCreado}
          initialTipo={voicePrefill?.tipo ?? initialTipoFromUrl}
          initialMonto={voicePrefill?.cantidad != null ? String(voicePrefill.cantidad) : undefined}
          initialCuentaId={voicePrefill?.cuentaId ?? undefined}
          initialCategoriaId={voicePrefill?.categoriaId ?? categoriaParam ?? undefined}
          initialCuentaOrigenId={voicePrefill?.cuentaOrigenId ?? undefined}
          initialCuentaDestinoId={voicePrefill?.cuentaDestinoId ?? undefined}
          initialNotas={voicePrefill?.notas ?? undefined}
          autoFocusMonto={Boolean(initialTipoFromUrl) && !voicePrefill}
          onGastoCategoriaChange={setGastoCategoriaId}
        />

        {error && <div className="movimientos-page__error">{error}</div>}
        {/* While the edit dialog is open it shows its own error (the overlay hides this one). */}
        {actions.error && !editTarget && (
          <div className="movimientos-page__error" role="alert">
            {actions.error}
          </div>
        )}

        {loadingInitial ? (
          <div className="movimientos-page__loading">Cargando movimientos...</div>
        ) : (
          <>
            <div className="movimientos-list">
              <h2>Últimos movimientos</h2>
              {displayItems.map((item: DisplayItem) => {
                if (item.kind === 'merged-transfer') {
                  const key = `merged-${item.transferenciaId}`
                  const { origen, destino } = item
                  // MSI legs are never editable (the RPCs reject them too).
                  const selectable = origen.msi_id == null && destino.msi_id == null
                  const card = (
                    <MovementTransferCard
                      origen={origen}
                      destino={destino}
                      onSelect={selectable ? () => setSelectedKey(key) : undefined}
                    />
                  )
                  return selectable ? (
                    <MovementActionsPopover
                      key={key}
                      open={selectedKey === key}
                      onOpenChange={(open) => setSelectedKey(open ? key : null)}
                      onEdit={() => setEditTarget({ kind: 'transfer', origen, destino })}
                      onDelete={() => actions.deleteTransferencia(item.transferenciaId)}
                    >
                      {card}
                    </MovementActionsPopover>
                  ) : (
                    <Fragment key={key}>{card}</Fragment>
                  )
                }

                const row = item.data
                // MSI rows and unpaired transfer legs are never editable alone:
                // a lone leg would break the atomic pair (design: both legs or none).
                if (row.msi_id != null || row.es_transferencia) {
                  return <MovementListItem key={row.id} movimiento={row} />
                }
                return (
                  <MovementActionsPopover
                    key={row.id}
                    open={selectedKey === row.id}
                    onOpenChange={(open) => setSelectedKey(open ? row.id : null)}
                    onEdit={() => setEditTarget({ kind: 'movimiento', row })}
                    onDelete={() => actions.deleteMovimiento(row)}
                  >
                    <MovementListItem movimiento={row} onSelect={() => setSelectedKey(row.id)} />
                  </MovementActionsPopover>
                )
              })}
              {hasMore && (
                <div ref={sentinelCallbackRef} className="movimientos-list__sentinel">
                  {loadingMore && (
                    <span className="movimientos-list__loading-more">Cargando más...</span>
                  )}
                </div>
              )}
            </div></>
        )

        }
      </div>

      <MovementEditDialog
        target={editTarget}
        onSubmit={handleEditSubmit}
        onClose={handleEditClose}
      />

      {actions.undo.active && (
        <UndoToast
          label={actions.undo.active.label}
          onUndo={actions.undo.run}
          onPause={actions.undo.pause}
          onResume={actions.undo.resume}
        />
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="movimientos-page">
          <div className="movimientos-page__loading">Cargando...</div>
        </div>
      }
    >
      <MovimientosContent />
    </Suspense>
  )
}

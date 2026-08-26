'use client'

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import MovementForm from '@/components/movement/movement-form'
import MovementListItem from '@/components/movement/movement-list-item'
import MovementTransferCard from '@/components/movement/movement-transfer-card'
import { groupMovimientos } from '@/components/movement/movement-grouping'
import type { DisplayItem } from '@/components/movement/movement-grouping'
import {
  type Movimiento,
  type MovimientoCursor,
  fetchMovimientosPage,
} from '@/components/movement/movement-service'
import VoiceEntryButton from '@/components/voice-entry/voice-entry-button'
import type { ParsedMovimiento } from '@/components/voice-entry/voice-parser'
import './page.css'

const PAGE_SIZE = 10

const VALID_TIPOS = ['gasto', 'ingreso', 'transferencia']

function MovimientosContent() {
  const searchParams = useSearchParams()
  const tipoParam = searchParams.get('tipo')
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
      const page = await fetchMovimientosPage(cursor, PAGE_SIZE)
      setMovements((prev) => [...prev, ...page.movimientos])
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

  const displayItems = useMemo(() => groupMovimientos(movements), [movements])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  return (
    <div className="movimientos-page">
      <div className="movimientos-page__container">
        <VoiceEntryButton onParsed={handleVoiceParsed} />

        <MovementForm
          key={formKey}
          onMovimientoCreado={handleMovimientoCreado}
          initialTipo={voicePrefill?.tipo ?? initialTipoFromUrl}
          initialMonto={voicePrefill?.cantidad != null ? String(voicePrefill.cantidad) : undefined}
          initialCuentaId={voicePrefill?.cuentaId ?? undefined}
          initialCategoriaId={voicePrefill?.categoriaId ?? undefined}
          initialCuentaOrigenId={voicePrefill?.cuentaOrigenId ?? undefined}
          initialCuentaDestinoId={voicePrefill?.cuentaDestinoId ?? undefined}
          initialNotas={voicePrefill?.notas ?? undefined}
          autoFocusMonto={Boolean(initialTipoFromUrl) && !voicePrefill}
        />

        {error && <div className="movimientos-page__error">{error}</div>}

        {loadingInitial ? (
          <div className="movimientos-page__loading">Cargando movimientos...</div>
        ) : (
          <>
            <div className="movimientos-list">
              <h2>Últimos movimientos</h2>
              {displayItems.map((item: DisplayItem) =>
                item.kind === 'merged-transfer' ? (
                  <MovementTransferCard
                    key={`merged-${item.transferenciaId}`}
                    origen={item.origen}
                    destino={item.destino}
                  />
                ) : (
                  <MovementListItem key={item.data.id} movimiento={item.data} />
                ),
              )}
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

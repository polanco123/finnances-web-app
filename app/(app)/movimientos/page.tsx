'use client'

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react'
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
import './page.css'

const PAGE_SIZE = 10

function MovimientosContent() {
  const [movements, setMovements] = useState<Movimiento[]>([])
  const [cursor, setCursor] = useState<MovimientoCursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

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
        <MovementForm onMovimientoCreado={handleMovimientoCreado} />

        {error && <div className="movimientos-page__error">{error}</div>}

        {loadingInitial ? (
          <div className="movimientos-page__loading">Cargando movimientos...</div>
        ) : (
          <div className="movimientos-list">
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
          </div>
        )}
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

'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  fetchActiveCuentas,
  fetchRecentMovimientos,
  fetchTransferSiblings,
  type Cuenta,
  type Movimiento,
} from '@/components/cuentas/cuentas-service'
import CuentaCard from '@/components/cuentas/cuentas-card'
import { CUENTAS, syncCuentas } from '@/lib/catalogs/catalog-store'
import './page.css'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

function CuentasContent() {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [movementsMap, setMovementsMap] = useState<Record<string, Movimiento[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      await syncCuentas()
      window.location.reload()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Error al sincronizar catálogo de cuentas')
      setSyncing(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const accounts = await fetchActiveCuentas()
        setCuentas(accounts)

        const movementsEntries = await Promise.all(
          accounts.map(async (account) => {
            const movs = await fetchRecentMovimientos(account.id)
            return [account.id, movs] as const
          }),
        )

        const ownMap = Object.fromEntries(movementsEntries) as Record<string, Movimiento[]>

        // A single account's own recent movimientos only ever contains ITS
        // side of a transfer (matching cuenta_id) — fetch the paired
        // account's side too so groupMovimientos() can merge them into one
        // card per transfer, mirroring /movimientos' behavior.
        const transferIds = new Set<string>()
        for (const movs of Object.values(ownMap)) {
          for (const m of movs) {
            if (m.es_transferencia && m.transferencia_id) transferIds.add(m.transferencia_id)
          }
        }

        const siblings = await fetchTransferSiblings(Array.from(transferIds))
        const siblingsByTransferId = new Map<string, Movimiento[]>()
        for (const sibling of siblings) {
          if (!sibling.transferencia_id) continue
          const existing = siblingsByTransferId.get(sibling.transferencia_id)
          if (existing) existing.push(sibling)
          else siblingsByTransferId.set(sibling.transferencia_id, [sibling])
        }

        const augmentedMap: Record<string, Movimiento[]> = {}
        for (const [accountId, movs] of Object.entries(ownMap)) {
          const ownIds = new Set(movs.map((m) => m.id))
          const extra: Movimiento[] = []
          for (const m of movs) {
            if (!m.es_transferencia || !m.transferencia_id) continue
            for (const pairRow of siblingsByTransferId.get(m.transferencia_id) ?? []) {
              if (!ownIds.has(pairRow.id) && !extra.some((e) => e.id === pairRow.id)) {
                extra.push(pairRow)
              }
            }
          }
          augmentedMap[accountId] = extra.length > 0 ? [...movs, ...extra] : movs
        }

        setMovementsMap(augmentedMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar las cuentas')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const catalogEmpty = CUENTAS.length === 0
  const balanceTotal = cuentas
    ? cuentas.reduce((sum, cuenta) => sum + cuenta.saldo_calculado, 0)
    : null

  let body: React.ReactNode
  if (loading) {
    body = <div className="cuentas-page__loading">Cargando cuentas...</div>
  } else if (error) {
    body = <div className="cuentas-page__error">{error}</div>
  } else if (!cuentas || cuentas.length === 0) {
    body = <div className="cuentas-page__empty">No hay cuentas activas</div>
  } else {
    body = (
      <div className="cuentas-page__grid">
        {cuentas.map((cuenta) => (
          <CuentaCard
            key={cuenta.id}
            cuenta={cuenta}
            movements={movementsMap?.[cuenta.id] ?? []}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="cuentas-page">
      <div className="cuentas-page__header">
        <h1 className="cuentas-page__title">Cuentas</h1>
        <div className="cuentas-page__header-actions">
          <button
            type="button"
            className="cuentas-page__sync-button"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
          </button>
          {balanceTotal !== null && (
            <div className="cuentas-page__total">
              <span className="cuentas-page__total-label">Balance total</span>
              <span className="cuentas-page__total-value">{formatCurrency(balanceTotal)}</span>
            </div>
          )}
        </div>
      </div>
      {catalogEmpty && (
        <div className="cuentas-page__catalog-banner">
          Datos no sincronizados. Haz clic en Sincronizar para cargar las cuentas desde Supabase.
        </div>
      )}
      {syncError && <div className="cuentas-page__error">{syncError}</div>}
      {body}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="cuentas-page">
          <div className="cuentas-page__loading">Cargando...</div>
        </div>
      }
    >
      <CuentasContent />
    </Suspense>
  )
}

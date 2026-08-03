'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  fetchActiveCuentas,
  fetchRecentMovimientos,
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

        setMovementsMap(Object.fromEntries(movementsEntries))
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
    ? cuentas.reduce((sum, cuenta) => sum + cuenta.saldo_real, 0)
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

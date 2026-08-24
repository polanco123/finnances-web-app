'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  fetchActiveCuentas,
  fetchRecentMovimientos,
  fetchTransferSiblings,
  updateCuentaIcono,
  type Cuenta,
  type Movimiento,
} from '@/components/cuentas/cuentas-service'
import CuentaCard from '@/components/cuentas/cuentas-card'
import { jetbrainsMono, inter } from '@/components/cuentas/cuentas-fonts'
import { CUENTAS, syncCuentas } from '@/lib/catalogs/catalog-store'
import './page.css'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Formats a `Date` as YYYY-MM-DD using its local (not UTC) components. */
function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jetbrainsMono.variable} ${inter.variable} cuentas-page`}>
      <div className="cuentas-page__container">{children}</div>
    </div>
  )
}

function CuentasContent() {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [movementsMap, setMovementsMap] = useState<Record<string, Movimiento[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleUpdateCuentaIcono(id: string, icono: string) {
    const updated = await updateCuentaIcono(id, icono)
    setCuentas((prev) => (prev ? prev.map((c) => (c.id === id ? updated : c)) : prev))
  }

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
  const today = toLocalISODate(new Date())

  const activos = cuentas?.filter((c) => c.tipo !== 'deuda') ?? []
  const deudas = cuentas?.filter((c) => c.tipo === 'deuda') ?? []
  const totalActivos = activos.reduce((sum, c) => sum + c.saldo_calculado, 0)
  const totalDeudas = deudas.reduce((sum, c) => sum + c.saldo_calculado, 0)

  const masthead = (
    <header className="cuentas-masthead">
      <h1 className="cuentas-masthead__title">Cuentas</h1>
      <div className="cuentas-masthead__right">
        <button
          type="button"
          className="cuentas-page__sync-button"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
        </button>
        <span className="cuentas-masthead__date">{today}</span>
      </div>
    </header>
  )

  if (loading) {
    return (
      <PageShell>
        {masthead}
        <p className="cuentas-page__loading">Cargando cuentas...</p>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        {masthead}
        <p className="cuentas-page__error">{error}</p>
      </PageShell>
    )
  }

  if (!cuentas || cuentas.length === 0) {
    return (
      <PageShell>
        {masthead}
        {catalogEmpty && (
          <p className="cuentas-page__catalog-banner">
            Datos no sincronizados. Haz clic en Sincronizar para cargar las cuentas desde Supabase.
          </p>
        )}
        {syncError && <p className="cuentas-page__error">{syncError}</p>}
        <p className="cuentas-page__empty">No hay cuentas activas</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {masthead}

      {catalogEmpty && (
        <p className="cuentas-page__catalog-banner">
          Datos no sincronizados. Haz clic en Sincronizar para cargar las cuentas desde Supabase.
        </p>
      )}
      {syncError && <p className="cuentas-page__error">{syncError}</p>}

      <div className="cuentas-summary">
        <div className="cuentas-summary__cell">
          <span className="cuentas-summary__label">Total activos</span>
          <span className="cuentas-summary__value">{formatCurrency(totalActivos)}</span>
          <span className="cuentas-summary__sub">{activos.length} cuentas</span>
        </div>
        <div className="cuentas-summary__cell">
          <span className="cuentas-summary__label">Total deudas</span>
          <span
            className={`cuentas-summary__value ${totalDeudas < 0 ? 'cuentas-summary__value--negative' : ''}`}
          >
            {formatCurrency(totalDeudas)}
          </span>
          <span className="cuentas-summary__sub">{deudas.length} cuentas</span>
        </div>
      </div>

      {activos.length > 0 && (
        <section className="cuentas-section">
          <p className="cuentas-section-title">Activos ({activos.length})</p>
          <div className="cuentas-list">
            {activos.map((cuenta) => (
              <CuentaCard
                key={cuenta.id}
                cuenta={cuenta}
                movements={movementsMap?.[cuenta.id] ?? []}
                onUpdateIcono={handleUpdateCuentaIcono}
              />
            ))}
          </div>
        </section>
      )}

      {deudas.length > 0 && (
        <section className="cuentas-section">
          <p className="cuentas-section-title">Deudas ({deudas.length})</p>
          <div className="cuentas-list">
            {deudas.map((cuenta) => (
              <CuentaCard
                key={cuenta.id}
                cuenta={cuenta}
                movements={movementsMap?.[cuenta.id] ?? []}
                onUpdateIcono={handleUpdateCuentaIcono}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="cuentas-page__footer">
        {cuentas.length} cuentas · datos en tiempo real desde Supabase
      </footer>
    </PageShell>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="cuentas-page__loading">Cargando...</p>
        </PageShell>
      }
    >
      <CuentasContent />
    </Suspense>
  )
}

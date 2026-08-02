'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  fetchActiveCuentas,
  fetchRecentMovimientos,
  type Cuenta,
  type Movimiento,
} from '@/components/cuentas/cuentas-service'
import CuentaCard from '@/components/cuentas/cuentas-card'
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

  if (loading) {
    return (
      <div className="cuentas-page">
        <div className="cuentas-page__loading">Cargando cuentas...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cuentas-page">
        <div className="cuentas-page__error">{error}</div>
      </div>
    )
  }

  if (!cuentas || cuentas.length === 0) {
    return (
      <div className="cuentas-page">
        <div className="cuentas-page__empty">No hay cuentas activas</div>
      </div>
    )
  }

  const balanceTotal = cuentas.reduce((sum, cuenta) => sum + cuenta.saldo_calculado, 0)

  return (
    <div className="cuentas-page">
      <div className="cuentas-page__header">
        <h1 className="cuentas-page__title">Cuentas</h1>
        <div className="cuentas-page__total">
          <span className="cuentas-page__total-label">Balance total</span>
          <span className="cuentas-page__total-value">{formatCurrency(balanceTotal)}</span>
        </div>
      </div>
      <div className="cuentas-page__grid">
        {cuentas.map((cuenta) => (
          <CuentaCard
            key={cuenta.id}
            cuenta={cuenta}
            movements={movementsMap?.[cuenta.id] ?? []}
          />
        ))}
      </div>
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

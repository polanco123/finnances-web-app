'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Cuenta } from '@/data/cuenta'
import {
  crearRegistroPago,
  fetchDeudaAccounts,
  fetchPagosDelAnio,
  marcarPagado,
  updateMontoPlaneado,
  updateNotas,
  updatePeriodo,
  type DeudaPago,
} from '@/components/deudas/deudas-service'
import DeudaMonthTabs from '@/components/deudas/deuda-month-tabs'
import DeudaPaymentTable, { type DeudaMonthRow } from '@/components/deudas/deuda-payment-table'
import './page.css'

const CURRENT_YEAR = new Date().getFullYear()

/** Extracts the 0-indexed month from an ISO `YYYY-MM-DD` string without constructing a `Date` (avoids TZ pitfalls). */
function monthIndexFromISODate(iso: string): number {
  return Number(iso.slice(5, 7)) - 1
}

export default function DeudasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [pagos, setPagos] = useState<DeudaPago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth())

  useEffect(() => {
    async function load() {
      try {
        const [accounts, pagosDelAnio] = await Promise.all([
          fetchDeudaAccounts(),
          fetchPagosDelAnio(CURRENT_YEAR),
        ])
        setCuentas(accounts)
        setPagos(pagosDelAnio)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar las cuentas de deuda')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  /** Insert-or-replace by row `id` in the flat year-list — every `deuda_pago` mutation returns the affected row. */
  function patchPago(updated: DeudaPago) {
    setPagos((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }

  async function handleCrear(cuentaId: string, periodo: string, monto: number) {
    patchPago(await crearRegistroPago(cuentaId, periodo, monto))
  }

  async function handleSaveMonto(id: string, monto: number) {
    patchPago(await updateMontoPlaneado(id, monto))
  }

  async function handleSavePeriodo(id: string, periodo: string) {
    patchPago(await updatePeriodo(id, periodo))
  }

  async function handleSaveNotas(id: string, notas: string | null) {
    patchPago(await updateNotas(id, notas))
  }

  async function handleMarcarPagado(id: string, montoPagado: number) {
    patchPago(await marcarPagado(id, montoPagado))
  }

  /**
   * Account × month row matrix for the selected month tab: every active
   * `tipo='deuda'` account gets a row. If a `deuda_pago` record's `periodo`
   * falls in the selected month, it's matched by `cuentaId`; otherwise the
   * row's `pago` is `null` ("sin registrar" for that account+month).
   *
   * If an account somehow has 2+ records within the same month (not
   * prevented by the DB's `UNIQUE (cuenta_id, periodo)`, which is exact-date,
   * not per-month), the latest one (by `periodo` ascending order from
   * `fetchPagosDelAnio`) wins, since later entries overwrite earlier ones in
   * the Map below.
   */
  const rows: DeudaMonthRow[] = useMemo(() => {
    if (!cuentas) return []

    const pagoPorCuenta = new Map<string, DeudaPago>()
    for (const pago of pagos) {
      if (monthIndexFromISODate(pago.periodo) === selectedMonth) {
        pagoPorCuenta.set(pago.cuentaId, pago)
      }
    }

    return cuentas.map((cuenta) => ({ cuenta, pago: pagoPorCuenta.get(cuenta.id) ?? null }))
  }, [cuentas, pagos, selectedMonth])

  let body: React.ReactNode
  if (loading) {
    body = <div className="deudas-page__loading">Cargando cuentas de deuda...</div>
  } else if (error) {
    body = <div className="deudas-page__error">{error}</div>
  } else {
    body = (
      <DeudaPaymentTable
        rows={rows}
        year={CURRENT_YEAR}
        month={selectedMonth}
        onCrear={handleCrear}
        onSaveMonto={handleSaveMonto}
        onSavePeriodo={handleSavePeriodo}
        onSaveNotas={handleSaveNotas}
        onMarcarPagado={handleMarcarPagado}
      />
    )
  }

  return (
    <div className="deudas-page">
      <div className="deudas-page__header">
        <h1 className="deudas-page__title">Deudas</h1>
      </div>
      {!loading && !error && <DeudaMonthTabs selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />}
      {body}
    </div>
  )
}

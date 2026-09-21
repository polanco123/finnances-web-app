'use client'

import { Suspense, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import MovementFab from '@/components/movement/movement-fab'
import DiversionBudgetHint from '@/components/diversion/diversion-budget-hint'
import MovementListItem from '@/components/movement/movement-list-item'
import MovementTransferCard from '@/components/movement/movement-transfer-card'
import { groupMovimientos } from '@/components/movement/movement-grouping'
import type { DisplayItem } from '@/components/movement/movement-grouping'
import {
  fetchMovimientosPage,
  type Movimiento,
} from '@/components/movement/movement-service'
import {
  fetchRecentMovimientos,
  fetchTransferSiblings,
  type Cuenta,
} from '@/components/cuentas/cuentas-service'
import type { CategoriaConGasto } from '@/components/categorias/categorias-service'
import { getTodayLocalDate, startOfMonth } from '@/components/patrimonio/patrimonio-dates'
import {
  fetchDashboardData,
  fetchResumenMes,
  type PuntoTendencia,
  type ResumenCategorias,
} from '@/components/dashboard/dashboard-service'
import './page.css'

const CHART_COLORS: Record<'light' | 'dark', { primary: string; accent: string }> = {
  light: { primary: '#1976d2', accent: '#ff6f00' },
  dark:  { primary: '#42a5f5', accent: '#ffa726' },
}

const MOVIMIENTOS_LIMIT = 10

const TODAS_LAS_CUENTAS = 'all'

// ── Helpers ───────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function fechaHoraKey(movimiento: Movimiento): string {
  return `${movimiento.fecha}T${movimiento.hora ?? '00:00:00'}`
}

/**
 * Loads the latest movimientos for the current account scope, already grouped
 * into display items.
 *
 * With a specific account, that account's own rows only ever carry ITS side of
 * a transfer (matching `cuenta_id`), so the paired legs are fetched by
 * `transferencia_id` and merged in before grouping — same treatment as
 * `app/(app)/cuentas/page.tsx`.
 */
async function recentMovimientos(cuentaId: string): Promise<DisplayItem[]> {
  if (cuentaId === TODAS_LAS_CUENTAS) {
    const page = await fetchMovimientosPage(null, MOVIMIENTOS_LIMIT)
    return groupMovimientos(page.movimientos)
  }

  const own = await fetchRecentMovimientos(cuentaId, MOVIMIENTOS_LIMIT)

  const transferIds = new Set<string>()
  for (const m of own) {
    if (m.es_transferencia && m.transferencia_id) transferIds.add(m.transferencia_id)
  }

  const siblings = await fetchTransferSiblings(Array.from(transferIds))
  const siblingsByTransferId = new Map<string, Movimiento[]>()
  for (const sibling of siblings) {
    if (!sibling.transferencia_id) continue
    const existing = siblingsByTransferId.get(sibling.transferencia_id)
    if (existing) existing.push(sibling)
    else siblingsByTransferId.set(sibling.transferencia_id, [sibling])
  }

  const ownIds = new Set(own.map((m) => m.id))
  const extra: Movimiento[] = []
  for (const m of own) {
    if (!m.es_transferencia || !m.transferencia_id) continue
    for (const pairRow of siblingsByTransferId.get(m.transferencia_id) ?? []) {
      if (!ownIds.has(pairRow.id) && !extra.some((e) => e.id === pairRow.id)) {
        extra.push(pairRow)
      }
    }
  }

  const merged = extra.length > 0 ? [...own, ...extra] : own
  const sorted = [...merged].sort((a, b) => fechaHoraKey(b).localeCompare(fechaHoraKey(a)))

  return groupMovimientos(sorted)
}

// ── Components ────────────────────────────────────────

interface BalanceCardProps {
  balance: number
  ingresos: number
  gastos: number
  neto: number
  cuentaLabel: string
  mesLabel: string
}

function BalanceCard({ balance, ingresos, gastos, neto, cuentaLabel, mesLabel }: BalanceCardProps) {
  return (
    <div className="dash-card balance-card dash-card--full">
      <p className="dash-card__title">Balance general</p>
      <p className="balance-card__amount">{formatCurrency(balance)}</p>
      <p className="balance-card__label">
        {cuentaLabel}
        {' · '}
        {mesLabel}
      </p>
      <div className="balance-card__meta">
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Ingresos</span>
          <span className="balance-card__stat-value balance-card__stat-value--positive">
            +{formatCurrency(ingresos)}
          </span>
        </div>
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Gastos</span>
          <span className="balance-card__stat-value balance-card__stat-value--negative">
            -{formatCurrency(gastos)}
          </span>
        </div>
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Neto</span>
          <span className={`balance-card__stat-value ${neto >= 0 ? 'balance-card__stat-value--positive' : 'balance-card__stat-value--negative'}`}>
            {formatCurrency(neto)}
          </span>
        </div>
      </div>
    </div>
  )
}

interface MovementsListProps {
  items: DisplayItem[]
}

function MovementsList({ items }: MovementsListProps) {
  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Últimos movimientos</h3>
      </div>
      <div className="movements-list">
        {items.length === 0 ? (
          <p className="dashboard__empty">Sin movimientos</p>
        ) : (
          items.map((item: DisplayItem) =>
            item.kind === 'merged-transfer' ? (
              <MovementTransferCard
                key={`merged-${item.transferenciaId}`}
                origen={item.origen}
                destino={item.destino}
              />
            ) : (
              <MovementListItem key={item.data.id} movimiento={item.data} />
            ),
          )
        )}
      </div>
    </div>
  )
}

interface CategoryBarsProps {
  categorias: CategoriaConGasto[]
  colors: { primary: string; accent: string }
}

function CategoryBars({ categorias, colors }: CategoryBarsProps) {
  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Top categorías — gasto</h3>
      </div>
      {categorias.length === 0 ? (
        <p className="dashboard__empty">Sin gastos este mes</p>
      ) : (
        <div className="dash-chart">
          <ResponsiveContainer width="100%" height={categorias.length * 40 + 20}>
            <BarChart data={categorias} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={130}
                tick={{ fontSize: 13, fill: 'var(--theme-text-primary)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), 'Gasto']}
                contentStyle={{
                  background: 'var(--theme-bg-surface)',
                  border: '1px solid var(--theme-border-default)',
                  borderRadius: 'var(--theme-radius-md)',
                  fontSize: '0.875rem',
                }}
              />
              <Bar dataKey="total" fill={colors.accent} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

interface AccountCardsProps {
  cuentas: Cuenta[]
  cuentaId: string
  onCuentaChange: (id: string) => void
}

function AccountCards({ cuentas, cuentaId, onCuentaChange }: AccountCardsProps) {
  return (
    <div className="dash-card dash-card--full">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Cuentas</h3>
      </div>
      <div className="account-cards">
        {cuentas.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`account-pill ${cuentaId === c.id ? 'account-pill--active' : ''}`}
            onClick={() => onCuentaChange(c.id === cuentaId ? TODAS_LAS_CUENTAS : c.id)}
          >
            <span className="account-pill__name">{c.nombre}</span>
            <span
              className={`account-pill__balance ${
                c.saldo_calculado > 0
                  ? 'account-pill__balance--positive'
                  : c.saldo_calculado < 0
                    ? 'account-pill__balance--negative'
                    : 'account-pill__balance--zero'
              }`}
            >
              {formatCurrency(c.saldo_calculado)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface MonthlySummaryProps {
  resumen: ResumenCategorias
}

function MonthlySummary({ resumen }: MonthlySummaryProps) {
  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Resumen mensual</h3>
      </div>
      <div className="summary-row">
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-color-error)' }}>{formatCurrency(resumen.totalGastado)}</p>
          <p className="summary-stat__label">Total gastos</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-text-secondary)' }}>{formatCurrency(resumen.compromisos)}</p>
          <p className="summary-stat__label">Compromisos</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-color-accent)' }}>{formatCurrency(resumen.discrecionales)}</p>
          <p className="summary-stat__label">Discrecionales</p>
        </div>
      </div>
    </div>
  )
}

interface TrendChartProps {
  tendencia: PuntoTendencia[]
  colors: { primary: string; accent: string }
}

function TrendChart({ tendencia, colors }: TrendChartProps) {
  return (
    <div className="dash-card dash-card--full">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Tendencia mensual</h3>
      </div>
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={tendencia} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="etiqueta"
              tick={{ fontSize: 12, fill: 'var(--theme-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--theme-border-default)' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--theme-text-secondary)' }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), 'Total']}
              contentStyle={{
                background: 'var(--theme-bg-surface)',
                border: '1px solid var(--theme-border-default)',
                borderRadius: 'var(--theme-radius-md)',
                fontSize: '0.875rem',
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────

interface GlobalData {
  netWorth: number
  cuentas: Cuenta[]
  categorias: CategoriaConGasto[]
  resumenMes: ResumenCategorias
  tendencia: PuntoTendencia[]
}

interface ScopedData {
  balance: number
  ingresos: number
  gastos: number
  neto: number
  movimientos: DisplayItem[]
}

function DashboardContent() {
  const [globalData, setGlobalData] = useState<GlobalData | null>(null)
  const [scopedData, setScopedData] = useState<ScopedData | null>(null)
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(TODAS_LAS_CUENTAS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [hintRefreshToken, setHintRefreshToken] = useState(0)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const today = getTodayLocalDate()
  const anio = today.getFullYear()
  const mes = today.getMonth() + 1

  useEffect(() => {
    async function load() {
      try {
        setGlobalData(await fetchDashboardData())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // `globalData` is a dependency, not just a guard: the scoped slice needs the
  // account catalog and the net worth to resolve its balance, so it can only
  // run once the global load has landed.
  useEffect(() => {
    if (!globalData) return

    let cancelled = false

    async function load(data: GlobalData) {
      const cuentaId = cuentaSeleccionada

      try {
        const [resumen, movimientos] = await Promise.all([
          fetchResumenMes(anio, mes, cuentaId === TODAS_LAS_CUENTAS ? undefined : cuentaId),
          recentMovimientos(cuentaId),
        ])

        // A slower earlier request must not overwrite a newer selection.
        if (cancelled) return

        const balance =
          cuentaId === TODAS_LAS_CUENTAS
            ? data.netWorth
            : data.cuentas.find((c) => c.id === cuentaId)?.saldo_calculado ?? 0

        setScopedData({ balance, ...resumen, movimientos })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
      }
    }

    load(globalData)

    return () => {
      cancelled = true
    }
  }, [cuentaSeleccionada, globalData, anio, mes])

  const colors = mounted
    ? CHART_COLORS[resolvedTheme === 'dark' ? 'dark' : 'light']
    : CHART_COLORS.light

  const fechaLabel = today.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const mesLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
    .format(startOfMonth(today))

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">Cargando dashboard...</div>
      </div>
    )
  }

  if (error || !globalData) {
    return (
      <div className="dashboard">
        <div className="dashboard__empty">{error ?? 'Error al cargar el dashboard'}</div>
      </div>
    )
  }

  const cuentaLabel =
    cuentaSeleccionada === TODAS_LAS_CUENTAS
      ? 'Todas las cuentas'
      : globalData.cuentas.find((c) => c.id === cuentaSeleccionada)?.nombre ?? 'Todas las cuentas'

  return (
    <div className="dashboard">
      <div className="dashboard__container">
        <header className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
          <span className="dashboard__date">{fechaLabel}</span>
        </header>

        <div className="dashboard__grid">
          <DiversionBudgetHint refreshToken={hintRefreshToken} />

          {scopedData ? (
            <BalanceCard
              balance={scopedData.balance}
              ingresos={scopedData.ingresos}
              gastos={scopedData.gastos}
              neto={scopedData.neto}
              cuentaLabel={cuentaLabel}
              mesLabel={mesLabel}
            />
          ) : (
            <div className="dash-card balance-card dash-card--full">
              <p className="dash-card__title">Balance general</p>
              <p className="dashboard__empty">Cargando...</p>
            </div>
          )}

          <div className="dash-card">
            <div className="dash-card__header">
              <h3 className="dash-card__title">Cuenta</h3>
            </div>
            <select
              className="filter-select"
              value={cuentaSeleccionada}
              onChange={(e) => setCuentaSeleccionada(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value={TODAS_LAS_CUENTAS}>Todas las cuentas</option>
              {globalData.cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <MonthlySummary resumen={globalData.resumenMes} />

          <CategoryBars categorias={globalData.categorias} colors={colors} />

          <TrendChart tendencia={globalData.tendencia} colors={colors} />

          {scopedData ? (
            <MovementsList items={scopedData.movimientos} />
          ) : (
            <div className="dash-card">
              <div className="dash-card__header">
                <h3 className="dash-card__title">Últimos movimientos</h3>
              </div>
              <p className="dashboard__empty">Cargando movimientos...</p>
            </div>
          )}

          <AccountCards
            cuentas={globalData.cuentas}
            cuentaId={cuentaSeleccionada}
            onCuentaChange={setCuentaSeleccionada}
          />
        </div>
      </div>

      <MovementFab />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="dashboard"><div className="dashboard__loading">Cargando dashboard...</div></div>}>
      <DashboardContent />
    </Suspense>
  )
}

'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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
import './page.css'

// ── Mock Data ─────────────────────────────────────────

interface MockMovimiento {
  id: string
  descripcion: string
  monto: number
  tipo: 'ingreso' | 'gasto' | 'transferencia'
  categoria: string
  cuenta: string
  fecha: string
}

interface MockCategoria {
  nombre: string
  total: number
  tipo: string
}

interface MockCuenta {
  id: string
  nombre: string
  saldo: number
  tipo: string
}

const MESES = [
  { value: '2026-07', label: 'Julio 2026' },
  { value: '2026-06', label: 'Junio 2026' },
  { value: '2026-05', label: 'Mayo 2026' },
  { value: '2026-04', label: 'Abril 2026' },
]

const MOCK_CUENTAS: MockCuenta[] = [
  { id: 'all', nombre: 'Todas las cuentas', saldo: 0, tipo: 'todas' },
  { id: 'efectivo', nombre: 'Efectivo', saldo: 500, tipo: 'efectivo' },
  { id: 'bbva-debito', nombre: 'BBVA débito', saldo: 420, tipo: 'ingreso' },
  { id: 'klar', nombre: 'Klar', saldo: 1702, tipo: 'ingreso' },
  { id: 'nu-apartados', nombre: 'Nu Apartados', saldo: 26347, tipo: 'ingreso' },
  { id: 'klar-tdc', nombre: 'Klar TDC', saldo: 0, tipo: 'deuda' },
  { id: 'banamex-tdc', nombre: 'Banamex TDC Oro', saldo: -3047, tipo: 'deuda' },
  { id: 'didi-card', nombre: 'Didi Card', saldo: -9568, tipo: 'deuda' },
  { id: 'invex-tdc', nombre: 'Invex TDC', saldo: -20155, tipo: 'deuda' },
  { id: 'banamex-prestamo', nombre: 'Banamex Préstamo', saldo: -33008, tipo: 'deuda' },
  { id: 'gbm', nombre: 'GBM', saldo: 27381, tipo: 'retiro' },
  { id: 'fintual', nombre: 'Fintual PPR', saldo: 42204, tipo: 'retiro' },
  { id: 'afore', nombre: 'Afore', saldo: 164168, tipo: 'retiro' },
]

const MOCK_MOVIMIENTOS: MockMovimiento[] = [
  { id: '1', descripcion: 'Renta departamento', monto: -8500, tipo: 'gasto', categoria: 'Renta', cuenta: 'BBVA débito', fecha: '2026-07-01' },
  { id: '2', descripcion: 'Sueldo quincenal', monto: 18500, tipo: 'ingreso', categoria: 'Sueldo', cuenta: 'Nu Apartados', fecha: '2026-07-01' },
  { id: '3', descripcion: 'Despensa supermercado', monto: -2340, tipo: 'gasto', categoria: 'Despensa', cuenta: 'Klar', fecha: '2026-07-03' },
  { id: '4', descripcion: 'Netflix suscripción', monto: -199, tipo: 'gasto', categoria: 'Netflix', cuenta: 'Klar TDC', fecha: '2026-07-04' },
  { id: '5', descripcion: 'Gasolina gasolinera', monto: -1200, tipo: 'gasto', categoria: 'Gasolina', cuenta: 'Didi Card', fecha: '2026-07-05' },
  { id: '6', descripcion: 'Transferencia a GBM', monto: -5000, tipo: 'transferencia', categoria: 'Transferencia', cuenta: 'BBVA débito', fecha: '2026-07-05' },
  { id: '7', descripcion: 'Restaurante familiar', monto: -890, tipo: 'gasto', categoria: 'Restaurante', cuenta: 'Klar TDC', fecha: '2026-07-06' },
  { id: '8', descripcion: 'Spotify', monto: -169, tipo: 'gasto', categoria: 'Spotify', cuenta: 'Klar', fecha: '2026-07-07' },
  { id: '9', descripcion: 'Pago recibido freelance', monto: 4500, tipo: 'ingreso', categoria: 'Ventas', cuenta: 'Klar', fecha: '2026-07-07' },
  { id: '10', descripcion: 'Luz electricidad', monto: -680, tipo: 'gasto', categoria: 'Luz', cuenta: 'BBVA débito', fecha: '2026-07-08' },
]

const MOCK_CATEGORIAS_JUL: MockCategoria[] = [
  { nombre: 'Renta', total: 8500, tipo: 'compromiso' },
  { nombre: 'Despensa', total: 2340, tipo: 'compromiso' },
  { nombre: 'Gasolina', total: 1200, tipo: 'compromiso' },
  { nombre: 'Restaurante', total: 890, tipo: 'discrecional' },
  { nombre: 'Luz', total: 680, tipo: 'compromiso' },
  { nombre: 'Netflix', total: 199, tipo: 'suscripcion' },
  { nombre: 'Spotify', total: 169, tipo: 'suscripcion' },
  { nombre: 'Internet', total: 499, tipo: 'compromiso' },
]

const MOCK_CATEGORIAS_JUN: MockCategoria[] = [
  { nombre: 'Renta', total: 8500, tipo: 'compromiso' },
  { nombre: 'Despensa', total: 3120, tipo: 'compromiso' },
  { nombre: 'Coche', total: 2800, tipo: 'compromiso' },
  { nombre: 'Hotel / Viaje', total: 4200, tipo: 'discrecional' },
  { nombre: 'Restaurante', total: 1650, tipo: 'discrecional' },
  { nombre: 'Gasolina', total: 1400, tipo: 'compromiso' },
  { nombre: 'Luz', total: 720, tipo: 'compromiso' },
  { nombre: 'Ropa', total: 1890, tipo: 'discrecional' },
]

const MOCK_CATEGORIAS_MAY: MockCategoria[] = [
  { nombre: 'Renta', total: 8500, tipo: 'compromiso' },
  { nombre: 'Salud', total: 3500, tipo: 'compromiso' },
  { nombre: 'Despensa', total: 2890, tipo: 'compromiso' },
  { nombre: 'Educación', total: 2200, tipo: 'compromiso' },
  { nombre: 'Gasolina', total: 1100, tipo: 'compromiso' },
  { nombre: 'Comida / Bebidas', total: 980, tipo: 'discrecional' },
  { nombre: 'Luz', total: 650, tipo: 'compromiso' },
  { nombre: 'Internet', total: 499, tipo: 'compromiso' },
]

const MOCK_CATEGORIAS_ABR: MockCategoria[] = [
  { nombre: 'Renta', total: 8500, tipo: 'compromiso' },
  { nombre: 'Despensa', total: 2670, tipo: 'compromiso' },
  { nombre: 'Gasolina', total: 1350, tipo: 'compromiso' },
  { nombre: 'Préstamo / Crédito', total: 5000, tipo: 'compromiso' },
  { nombre: 'Restaurante', total: 1120, tipo: 'discrecional' },
  { nombre: 'Luz', total: 580, tipo: 'compromiso' },
  { nombre: 'Diversión personal', total: 1500, tipo: 'discrecional' },
  { nombre: 'Mascotas', total: 850, tipo: 'compromiso' },
]

const CATEGORIAS_MAP: Record<string, MockCategoria[]> = {
  '2026-07': MOCK_CATEGORIAS_JUL,
  '2026-06': MOCK_CATEGORIAS_JUN,
  '2026-05': MOCK_CATEGORIAS_MAY,
  '2026-04': MOCK_CATEGORIAS_ABR,
}

const CHART_COLORS: Record<'light' | 'dark', { primary: string; accent: string }> = {
  light: { primary: '#1976d2', accent: '#ff6f00' },
  dark:  { primary: '#42a5f5', accent: '#ffa726' },
}

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function getMonthLabel(value: string): string {
  const m = MESES.find((x) => x.value === value)
  return m ? m.label : value
}

const ICON_MAP: Record<string, string> = {
  Renta: '🏠',
  Despensa: '🛒',
  Gasolina: '⛽',
  Restaurante: '🍽️',
  Luz: '💡',
  Netflix: '🎬',
  Spotify: '🎵',
  Internet: '🌐',
  Coche: '🚗',
  'Hotel / Viaje': '✈️',
  Ropa: '👕',
  Salud: '🏥',
  Educación: '📚',
  'Comida / Bebidas': '🍔',
  'Préstamo / Crédito': '💳',
  'Diversión personal': '🎮',
  Mascotas: '🐾',
  Sueldo: '💼',
  Ventas: '💰',
  Transferencia: '↔️',
}

function getIcon(nombre: string): string {
  return ICON_MAP[nombre] || '📋'
}

// ── Components ────────────────────────────────────────

function BalanceCard({ cuentaId, meses }: { cuentaId: string; meses: string }) {
  const saldo = useMemo(() => {
    if (cuentaId === 'all') {
      return MOCK_CUENTAS.filter((c) => c.id !== 'all').reduce((sum, c) => sum + c.saldo, 0)
    }
    const c = MOCK_CUENTAS.find((x) => x.id === cuentaId)
    return c ? c.saldo : 0
  }, [cuentaId])

  const totalIngresos = MOCK_MOVIMIENTOS.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalGastos = MOCK_MOVIMIENTOS.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Math.abs(m.monto), 0)

  return (
    <div className="dash-card balance-card dash-card--full">
      <p className="dash-card__title">Balance general</p>
      <p className="balance-card__amount">{formatCurrency(saldo)}</p>
      <p className="balance-card__label">
        {cuentaId === 'all' ? 'Todas las cuentas' : MOCK_CUENTAS.find((c) => c.id === cuentaId)?.nombre}
        {' · '}
        {getMonthLabel(meses)}
      </p>
      <div className="balance-card__meta">
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Ingresos</span>
          <span className="balance-card__stat-value balance-card__stat-value--positive">
            +{formatCurrency(totalIngresos)}
          </span>
        </div>
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Gastos</span>
          <span className="balance-card__stat-value balance-card__stat-value--negative">
            -{formatCurrency(totalGastos)}
          </span>
        </div>
        <div className="balance-card__stat">
          <span className="balance-card__stat-label">Neto</span>
          <span className={`balance-card__stat-value ${totalIngresos - totalGastos >= 0 ? 'balance-card__stat-value--positive' : 'balance-card__stat-value--negative'}`}>
            {formatCurrency(totalIngresos - totalGastos)}
          </span>
        </div>
      </div>
    </div>
  )
}

function MovementsList() {
  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Últimos movimientos</h3>
      </div>
      <div className="movements-list">
        {MOCK_MOVIMIENTOS.map((m) => (
          <div key={m.id} className="movement-row">
            <div className={`movement-row__icon movement-row__icon--${m.tipo === 'gasto' ? 'expense' : m.tipo}`}>
              {getIcon(m.categoria)}
            </div>
            <div className="movement-row__info">
              <p className="movement-row__desc">{m.descripcion}</p>
              <p className="movement-row__category">{m.categoria} · {m.cuenta}</p>
            </div>
            <span className={`movement-row__amount movement-row__amount--${m.tipo === 'gasto' ? 'expense' : m.tipo}`}>
              {m.tipo === 'ingreso' ? '+' : ''}{formatCurrency(m.monto)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryBars({ meses, colors }: { meses: string; colors: { primary: string; accent: string } }) {
  const categorias = CATEGORIAS_MAP[meses] || MOCK_CATEGORIAS_JUL
  const chartData = [...categorias].sort((a, b) => b.total - a.total)

  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Top categorías — gasto</h3>
      </div>
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height={chartData.length * 40 + 20}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
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
    </div>
  )
}

function AccountCards({ cuentaId, onCuentaChange }: { cuentaId: string; onCuentaChange: (id: string) => void }) {
  const cuentas = MOCK_CUENTAS.filter((c) => c.id !== 'all')

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
            onClick={() => onCuentaChange(c.id === cuentaId ? 'all' : c.id)}
          >
            <span className="account-pill__name">{c.nombre}</span>
            <span
              className={`account-pill__balance ${
                c.saldo > 0 ? 'account-pill__balance--positive' : c.saldo < 0 ? 'account-pill__balance--negative' : 'account-pill__balance--zero'
              }`}
            >
              {formatCurrency(c.saldo)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MonthlySummary({ meses }: { meses: string }) {
  const categorias = CATEGORIAS_MAP[meses] || MOCK_CATEGORIAS_JUL
  const totalGastado = categorias.reduce((s, c) => s + c.total, 0)
  const compromisos = categorias.filter((c) => c.tipo === 'compromiso').reduce((s, c) => s + c.total, 0)
  const discrecionales = categorias.filter((c) => c.tipo === 'discrecional' || c.tipo === 'suscripcion').reduce((s, c) => s + c.total, 0)

  return (
    <div className="dash-card">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Resumen mensual</h3>
      </div>
      <div className="summary-row">
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-color-error)' }}>{formatCurrency(totalGastado)}</p>
          <p className="summary-stat__label">Total gastos</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-text-secondary)' }}>{formatCurrency(compromisos)}</p>
          <p className="summary-stat__label">Compromisos</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat__value" style={{ color: 'var(--theme-color-accent)' }}>{formatCurrency(discrecionales)}</p>
          <p className="summary-stat__label">Discrecionales</p>
        </div>
      </div>
    </div>
  )
}

function TrendChart({ colors }: { colors: { primary: string; accent: string } }) {
  const trendData = [...MESES].reverse().map((m) => ({
    mesLabel: m.label,
    total: (CATEGORIAS_MAP[m.value] ?? []).reduce((s, c) => s + c.total, 0),
  }))

  return (
    <div className="dash-card dash-card--full">
      <div className="dash-card__header">
        <h3 className="dash-card__title">Tendencia mensual</h3>
      </div>
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trendData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="mesLabel"
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

function DashboardContent() {
  const [mesSeleccionado, setMesSeleccionado] = useState('2026-07')
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('all')
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const colors = mounted
    ? CHART_COLORS[resolvedTheme === 'dark' ? 'dark' : 'light']
    : CHART_COLORS.light

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="dashboard">
      <div className="dashboard__container">
        <header className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
          <span className="dashboard__date">{today}</span>
        </header>

        <div className="dashboard__grid">
          <BalanceCard cuentaId={cuentaSeleccionada} meses={mesSeleccionado} />

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
              {MOCK_CUENTAS.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="dash-card">
            <div className="dash-card__header">
              <h3 className="dash-card__title">Período</h3>
            </div>
            <select
              className="filter-select"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              style={{ width: '100%' }}
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <MonthlySummary meses={mesSeleccionado} />

          <CategoryBars meses={mesSeleccionado} colors={colors} />

          <TrendChart colors={colors} />

          <MovementsList />

          <AccountCards cuentaId={cuentaSeleccionada} onCuentaChange={setCuentaSeleccionada} />
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

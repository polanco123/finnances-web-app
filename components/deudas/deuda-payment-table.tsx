'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Cuenta } from '@/data/cuenta'
import { computePeriodoParaMes, type DeudaPago } from '@/components/deudas/deudas-service'
import DeudaMarcarPagadoModal from '@/components/deudas/deuda-marcar-pagado-modal'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import './deuda-payment-table.css'

export interface DeudaMonthRow {
  cuenta: Cuenta
  /** The account's record whose `periodo` falls in the selected month, or `null` if none exists yet. */
  pago: DeudaPago | null
}

interface DeudaPaymentTableProps {
  rows: DeudaMonthRow[]
  /** Full year of the currently selected month tab, e.g. 2026. */
  year: number
  /** 0-indexed month of the currently selected tab. */
  month: number
  onCrear: (cuentaId: string, periodo: string, monto: number) => Promise<void>
  onSaveMonto: (id: string, monto: number) => Promise<void>
  onSavePeriodo: (id: string, periodo: string) => Promise<void>
  onSaveNotas: (id: string, notas: string | null) => Promise<void>
  onMarcarPagado: (id: string, montoPagado: number) => Promise<void>
}

/** The row's 4-value state, derived from `(pago, cuenta.dia_pago)` — same model the retired card view used. */
type RowState = 'bloqueado' | 'sin-registrar' | 'pendiente' | 'pagado'

function getEstado(pago: DeudaPago | null, diaPagoConfigured: boolean): RowState {
  if (!pago) return diaPagoConfigured ? 'sin-registrar' : 'bloqueado'
  return pago.pagado ? 'pagado' : 'pendiente'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Read-only "Corte: N · Pago: N" text — "—" when both are null. */
function formatDiasInfo(cuenta: Cuenta): string {
  const { dia_corte, dia_pago } = cuenta
  if (dia_corte == null && dia_pago == null) return '—'
  const parts: string[] = []
  if (dia_corte != null) parts.push(`Corte: ${dia_corte}`)
  if (dia_pago != null) parts.push(`Pago: ${dia_pago}`)
  return parts.join(' · ')
}

/** Parses a `YYYY-MM-DD` string as a local date (avoids UTC-shift-by-one-day bugs from `new Date(iso)`). */
function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatPeriodoCorto(periodo: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseISODateLocal(periodo),
  )
}

interface DeudaPaidCheckboxProps {
  checked: boolean
  disabled: boolean
  onClick: () => void
}

/**
 * Styled square checkbox for the "Pagado" column — bordered, fills with
 * `--theme-color-success` and shows a `lucide-react` checkmark when checked.
 * Disabled (non-clickable) for `sin-registrar`/`bloqueado` rows (no record to
 * mark paid yet) and for already-`pagado` rows (read-only history).
 */
function DeudaPaidCheckbox({ checked, disabled, onClick }: DeudaPaidCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Pagado' : 'Marcar como pagado'}
      className={`deuda-payment-table__checkbox ${checked ? 'deuda-payment-table__checkbox--checked' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {checked && <Check size={14} strokeWidth={3} aria-hidden="true" />}
    </button>
  )
}

interface DeudaPaymentTableRowProps {
  cuenta: Cuenta
  pago: DeudaPago | null
  year: number
  month: number
  onCrear: (cuentaId: string, periodo: string, monto: number) => Promise<void>
  onSaveMonto: (id: string, monto: number) => Promise<void>
  onSavePeriodo: (id: string, periodo: string) => Promise<void>
  onSaveNotas: (id: string, notas: string | null) => Promise<void>
  onMarcarPagado: (id: string, montoPagado: number) => Promise<void>
}

/**
 * One table row = one account for the currently selected month. Rendered
 * with a `key` of `${cuenta.id}-${month}` by the parent table, so switching
 * month tabs remounts the row and resets any in-progress draft edits.
 */
function DeudaPaymentTableRow({
  cuenta,
  pago,
  year,
  month,
  onCrear,
  onSaveMonto,
  onSavePeriodo,
  onSaveNotas,
  onMarcarPagado,
}: DeudaPaymentTableRowProps) {
  const diaPagoConfigured = cuenta.dia_pago !== null && cuenta.dia_pago !== undefined
  const estado = getEstado(pago, diaPagoConfigured)
  const CuentaIcon = resolveIcon(cuenta.icono, 'cuenta')
  const periodoDefault = diaPagoConfigured
    ? computePeriodoParaMes(cuenta.dia_pago as number, year, month)
    : null

  // --- "Registrar pago" (state === 'sin-registrar') ---
  const [crearPeriodo, setCrearPeriodo] = useState(periodoDefault ?? '')
  const [crearMonto, setCrearMonto] = useState('')
  const [creando, setCreando] = useState(false)
  const [crearError, setCrearError] = useState<string | null>(null)

  async function handleCrear() {
    if (!crearPeriodo) {
      setCrearError('Selecciona una fecha')
      return
    }
    const monto = Number(crearMonto)
    if (isNaN(monto) || monto <= 0) {
      setCrearError('Monto inválido')
      return
    }
    setCreando(true)
    setCrearError(null)
    try {
      await onCrear(cuenta.id, crearPeriodo, monto)
    } catch {
      setCrearError('Error al registrar el pago')
    } finally {
      setCreando(false)
    }
  }

  // --- Editable monto_planeado (state === 'pendiente') ---
  const [montoValue, setMontoValue] = useState(pago?.montoPlaneado?.toString() ?? '')
  const [savingMonto, setSavingMonto] = useState(false)
  const [montoError, setMontoError] = useState<string | null>(null)

  async function handleBlurMonto() {
    if (!pago) return
    const parsed = Number(montoValue)
    if (isNaN(parsed) || parsed <= 0) {
      setMontoError('Monto inválido')
      setMontoValue(pago.montoPlaneado.toString())
      return
    }
    if (parsed === pago.montoPlaneado) return

    setSavingMonto(true)
    setMontoError(null)
    try {
      await onSaveMonto(pago.id, parsed)
    } catch {
      setMontoError('Error al guardar')
      setMontoValue(pago.montoPlaneado.toString())
    } finally {
      setSavingMonto(false)
    }
  }

  // --- Editable periodo (state === 'pendiente') ---
  const [periodoValue, setPeriodoValue] = useState(pago?.periodo ?? '')
  const [savingPeriodo, setSavingPeriodo] = useState(false)
  const [periodoError, setPeriodoError] = useState<string | null>(null)

  async function handleBlurPeriodo() {
    if (!pago) return
    if (!periodoValue || periodoValue === pago.periodo) {
      setPeriodoValue(pago.periodo)
      return
    }

    setSavingPeriodo(true)
    setPeriodoError(null)
    try {
      await onSavePeriodo(pago.id, periodoValue)
    } catch (err) {
      setPeriodoError(
        err instanceof Error ? err.message : 'Error al actualizar. ¿Ya existe un registro para esa fecha?',
      )
      setPeriodoValue(pago.periodo)
    } finally {
      setSavingPeriodo(false)
    }
  }

  // --- Editable notas (any state where a record exists) ---
  const [notasValue, setNotasValue] = useState(pago?.notas ?? '')
  const [savingNotas, setSavingNotas] = useState(false)

  async function handleBlurNotas() {
    if (!pago) return
    const trimmed = notasValue.trim()
    const normalized = trimmed === '' ? null : trimmed
    if (normalized === (pago.notas ?? null)) return

    setSavingNotas(true)
    try {
      await onSaveNotas(pago.id, normalized)
    } catch {
      setNotasValue(pago.notas ?? '')
    } finally {
      setSavingNotas(false)
    }
  }

  // --- "Marcar pagado" (state === 'pendiente') ---
  const [marcando, setMarcando] = useState(false)
  const [showMarcarModal, setShowMarcarModal] = useState(false)

  function handleTogglePagado() {
    if (!pago || pago.pagado || marcando) return
    setShowMarcarModal(true)
  }

  async function handleConfirmMarcarPagado(monto: number) {
    if (!pago) return
    setMarcando(true)
    try {
      await onMarcarPagado(pago.id, monto)
      setShowMarcarModal(false)
    } finally {
      setMarcando(false)
    }
  }

  return (
    <tr className="deuda-payment-table__row">
      <td className="deuda-payment-table__cell deuda-payment-table__cell--cuenta">
        <span className="deuda-payment-table__nombre">
          <CuentaIcon size={14} className="deuda-payment-table__icon" />
          {cuenta.nombre}
        </span>
        {estado === 'bloqueado' && (
          <span className="deuda-payment-table__badge deuda-payment-table__badge--bloqueado">
            Sin día de pago
          </span>
        )}
      </td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--dias">{formatDiasInfo(cuenta)}</td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--periodo">
        {estado === 'pendiente' && pago ? (
          <>
            <input
              type="date"
              className="deuda-payment-table__date-input"
              value={periodoValue}
              onChange={(e) => {
                setPeriodoValue(e.target.value)
                setPeriodoError(null)
              }}
              onBlur={handleBlurPeriodo}
              disabled={savingPeriodo}
              aria-label={`Periodo de ${cuenta.nombre}`}
            />
            {periodoError && <span className="deuda-payment-table__error">{periodoError}</span>}
          </>
        ) : estado === 'sin-registrar' ? (
          <input
            type="date"
            className="deuda-payment-table__date-input"
            value={crearPeriodo}
            onChange={(e) => {
              setCrearPeriodo(e.target.value)
              setCrearError(null)
            }}
            disabled={creando}
            aria-label={`Periodo a registrar para ${cuenta.nombre}`}
          />
        ) : estado === 'pagado' && pago ? (
          <span className="deuda-payment-table__readonly">{formatPeriodoCorto(pago.periodo)}</span>
        ) : (
          <span className="deuda-payment-table__dash">—</span>
        )}
      </td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--monto-planeado">
        {estado === 'pendiente' && pago ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              className={`deuda-payment-table__number-input ${montoError ? 'deuda-payment-table__number-input--error' : ''}`}
              value={montoValue}
              onChange={(e) => {
                setMontoValue(e.target.value)
                setMontoError(null)
              }}
              onBlur={handleBlurMonto}
              disabled={savingMonto}
              aria-label={`Monto planeado de ${cuenta.nombre}`}
            />
            {montoError && <span className="deuda-payment-table__error">{montoError}</span>}
          </>
        ) : estado === 'sin-registrar' ? (
          <div className="deuda-payment-table__create-group">
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              className={`deuda-payment-table__number-input ${crearError ? 'deuda-payment-table__number-input--error' : ''}`}
              value={crearMonto}
              onChange={(e) => {
                setCrearMonto(e.target.value)
                setCrearError(null)
              }}
              placeholder="Monto"
              disabled={creando}
              aria-label={`Monto planeado a registrar para ${cuenta.nombre}`}
            />
            <button
              type="button"
              className="deuda-payment-table__create-btn"
              onClick={handleCrear}
              disabled={creando}
            >
              {creando ? '...' : 'Registrar'}
            </button>
            {crearError && <span className="deuda-payment-table__error">{crearError}</span>}
          </div>
        ) : estado === 'pagado' && pago ? (
          <span className="deuda-payment-table__readonly">{formatCurrency(pago.montoPlaneado)}</span>
        ) : (
          <span className="deuda-payment-table__dash">—</span>
        )}
      </td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--monto-pagado">
        {estado === 'pagado' && pago?.montoPagado != null ? (
          <span className="deuda-payment-table__readonly deuda-payment-table__readonly--paid">
            {formatCurrency(pago.montoPagado)}
          </span>
        ) : (
          <span className="deuda-payment-table__dash">—</span>
        )}
      </td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--notas">
        {pago ? (
          <input
            type="text"
            className="deuda-payment-table__notas-input"
            value={notasValue}
            onChange={(e) => setNotasValue(e.target.value)}
            onBlur={handleBlurNotas}
            disabled={savingNotas}
            placeholder="Notas"
            aria-label={`Notas de ${cuenta.nombre}`}
          />
        ) : (
          <span className="deuda-payment-table__dash">—</span>
        )}
      </td>

      <td className="deuda-payment-table__cell deuda-payment-table__cell--pagado">
        <DeudaPaidCheckbox
          checked={estado === 'pagado'}
          disabled={estado !== 'pendiente' || marcando}
          onClick={handleTogglePagado}
        />
        {showMarcarModal && pago && (
          <DeudaMarcarPagadoModal
            cuentaNombre={cuenta.nombre}
            montoPlaneado={pago.montoPlaneado}
            onConfirm={handleConfirmMarcarPagado}
            onCancel={() => setShowMarcarModal(false)}
          />
        )}
      </td>
    </tr>
  )
}

/**
 * The `/deudas` month-tab table: one row per active `tipo='deuda'` account
 * for the currently selected month, plus a totals row summing
 * `monto_planeado` (all rows with a record) and `monto_pagado` (only rows
 * marked paid) for that month.
 */
export default function DeudaPaymentTable({
  rows,
  year,
  month,
  onCrear,
  onSaveMonto,
  onSavePeriodo,
  onSaveNotas,
  onMarcarPagado,
}: DeudaPaymentTableProps) {
  const totalPlaneado = rows.reduce((sum, r) => sum + (r.pago?.montoPlaneado ?? 0), 0)
  const totalPagado = rows.reduce(
    (sum, r) => sum + (r.pago?.pagado ? r.pago.montoPagado ?? 0 : 0),
    0,
  )

  if (rows.length === 0) {
    return <div className="deuda-payment-table__empty">No hay cuentas de tipo deuda</div>
  }

  return (
    <div className="deuda-payment-table__wrapper">
      <table className="deuda-payment-table">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Corte / Pago</th>
            <th>Periodo</th>
            <th>Monto planeado</th>
            <th>Monto pagado</th>
            <th>Notas</th>
            <th>Pagado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cuenta, pago }) => (
            <DeudaPaymentTableRow
              key={`${cuenta.id}-${month}`}
              cuenta={cuenta}
              pago={pago}
              year={year}
              month={month}
              onCrear={onCrear}
              onSaveMonto={onSaveMonto}
              onSavePeriodo={onSavePeriodo}
              onSaveNotas={onSaveNotas}
              onMarcarPagado={onMarcarPagado}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="deuda-payment-table__totals-row">
            <td colSpan={3} className="deuda-payment-table__totals-label">
              Totales del mes
            </td>
            <td className="deuda-payment-table__totals-value">{formatCurrency(totalPlaneado)}</td>
            <td className="deuda-payment-table__totals-value">{formatCurrency(totalPagado)}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

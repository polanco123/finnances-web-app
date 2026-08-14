'use client'

import './deuda-month-tabs.css'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

interface DeudaMonthTabsProps {
  /** 0-indexed selected month (0 = Enero, 11 = Diciembre). */
  selectedMonth: number
  onSelectMonth: (month: number) => void
}

/**
 * 12-tab selector for the current calendar year (no year switcher yet — the
 * year is fixed by the caller). Clicking a tab notifies the parent, which
 * re-filters the payment table to that month.
 */
export default function DeudaMonthTabs({ selectedMonth, onSelectMonth }: DeudaMonthTabsProps) {
  return (
    <div className="deuda-month-tabs" role="tablist" aria-label="Selector de mes">
      {MESES.map((mes, index) => {
        const active = index === selectedMonth
        return (
          <button
            key={mes}
            type="button"
            role="tab"
            aria-selected={active}
            className={`deuda-month-tabs__tab ${active ? 'deuda-month-tabs__tab--active' : ''}`}
            onClick={() => onSelectMonth(index)}
          >
            {mes}
          </button>
        )
      })}
    </div>
  )
}

'use client'

import './diversion-daily-allowance.css'

interface DiversionDailyAllowanceProps {
  amount: number // dailyAllowance; may be negative, unclamped
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function DiversionDailyAllowance({
  amount,
}: DiversionDailyAllowanceProps) {
  return (
    <div className="diversion-daily-allowance">
      <span className="diversion-daily-allowance__label">
        Disponible por día
      </span>
      <span className="diversion-daily-allowance__amount">
        {formatCurrency(amount)}/día
      </span>
    </div>
  )
}

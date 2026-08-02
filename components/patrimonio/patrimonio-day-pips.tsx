'use client'

import './patrimonio-day-pips.css'

interface PatrimonioDayPipsProps {
  totalDays: number
  daysElapsed: number
}

/**
 * Renders `totalDays` day-pips. Pips at index `< daysElapsed` are "filled"
 * (elapsed); the last filled pip (`index === daysElapsed - 1`) additionally
 * gets the `--today` modifier for its amber styling; pips past `daysElapsed`
 * stay unfilled/future (gray).
 */
export default function PatrimonioDayPips({ totalDays, daysElapsed }: PatrimonioDayPipsProps) {
  const pips = Array.from({ length: totalDays }, (_, i) => ({
    filled: i < daysElapsed,
    isToday: i === daysElapsed - 1,
  }))

  return (
    <div className="patrimonio-day-pips">
      {pips.map((pip, i) => (
        <span
          key={i}
          className={[
            'patrimonio-day-pips__pip',
            pip.filled ? 'patrimonio-day-pips__pip--filled' : '',
            pip.isToday ? 'patrimonio-day-pips__pip--today' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  )
}

'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, TrendingDown, TrendingUp, ArrowRightLeft } from 'lucide-react'
import './movement-fab.css'

const HOLD_MS = 1000

/**
 * Floating shortcut to `/movimientos`. A short tap goes straight to a new
 * gasto with the monto input focused. Holding the button for ~1s reveals two
 * more options (ingreso, transferencia) stacked above it — release then tap
 * one to go straight to that tipo with monto focused, same as the short-tap
 * gasto shortcut.
 */
export default function MovementFab() {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [holding, setHolding] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback(
    (tipo: 'gasto' | 'ingreso' | 'transferencia') => {
      setExpanded(false)
      router.push(`/movimientos?tipo=${tipo}`)
    },
    [router],
  )

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const handlePointerDown = () => {
    longPressFiredRef.current = false
    setHolding(true)
    holdTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setHolding(false)
      setExpanded(true)
    }, HOLD_MS)
  }

  const handlePointerUp = () => {
    setHolding(false)
    clearHoldTimer()
    if (!longPressFiredRef.current) {
      goTo('gasto')
    }
  }

  const handlePointerLeave = () => {
    setHolding(false)
    clearHoldTimer()
  }

  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  useEffect(() => clearHoldTimer, [])

  return (
    <div className="movement-fab" ref={wrapperRef}>
      {expanded && (
        <div className="movement-fab__options">
          <button
            type="button"
            className="movement-fab__option movement-fab__option--ingreso"
            onClick={() => goTo('ingreso')}
            aria-label="Nuevo ingreso"
          >
            <TrendingUp size={18} aria-hidden="true" />
            <span className="movement-fab__option-label">Ingreso</span>
          </button>
          <button
            type="button"
            className="movement-fab__option movement-fab__option--transferencia"
            onClick={() => goTo('transferencia')}
            aria-label="Nueva transferencia"
          >
            <ArrowRightLeft size={18} aria-hidden="true" />
            <span className="movement-fab__option-label">Transferencia</span>
          </button>
        </div>
      )}

      <button
        type="button"
        className={`movement-fab__main${holding ? ' movement-fab__main--holding' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Nuevo gasto (mantén presionado para más opciones)"
        title="Nuevo gasto — mantén presionado para más opciones"
      >
        {expanded ? <TrendingDown size={22} aria-hidden="true" /> : <ArrowLeftRight size={22} aria-hidden="true" />}
      </button>
    </div>
  )
}

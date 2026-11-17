'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const UNDO_WINDOW_MS = 6000

export interface ActiveUndo {
  label: string
}

export interface UseUndoAction {
  start(label: string, undo: () => Promise<void>): void
  run(): Promise<void>
  pause(): void
  resume(): void
  active: ActiveUndo | null
}

/**
 * Single-slot undo with an expiry timer. Starting a new undo replaces the
 * current one (the earlier action is already committed and becomes final).
 */
export function useUndoAction(windowMs: number = UNDO_WINDOW_MS): UseUndoAction {
  const [active, setActive] = useState<ActiveUndo | null>(null)
  const undoRef = useRef<(() => Promise<void>) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAtRef = useRef(0)
  const remainingRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    undoRef.current = null
    setActive(null)
  }, [clearTimer])

  const arm = useCallback(
    (ms: number) => {
      clearTimer()
      startedAtRef.current = Date.now()
      remainingRef.current = ms
      timerRef.current = setTimeout(dismiss, ms)
    },
    [clearTimer, dismiss],
  )

  const start = useCallback(
    (label: string, undo: () => Promise<void>) => {
      undoRef.current = undo
      setActive({ label })
      arm(windowMs)
    },
    [arm, windowMs],
  )

  const run = useCallback(async () => {
    const undo = undoRef.current
    if (!undo) return
    dismiss()
    await undo()
  }, [dismiss])

  const pause = useCallback(() => {
    if (timerRef.current === null) return
    clearTimer()
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
  }, [clearTimer])

  const resume = useCallback(() => {
    if (!undoRef.current || timerRef.current !== null) return
    arm(remainingRef.current)
  }, [arm])

  useEffect(() => clearTimer, [clearTimer])

  return { start, run, pause, resume, active }
}

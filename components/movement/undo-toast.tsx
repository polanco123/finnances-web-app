'use client'

import './undo-toast.css'

interface UndoToastProps {
  label: string
  onUndo: () => void
  onPause: () => void
  onResume: () => void
}

export default function UndoToast({ label, onUndo, onPause, onResume }: UndoToastProps) {
  return (
    <div
      className="undo-toast"
      role="status"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <span className="undo-toast__label">{label}</span>
      <button type="button" className="undo-toast__action" onClick={onUndo}>
        Deshacer
      </button>
    </div>
  )
}

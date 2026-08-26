'use client'

import { useState } from 'react'
import { ICON_CATALOG, ICON_GROUPS } from '@/lib/catalogs/icon-catalog'
import { ICON_COLORS, ICON_COLOR_DEFAULT_SWATCH } from '@/lib/catalogs/icon-colors'
import './icon-picker.css'

export interface IconPickerProps {
  icono: string | null
  color?: string | null
  kind: 'cuenta' | 'categoria'
  onSelect: (iconName: string) => Promise<void>
  onSelectColor: (color: string | null) => Promise<void>
}

/**
 * Stateless (aside from its own per-button pending indicator) themed grid of
 * curated icon choices, plus a color swatch row. Renders `ICON_GROUPS` as
 * labeled sections; each button resolves its own icon via `ICON_CATALOG`.
 * Emits via `onSelect`/`onSelectColor` only — no internal Supabase call, no
 * global submitting flag, matching the callback-only convention of
 * `meta-form.tsx`/`meta-abono-form.tsx`.
 */
export default function IconPicker({ icono, color, kind, onSelect, onSelectColor }: IconPickerProps) {
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingColor, setPendingColor] = useState(false)

  const handleSelect = async (name: string) => {
    if (pendingName) return
    setPendingName(name)
    try {
      await onSelect(name)
    } finally {
      setPendingName(null)
    }
  }

  const handleSelectColor = async (value: string | null) => {
    if (pendingColor) return
    setPendingColor(true)
    try {
      await onSelectColor(value)
    } finally {
      setPendingColor(false)
    }
  }

  return (
    <div className="icon-picker" data-kind={kind}>
      <div className="icon-picker__group">
        <span className="icon-picker__group-label">Color</span>
        <div className="icon-picker__color-grid">
          {ICON_COLORS.map((option) => {
            const isSelected = (color ?? null) === option.value
            return (
              <button
                key={option.name}
                type="button"
                title={option.name}
                aria-label={option.name}
                aria-pressed={isSelected}
                disabled={pendingColor}
                className={`icon-picker__color-btn${isSelected ? ' icon-picker__color-btn--selected' : ''}`}
                style={{ background: option.value ?? ICON_COLOR_DEFAULT_SWATCH }}
                onClick={() => handleSelectColor(option.value)}
              />
            )
          })}
        </div>
      </div>

      {Object.entries(ICON_GROUPS).map(([groupName, names]) => (
        <div key={groupName} className="icon-picker__group">
          <span className="icon-picker__group-label">{groupName}</span>
          <div className="icon-picker__grid">
            {names.map((name) => {
              const Icon = ICON_CATALOG[name]
              const isSelected = name === icono
              const isPending = name === pendingName
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={isSelected}
                  disabled={isPending}
                  className={`icon-picker__btn${isSelected ? ' icon-picker__btn--selected' : ''}${
                    isPending ? ' icon-picker__btn--pending' : ''
                  }`}
                  onClick={() => handleSelect(name)}
                >
                  <Icon size={18} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

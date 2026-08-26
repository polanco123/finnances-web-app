'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import { resolveIconColor } from '@/lib/catalogs/icon-colors'
import type { AutocompleteOption } from './autocomplete-input'
import './catalog-picker-popup.css'

export interface CatalogPickerPopupProps {
  options: AutocompleteOption[]
  value: string
  kind: 'cuenta' | 'categoria'
  label: string
  onSelect: (id: string) => void
  onClose: () => void
  /** When provided, a "Crear <nombre>" action appears once the search has
   * zero matches, letting the user register a new catalog item inline. */
  onCreate?: (nombre: string) => Promise<AutocompleteOption>
}

/**
 * Full popup icon-grid picker for `AutocompleteInput`. Owns all History API
 * back-button integration: `onClose` is only ever invoked from the
 * `popstate` listener — every UI-triggered close (X, backdrop, Escape,
 * option select) routes through `requestClose()` (`history.back()`) so a
 * real device back-button press never silently consumes an orphaned entry.
 */
export default function CatalogPickerPopup({
  options,
  value,
  kind,
  label,
  onSelect,
  onClose,
  onCreate,
}: CatalogPickerPopupProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [shake, setShake] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // No-op on mobile: the search input is `display: none` there, and a
    // hidden element is not focusable, so `.focus()` silently does nothing.
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    history.pushState({ catalogPicker: true }, '')

    function handlePopState() {
      onClose()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function requestClose() {
    history.back()
  }

  function handleOptionClick(id: string) {
    onSelect(id)
    requestClose()
  }

  async function handleCreate() {
    const nombre = searchTerm.trim()
    if (!nombre || !onCreate) return

    setCreating(true)
    setCreateError(null)
    try {
      const created = await onCreate(nombre)
      handleOptionClick(created.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear')
      setCreating(false)
    }
  }

  const filtered =
    searchTerm.trim() === ''
      ? options
      : options.filter((o) =>
          o.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        )

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    if (filtered.length === 1) {
      handleOptionClick(filtered[0].id)
      return
    }

    if (filtered.length === 0 && onCreate) {
      handleCreate()
      return
    }

    // Zero matches with no create option, or multiple matches — Enter can't
    // unambiguously pick one; give a brief shake + red-flash cue instead of
    // silently doing nothing.
    setShake(true)
  }

  const catalogLabel = kind === 'cuenta' ? 'cuentas' : 'categorías'

  return (
    <div className="catalog-picker__overlay" onClick={requestClose}>
      <div
        className="catalog-picker__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catalog-picker__header">
          <h2 id="catalog-picker-title" className="catalog-picker__title">
            {label}
          </h2>
          <button
            type="button"
            className="catalog-picker__close"
            onClick={requestClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <input
          ref={searchInputRef}
          type="text"
          className={`catalog-picker__search${shake ? ' catalog-picker__search--shake' : ''}`}
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onAnimationEnd={() => setShake(false)}
          autoComplete="off"
        />

        <div className="catalog-picker__grid-wrapper">
          {options.length === 0 ? (
            <p className="catalog-picker__empty">
              No hay {catalogLabel} disponibles
            </p>
          ) : filtered.length === 0 ? (
            <div className="catalog-picker__empty-state">
              <p className="catalog-picker__empty">
                Sin resultados para &ldquo;{searchTerm}&rdquo;
              </p>
              {onCreate && (
                <button
                  type="button"
                  className="catalog-picker__create-btn"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  <Plus size={16} aria-hidden="true" />
                  {creating ? 'Creando...' : `Crear "${searchTerm.trim()}"`}
                </button>
              )}
              {createError && <p className="catalog-picker__create-error">{createError}</p>}
            </div>
          ) : (
            <div className="catalog-picker__grid">
              {filtered.map((option) => {
                const OptionIcon = resolveIcon(option.icono, kind)
                const isSelected = option.id === value
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`catalog-picker__tile${
                      isSelected ? ' catalog-picker__tile--selected' : ''
                    }`}
                    onClick={() => handleOptionClick(option.id)}
                    aria-pressed={isSelected}
                  >
                    <OptionIcon
                      size={26}
                      aria-hidden="true"
                      style={{ color: resolveIconColor(option.color) }}
                    />
                    <span className="catalog-picker__tile-label">
                      {option.nombre}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

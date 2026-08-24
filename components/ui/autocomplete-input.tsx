'use client'

import { useState, useRef, useEffect } from 'react'
import { resolveIcon } from '@/lib/catalogs/icon-catalog'
import './autocomplete-input.css'

export interface AutocompleteOption {
  id: string
  nombre: string
  icono?: string | null
}

export interface AutocompleteInputProps {
  label: string
  options: AutocompleteOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  kind: 'cuenta' | 'categoria'
}

export function AutocompleteInput({
  label,
  options,
  value,
  onChange,
  placeholder,
  kind,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((o) => o.id === value)

  useEffect(() => {
    if (selectedOption && !showOptions) {
      setInputValue(selectedOption.nombre)
    }
  }, [selectedOption, showOptions])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowOptions(false)
        if (selectedOption) setInputValue(selectedOption.nombre)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption])

  const filtered =
    inputValue.trim() === ''
      ? options
      : options.filter((o) =>
          o.nombre.toLowerCase().includes(inputValue.toLowerCase())
        )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setShowOptions(true)
    setHighlightIndex(-1)
  }

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option.id)
    setInputValue(option.nombre)
    setShowOptions(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showOptions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowOptions(false)
      if (selectedOption) setInputValue(selectedOption.nombre)
    }
  }

  return (
    <div className="movement-form__group">
      <label className="movement-form__label">{label}</label>
      <div className="autocomplete-input" ref={wrapperRef}>
        <input
          ref={inputRef}
          className="movement-form__input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowOptions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Escribir para buscar...'}
          autoComplete="off"
        />
        {showOptions && filtered.length > 0 && (
          <ul className="autocomplete-input__list">
            {filtered.map((option, index) => {
              const OptionIcon = resolveIcon(option.icono, kind)
              return (
                <li
                  key={option.id}
                  className={`autocomplete-input__item ${
                    index === highlightIndex
                      ? 'autocomplete-input__item--highlighted'
                      : ''
                  } ${
                    option.id === value
                      ? 'autocomplete-input__item--selected'
                      : ''
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  <OptionIcon size={14} className="autocomplete-input__item-icon" />
                  {option.nombre}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AutocompleteInput

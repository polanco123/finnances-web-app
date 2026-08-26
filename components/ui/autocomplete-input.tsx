'use client'

import { useState } from 'react'
import CatalogPickerPopup from './catalog-picker-popup'
import './autocomplete-input.css'

export interface AutocompleteOption {
  id: string
  nombre: string
  icono?: string | null
  color?: string | null
}

export interface AutocompleteInputProps {
  label: string
  options: AutocompleteOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  kind: 'cuenta' | 'categoria'
  onCreateOption?: (nombre: string) => Promise<AutocompleteOption>
}

export function AutocompleteInput({
  label,
  options,
  value,
  onChange,
  placeholder,
  kind,
  onCreateOption,
}: AutocompleteInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedOption = options.find((o) => o.id === value)
  const displayValue = pickerOpen ? '' : selectedOption?.nombre ?? ''

  return (
    <div className="movement-form__group">
      <label className="movement-form__label">{label}</label>
      <div className="autocomplete-input">
        <input
          className="movement-form__input"
          type="text"
          value={displayValue}
          onFocus={() => setPickerOpen(true)}
          placeholder={placeholder || 'Seleccionar...'}
          readOnly
          autoComplete="off"
        />
        {pickerOpen && (
          <CatalogPickerPopup
            options={options}
            value={value}
            kind={kind}
            label={label}
            onSelect={onChange}
            onClose={() => setPickerOpen(false)}
            onCreate={onCreateOption}
          />
        )}
      </div>
    </div>
  )
}

export default AutocompleteInput

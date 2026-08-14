'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CUENTAS, CATEGORIAS } from '@/lib/catalogs/catalog-store'
import { parseVoiceCommand, type ParsedMovimiento, VoiceParseError } from './voice-parser'
import { useVoiceRecognition } from './voice-recognition'
import './voice-entry-button.css'

export interface VoiceEntryButtonProps {
  onParsed: (parsed: ParsedMovimiento) => void
}

type Status = 'idle' | 'listening' | 'unsupported' | 'loading-catalogs' | 'error'

const ERROR_TIMEOUT_MS = 2500
const CATALOG_POLL_INTERVAL_MS = 300

function isBrowserUnsupported(): boolean {
  if (typeof window === 'undefined') return true
  return !('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)
}

function catalogsEmpty(): boolean {
  return CUENTAS.length === 0 || CATEGORIAS.length === 0
}

function errorMessageFor(reason: string): string {
  switch (reason) {
    case 'no-trigger-word':
      return 'No se reconoció el comando. Empieza con "Registra..."'
    case 'no-cantidad':
      return 'No se detectó un monto en lo que dijiste.'
    case 'no-speech':
      return 'No se detectó voz. Intenta de nuevo.'
    case 'not-allowed':
      return 'Permiso de micrófono denegado.'
    case 'audio-capture':
      return 'No se encontró micrófono disponible.'
    default:
      return 'No se pudo procesar el comando de voz.'
  }
}

export default function VoiceEntryButton({ onParsed }: VoiceEntryButtonProps) {
  const [status, setStatus] = useState<Status>(() => {
    if (isBrowserUnsupported()) return 'unsupported'
    if (catalogsEmpty()) return 'loading-catalogs'
    return 'idle'
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTranscript = useCallback(
    (transcript: string) => {
      try {
        const parsed = parseVoiceCommand(transcript)
        onParsed(parsed)
        setStatus('idle')
      } catch (err) {
        const reason = err instanceof VoiceParseError ? err.reason : 'unknown'
        setErrorMessage(errorMessageFor(reason))
        setStatus('error')
      }
    },
    [onParsed],
  )

  const handleRecognitionError = useCallback((message: string) => {
    setErrorMessage(errorMessageFor(message))
    setStatus('error')
  }, [])

  const { start, stop } = useVoiceRecognition(handleTranscript, handleRecognitionError)

  // Empty-catalog guard: catalog-store exports plain mutable `let` bindings,
  // not reactive state, so we poll until both catalogs are populated.
  useEffect(() => {
    if (status !== 'loading-catalogs') return
    const interval = setInterval(() => {
      if (!catalogsEmpty()) {
        clearInterval(interval)
        setStatus('idle')
      }
    }, CATALOG_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status])

  // Auto-timeout the error state back to idle.
  useEffect(() => {
    if (status !== 'error') return
    errorTimeoutRef.current = setTimeout(() => {
      setStatus('idle')
      setErrorMessage(null)
    }, ERROR_TIMEOUT_MS)
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    }
  }, [status])

  const handleClick = useCallback(() => {
    if (status === 'unsupported' || status === 'loading-catalogs') return
    if (status === 'listening') {
      stop()
      setStatus('idle')
      return
    }
    if (status === 'idle' || status === 'error') {
      setErrorMessage(null)
      start()
      setStatus('listening')
    }
  }, [status, start, stop])

  const disabled = status === 'unsupported' || status === 'loading-catalogs'
  const title =
    status === 'unsupported'
      ? 'Reconocimiento de voz no disponible en este navegador'
      : status === 'loading-catalogs'
        ? 'Cargando cuentas y categorías...'
        : status === 'error'
          ? errorMessage ?? undefined
          : status === 'listening'
            ? 'Escuchando... toca para cancelar'
            : 'Registrar movimiento por voz'

  return (
    <div className="voice-entry-button__wrapper">
      <button
        type="button"
        className={`voice-entry-button voice-entry-button--${status}`}
        onClick={handleClick}
        disabled={disabled}
        title={title}
        aria-label={title}
      >
        <span className="voice-entry-button__icon" aria-hidden="true">
          🎤
        </span>
      </button>
      {status === 'error' && errorMessage && (
        <span className="voice-entry-button__error">{errorMessage}</span>
      )}
    </div>
  )
}

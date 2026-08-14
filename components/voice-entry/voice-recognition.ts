'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseVoiceRecognitionResult {
  status: 'idle' | 'listening' | 'unsupported'
  start: () => void
  stop: () => void
}

function getSpeechRecognitionCtor(): typeof SpeechRecognition | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export function useVoiceRecognition(
  onTranscript: (transcript: string) => void,
  onError: (message: string) => void,
): UseVoiceRecognitionResult {
  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognitionCtor()
  const [status, setStatus] = useState<'idle' | 'listening' | 'unsupported'>(
    isSupported ? 'idle' : 'unsupported',
  )
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const start = useCallback(() => {
    if (status === 'unsupported') return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setStatus('unsupported')
      return
    }

    const recognition = new Ctor()
    recognition.lang = 'es-MX'
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      recognitionRef.current = null
      setStatus('idle')
      onTranscript(transcript)
    }
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      recognitionRef.current = null
      setStatus('idle')
      onError(event.error)
    }

    recognitionRef.current = recognition
    recognition.start()
    setStatus('listening')
  }, [status, onTranscript, onError])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  return { status, start, stop }
}

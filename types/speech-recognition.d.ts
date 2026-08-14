// Ambient declarations for the Web Speech API surface used by voice-entry.
// Not present in lib.dom.d.ts — see TS issues #37046 / #42311.
// Local declaration file only, no npm dependency.

export {}

declare global {
  interface SpeechRecognitionResultItem {
    transcript: string
  }

  interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionResultItem
  }

  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult
    length: number
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string
  }

  interface SpeechRecognition extends EventTarget {
    lang: string
    start(): void
    stop(): void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  }

  const SpeechRecognition: {
    new (): SpeechRecognition
  }

  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

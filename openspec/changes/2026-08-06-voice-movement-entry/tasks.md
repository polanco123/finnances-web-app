# Tasks: Voice Movement Entry

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-500 (types ~40, voice-parser.ts ~95 verbatim, voice-catalog-match.ts ~20 verbatim, voice-recognition.ts ~60, voice-entry-button.tsx ~120, voice-entry-button.css ~75, movement-form.jsx diff ~30, movimientos/page.tsx diff ~30) |
| 400-line budget risk | High (as single PR) — but naturally splits into two units each under budget |
| Chained PRs recommended | Yes (forecast only — overridden below) |
| Delivery strategy | **size:exception** (user decision, 2026-08-06) |
| Chain strategy | N/A — single PR |

Decision needed before apply: **No — resolved.** The user explicitly accepted `size:exception` and chose to ship this change as **one single PR** covering Phases A-F, rather than splitting into the 2-PR chain suggested by the forecast below. The implementing LLM/session should NOT re-split this into multiple PRs; proceed as one PR/commit series against a single branch.

The phase ordering below (A → B → C → D → E → F) still MUST be respected internally as the implementation/commit sequence — Phase B.3's hand-trace gate in particular must pass before Phase C proceeds, even though they're no longer separate PR boundaries.

### Reference: Forecast's Suggested Work Units (informational only — not used, see decision above)

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Phase A + Phase B — ambient types + pure parser/fuzzy-matcher, hand-traced, zero UI/DOM deps | Independently mergeable; no runtime behavior change until wired in |
| 2 | Phase C + Phase D + Phase E + Phase F — hook, mic UI, `MovementForm` props, page wiring, manual verification | Depends on Phase B's `voice-parser.ts`/`voice-catalog-match.ts` |

## Phase A: Web Speech API Ambient Types

- [x] A.1 Create `types/speech-recognition.d.ts` with minimal ambient declarations for the Web Speech API surface used by this feature (not in `lib.dom.d.ts` — TS issues #37046/#42311): an `interface SpeechRecognition extends EventTarget` with `lang: string`, `start(): void`, `stop(): void`, `onresult: ((event: SpeechRecognitionEvent) => void) | null`, `onerror: ((event: SpeechRecognitionErrorEvent) => void) | null`; an `interface SpeechRecognitionEvent extends Event` exposing `results` (indexable, each result exposing `[0].transcript: string`); an `interface SpeechRecognitionErrorEvent extends Event` with `error: string`; a `declare var SpeechRecognition: { new (): SpeechRecognition }`; and a `Window` interface augmentation (`declare global { interface Window { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition } }`). No npm dependency — local ambient file only.

## Phase B: Voice Parser + Fuzzy Matcher (Core Logic, no DOM deps)

- [x] B.1 Create `components/voice-entry/voice-parser.ts` — copy `parseVoiceCommand()`, `ParsedMovimiento`, `VoiceParseError`, and the constants `TRIGGER_RE`, `TIPO_PATTERNS`, `NOTAS_RE`, `CANTIDAD_WITH_DE_RE`, `CANTIDAD_BARE_RE`, `CUENTA_CATEGORIA_RE`, `CATEGORIA_ONLY_RE`, `ORIGEN_DESTINO_RE`, and `collapse()` **verbatim** from design.md's "Core Parsing Algorithm" code block. Do not re-derive the regexes — transcription errors will silently break disambiguation. Preserve the exact step order (trigger gate → tipo detect/strip → notas extract/strip → cantidad extract/strip → tipo-branch extraction → fuzzy match) — order is load-bearing per design.md's ordering rationale.
- [x] B.2 Create `components/voice-entry/voice-catalog-match.ts` — copy `normalize()` and `matchCatalogItem()` **verbatim** from design.md's "Fuzzy Matching" code block, importing `CatalogItem` from `@/lib/catalogs/catalog-store`. Preserve the shortest-match tie-break logic exactly.
- [x] B.3 Hand-trace all 4 acceptance phrases against your own `parseVoiceCommand()`/`matchCatalogItem()` implementation (not against the design doc's trace — re-derive each step yourself using your copied code) to self-verify no transcription error was introduced: (1) "Registra un gasto de 500 en BBV de gasolina" → `tipo=gasto, cantidad=500, cuenta≈BBV, categoria≈gasolina`; (2) "Registra 20 pesos de diversión y en notas escribe chicles" → `tipo=gasto, cantidad=20, cuentaId=null, categoria≈diversión, notas=chicles`; (3) "Registra una transferencia de 100 de Nu apartados a BBVA" → `tipo=transferencia, cantidad=100, origen≈Nu apartados, destino≈BBVA` (verify step 4 consumes the leading "de" — this is the phrase that breaks if it doesn't); (4) "Registra un ingreso de 5000 en Banamex Débito de Sueldo" → `tipo=ingreso, cantidad=5000, cuenta≈Banamex Débito, categoria≈Sueldo`. Fix and re-trace before proceeding to Phase C if any mismatch.

## Phase C: Speech Recognition Hook + Mic Button UI

- [x] C.1 Create `components/voice-entry/voice-recognition.ts` — `useVoiceRecognition(onTranscript, onError)` implementing `UseVoiceRecognitionResult { status: 'idle' | 'listening' | 'unsupported'; start: () => void; stop: () => void }` per design.md's Interfaces/Contracts. Detect support via `!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)` → `status='unsupported'`. On `start()`, construct `new (window.SpeechRecognition || window.webkitSpeechRecognition)()`, set `recognition.lang = 'es-MX'`, wire `onresult` (extract `event.results[0][0].transcript`, call `onTranscript`) and `onerror` (call `onError` with `event.error`). `stop()` calls `recognition.stop()` and discards any pending transcript. Clean up listeners on unmount.
- [x] C.2 Create `components/voice-entry/voice-entry-button.tsx` — `VoiceEntryButtonProps { onParsed: (parsed: ParsedMovimiento) => void }`. Internal `status: 'idle' | 'listening' | 'unsupported' | 'loading-catalogs' | 'error'` state machine per design.md's "UI Placement, Flow, and Guards": `idle`→click→`listening` (`recognition.start()`); `listening`→click again→`idle` (`recognition.stop()`, transcript discarded); `listening`→`onresult` parses OK→call `onParsed(parseVoiceCommand(transcript))`→`idle`; `listening`→`onresult` throws `VoiceParseError`→`error` (message per `reason`, `no-trigger-word` vs `no-cantidad`)→auto-timeout 2.5s→`idle`; `listening`→browser `onerror`→`error`→auto-timeout 2.5s→`idle`. Guards (button `disabled`, never hidden, with `title` tooltip): unsupported check `!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)` → `title="Reconocimiento de voz no disponible en este navegador"`; empty-catalog check `CUENTAS.length === 0 || CATEGORIAS.length === 0` at mount → `status='loading-catalogs'`, `title="Cargando cuentas y categorías..."`, poll both lengths via a 300ms `setInterval`, flip to `idle` once both non-empty, clear interval on unmount/success. Support check takes priority over the catalog check when both fail.
- [x] C.3 Create `components/voice-entry/voice-entry-button.css` — `--theme-*` token-based styles, `.voice-entry-button--listening` pulse animation, `.dark` variant, matching `cuenta-card.css` conventions.

## Phase D: MovementForm Prop Extension

- [x] D.1 Modify `components/movement/movement-form.jsx` — add 7 optional props to the component signature (`initialTipo`, `initialMonto`, `initialCuentaId`, `initialCategoriaId`, `initialCuentaOrigenId`, `initialCuentaDestinoId`, `initialNotas`) and change the `useState` initializers to fall back to the prop when provided, exactly per design.md's before/after diff: `useState(initialMonto || '')`, `useState(initialCategoriaId || CATEGORIAS[0]?.id || '')`, `useState(initialCuentaId || CUENTAS[0]?.id || '')`, `useState(initialCuentaOrigenId || CUENTAS[0]?.id || '')`, `useState(initialCuentaDestinoId || CUENTAS[1]?.id || '')`, `useState(initialNotas || '')`, `useState(initialTipo || 'gasto')`. `fecha`/`hora` initializers are unchanged. All props default to current behavior when omitted — no other logic in the file changes.

## Phase E: movimientos/page.tsx Wiring

- [x] E.1 Modify `app/(app)/movimientos/page.tsx` — add `voicePrefill` state (`useState<ParsedMovimiento | null>(null)`) and `formKey` state (`useState(0)`); add `handleVoiceParsed` via `useCallback` that calls `setVoicePrefill(parsed)` then `setFormKey((k) => k + 1)`; render `<VoiceEntryButton onParsed={handleVoiceParsed} />` above `<MovementForm>` inside `movimientos-page__container`; add `key={formKey}` to `<MovementForm>` and wire `initialTipo={voicePrefill?.tipo}`, `initialMonto={voicePrefill?.cantidad != null ? String(voicePrefill.cantidad) : undefined}`, `initialCuentaId={voicePrefill?.cuentaId ?? undefined}`, `initialCategoriaId={voicePrefill?.categoriaId ?? undefined}`, `initialCuentaOrigenId={voicePrefill?.cuentaOrigenId ?? undefined}`, `initialCuentaDestinoId={voicePrefill?.cuentaDestinoId ?? undefined}`, `initialNotas={voicePrefill?.notas ?? undefined}` — copy exactly per design.md's composition snippet. Existing `onMovimientoCreado={handleMovimientoCreado}` prop and submit flow are untouched.

## Phase F: Manual Verification (no automated test runner in this project)

- [ ] F.1 Phrase 1 "Registra un gasto de 500 en BBV de gasolina" → `tipo=gasto, cantidad=500, cuenta≈BBV, categoria≈gasolina`; verify via mic in Chrome — **NOT executed (requires live microphone/browser access, not available to the implementing agent)**
- [ ] F.2 Phrase 2 "Registra 20 pesos de diversión y en notas escribe chicles" → `tipo=gasto, cantidad=20, cuentaId=null, categoria≈diversión, notas=chicles`; verify via mic — **NOT executed (requires live microphone/browser access)**
- [ ] F.3 Phrase 3 "Registra una transferencia de 100 de Nu apartados a BBVA" → `tipo=transferencia, cantidad=100, origen≈Nu apartados, destino≈BBVA`; verify via mic — **NOT executed (requires live microphone/browser access)**
- [ ] F.4 Phrase 4 "Registra un ingreso de 5000 en Banamex Débito de Sueldo" → `tipo=ingreso, cantidad=5000, cuenta≈Banamex Débito, categoria≈Sueldo`; verify via mic — **NOT executed (requires live microphone/browser access)**
- [ ] F.5 Fuzzy hit — spoken "BBV" vs catalog "BBVA Débito" resolves via browser-console call to `matchCatalogItem` — **NOT executed (requires live browser console)**
- [ ] F.6 Fuzzy miss — spoken "Banco Inexistente" returns `null`, `unmatchedCuentaText` set, form falls back to `CUENTA_DEFAULT` — **NOT executed (requires live browser console)**
- [ ] F.7 Unsupported browser — open app in Firefox (no `webkitSpeechRecognition`), confirm mic button `disabled` with tooltip — **NOT executed (requires live Firefox instance)**
- [ ] F.8 Empty catalogs — clear `localStorage`, hard reload, click mic within ~200ms; confirm button disabled/loading until catalogs populate — **NOT executed (requires live browser + Supabase-backed catalogs)**
- [ ] F.9 Confirmation edit — after a successful parse, change the cuenta field via `AutocompleteInput` and submit; confirm the inserted row uses the corrected value, not the parsed one — **NOT executed (requires live browser + Supabase insert)**
- [ ] F.10 Cancel flow — click mic, click again before speaking; confirm return to idle, no parse attempted, form untouched — **NOT executed (requires live microphone/browser access)**
- [ ] F.11 Wrong trigger word — "Anota un gasto de 100 en BBVA" → `VoiceParseError('no-trigger-word')`, error state shown, form untouched — **NOT executed via mic; logic hand-verified: `TRIGGER_RE = /^\s*registra\s+/i` does not match "Anota...", so `parseVoiceCommand` throws `VoiceParseError('no-trigger-word')` as expected**
- [x] F.12 Run `npm run lint && npm run build` — zero errors (verified: `npx eslint` on all new/changed TS/TSX files and `npm run build` both pass with zero errors; `movement-form.jsx` shows a pre-existing "file ignored, no matching configuration" ESLint warning unrelated to this change — the repo's only `.jsx` file, not covered by the flat-config glob)

## Why

Today the only way to record a movimiento (gasto/ingreso/transferencia) is the manual `MovementForm` on `/movimientos` — every field typed by hand via dropdowns and a numeric input. That's friction for the common case of logging a small everyday expense in the moment (mid-purchase, in transit, hands busy). This app is now a 100% static export (`output: "export"` in `next.config.ts`, deployed to GitHub Pages, repo public per the `catalog-cache-supabase` change) — there is no server to host a parsing endpoint, and no safe place to keep a secret client-side. An LLM-based voice-to-structured-data parser is therefore architecturally ruled out, not merely disliked: calling a third-party AI API from the browser would leak the API key in the public client bundle. A rule-based/regex parser running entirely client-side has zero external dependencies and nothing to leak, matching the app's existing security posture.

## What Changes

- Add a push-to-talk voice-entry flow using the browser-native `SpeechRecognition`/`webkitSpeechRecognition` API (Spanish locale), triggered by an explicit mic button click — no continuous/always-listening mode.
- Add a rule-based/regex text parser (fully client-side, no AI API) extracting tipo, cantidad, cuenta, categoría, notas (or cuenta_origen/cuenta_destino for transferencias) from the recognized phrase, gated on a required "Registra" trigger prefix.
- Add fuzzy (normalized: lowercase + accent-stripped substring) matching of spoken account/category names against the `CUENTAS`/`CATEGORIAS` catalogs, so "BBV" matches "BBVA débito" and "Nu apartados" matches "Nu Apartados PERSONALES".
- Extend `components/movement/movement-form.jsx` to accept optional initial-value props (tipo/monto/cuenta/categoria/cuentaOrigen/cuentaDestino/notas) so the parsed result pre-populates the existing form for user review and correction before submit — an editable confirmation step, not insert-immediately.
- Reuse `crearMovimiento`/`crearMovimientoTransferencia` (mapper) and `insertarMovimiento`/`insertarTransferencia` (service) as-is for the actual write — no new Supabase logic.

## Non-Goals

- LLM/AI-based parsing of any kind (architecturally ruled out — see Why).
- Voice input in browsers without Web Speech API support — no fallback text-input mode; the mic control simply does not function / shows an unsupported state.
- Editing or deleting existing movimientos via voice — registration only.
- Voice-driven navigation or any voice command beyond movement registration.
- Multi-language support — Spanish only.
- Continuous/always-listening mode — push-to-talk (explicit mic click) only.

## Capabilities

### New Capabilities
- `voice-movement-entry`: Register a gasto/ingreso/transferencia movimiento via voice dictation — Web Speech API capture, "Registra..."-prefixed rule-based parsing with fuzzy account/category matching, editable confirmation via the pre-populated `MovementForm`, and insert through the existing movement pipeline.

### Modified Capabilities
- None. `movement-type-selection` is scoped to the manual form's Gasto/Ingreso toggle UI only and is unaffected; `MovementForm` gains new optional props but its documented toggle behavior is unchanged.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `components/voice-entry/` (new domain, `.ts`/`.tsx`) | New | Mic trigger, `SpeechRecognition` wrapper, regex parser, fuzzy-match helper — follows the newer TS convention (`components/patrimonio/`, `components/categorias/`), not the legacy `.jsx` pattern still used by `movement-form.jsx` itself |
| `components/movement/movement-form.jsx` | Modified | Add optional initial-value props (tipo/monto/cuenta/categoria/cuentaOrigen/cuentaDestino/notas) defaulting to current internal `useState` values when omitted — fully backward compatible |
| Web Speech typings (`types/speech-recognition.d.ts` or `@types/dom-speech-recognition`) | New | `lib.dom.d.ts` lacks Web Speech API types (TS issues #37046, #42311); exact mechanism deferred to design |
| `components/movement/movement-mapper.js`, `components/movement/movement-service.ts` | None | Reused as-is; `crearMovimiento`'s existing fallback to `CUENTA_DEFAULT`/`CATEGORIA_DEFAULT` already covers an unmatched account/category — no new fallback logic needed |
| Mic trigger placement on `/movimientos` (inline vs. modal) | New | Exact placement deferred to design phase |

## Resolved Decisions

1. **No LLM/AI parsing** — rule-based/regex only, 100% client-side. Hard constraint: static export + public repo leaves no safe place for an API key.
2. **Voice input** — browser-native Web Speech API, Spanish locale (exact `es-MX`/`es-ES` string deferred to design). Chrome/Edge only; no fallback text-input mode — unsupported browsers get a disabled/unsupported mic state, not a workaround.
3. **Editable confirmation before insert** — parsed fields are always shown for correction before write. Accepted safety net for the regex parser's fragility, a deliberate tradeoff of rule-based over LLM-based parsing.
4. **Reuse `MovementForm` for confirmation** — extend with optional initial-value props rather than build a second insert UI. One form, one submit path, one place to maintain validation.
5. **Reuse existing insert functions as-is** — `crearMovimiento`/`crearMovimientoTransferencia` + `insertarMovimiento`/`insertarTransferencia`, the only insert path in the app today. The mapper's existing default-fallback behavior means the voice parser needs no "no account/category mentioned" logic of its own — a free win from reusing the pipeline.
6. **Default tipo is "gasto"** when unspecified — matches `MovementForm`'s existing `tipoMovimiento: 'gasto'` default; no new default logic.
7. **Trigger word "Registra"** required at the start of the phrase. Phrases not starting with it are unrecognized — the system SHALL surface an error/no-match state, never silently guess.
8. **Fuzzy cuenta/categoria matching** via a small local normalize (lowercase + accent-strip) + substring-match helper, no new npm dependency. Sufficient given the catalog's small size (~20 cuentas, ~45 categorias); the confirmation step (decision 3) recovers any mismatch.
9. **Empty-catalog race** — `CatalogInit`'s `initCatalogs()` is fire-and-forget, so `CUENTAS`/`CATEGORIAS` can be empty right after a fresh page load. The voice-entry UI SHALL be disabled/show a loading state while either catalog is empty, consistent with the existing `/cuentas`/`/categorias` empty-state pattern — never match against empty catalogs.

## Core Technical Risk

Parsing must disambiguate the overloaded Spanish preposition "de" across cantidad/categoria/transferencia-origen uses. Acceptance-defining test phrases:
1. "Registra un gasto de 500 en BBV de gasolina"
2. "Registra 20 pesos de diversión y en notas escribe chicles"
3. "Registra una transferencia de 100 de Nu apartados a BBVA"
4. "Registra un ingreso de 5000 en Banamex Débito de Sueldo"

The exact disambiguation algorithm is a design-phase decision, not resolved here.

## Rollback Plan

Voice entry is fully additive: a new `components/voice-entry/` module plus optional props on `MovementForm` that default to current behavior when omitted. Reverting means deleting the voice-entry module, the mic trigger UI, and the added `MovementForm` props/typings — the manual form and insert pipeline are untouched and keep working exactly as today.

## Success Criteria

- [ ] All four acceptance phrases parse into correct tipo/cantidad/cuenta/categoria (or origen/destino) fields, pre-populating `MovementForm` for confirmation.
- [ ] Phrases without the "Registra" prefix surface an explicit unrecognized-command state.
- [ ] Mic control is disabled/shows an unsupported state in browsers without Web Speech API support, and disabled/loading while catalogs are empty.
- [ ] No new runtime dependency introduces a client-side secret or external network call for parsing.

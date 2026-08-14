# Design: Voice Movement Entry

## Technical Approach

A new `components/voice-entry/` TS domain (mirrors `components/patrimonio/`, not the legacy `.jsx` pattern) owns three concerns: (1) a pure, dependency-free parser (`voice-parser.ts`) that turns a Spanish transcript into a `ParsedMovimiento`, (2) a pure fuzzy-match helper (`voice-catalog-match.ts`) against `CUENTAS`/`CATEGORIAS`, and (3) a thin `SpeechRecognition` wrapper hook + mic button UI. `MovementForm` (`components/movement/movement-form.jsx`) gains seven optional `initial*` props that seed its existing `useState` initializers — no new insert path, no mapper/service change. The parent `app/(app)/movimientos/page.tsx` owns the bridge: it renders `VoiceEntryButton` above `MovementForm`, and on a successful parse stores the result and bumps a `key` to force `MovementForm` to remount with the new initial values (chosen over prop-sync `useEffect` because `MovementForm`'s state is 100% `useState`-initializer-driven and a remount is one line vs. seven synced effects on a legacy `.jsx` file).

## Core Parsing Algorithm

Pipeline, applied in this exact order (order is load-bearing — see rationale column):

| Step | Action | Why this order |
|---|---|---|
| 1. Trigger gate | `/^\s*registra\s+/i` must match the full transcript; strip it. No match → throw `VoiceParseError('no-trigger-word')`. | Hard fail-fast per proposal decision 7 — never silently guess. |
| 2. Tipo detect + strip | Test `/\btransferencia\b/i`, then `/\bingreso\b/i`, then `/\bgasto\b/i`, in that order; first hit wins, default `'gasto'` if none. Remove the matched keyword **and an optional preceding article** via `new RegExp('\\b(?:(?:un\|una)\\s+)?' + tipo + '\\b', 'i')`. | Must happen before "de"-based extraction below, or the keyword itself (and its article) pollutes later substring captures. |
| 3. Notas extract + strip | `/\s*(?:y\s+)?en\s+notas\s+escribe\s+(.+)$/i`. If matched, capture group 1 as `notas`, then **truncate the working string at the match index** (drop the whole trailing clause). | Must run before cantidad/cuenta/categoria extraction — otherwise "escribe chicles" pollutes those regexes (this is the #1 failure mode if done later). |
| 4. Cantidad extract + strip | Try `/\bde\s+(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i` first (consumes a **leading "de"** together with the number + optional "pesos"); if no match, fall back to `/\b(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i` (bare number, e.g. "20 pesos" with no preceding "de"). No match at all → throw `VoiceParseError('no-cantidad')`. Remove the whole matched substring. | Consuming a leading "de" together with the number is what prevents a leftover bare "de" from colliding with the transferencia origen marker "de" in step 5 (see Trace #3 below). |
| 5. Branch on tipo | **transferencia**: `/\bde\s+(.+?)\s+a\s+(.+)$/i` → group1 = origen text, group2 = destino text. **gasto/ingreso**: try `/\ben\s+(.+?)\s+de\s+(.+)$/i` first → group1 = cuenta text, group2 = categoria text; if no match, fall back to `/\bde\s+(.+)$/i` → group1 = categoria text only, cuenta text stays `null`. | The tipo branch is what disambiguates "de" as origen-marker vs. categoria-marker — the same literal word means different things depending on tipo, so tipo must be known (step 2) before this step runs. |
| 6. Fuzzy match | Run every extracted text (cuenta / categoria / origen / destino) through `matchCatalogItem()` against the relevant catalog. `null` result → id stays `null`, text preserved in `unmatchedCuentaText`/`unmatchedCategoriaText` for UI hinting. | `crearMovimiento`'s existing fallback to `CUENTA_DEFAULT.id`/`CATEGORIA_DEFAULT.id` on falsy input means a `null` id here needs no extra handling downstream. |

```ts
// components/voice-entry/voice-parser.ts
export type Tipo = 'gasto' | 'ingreso' | 'transferencia'

export interface ParsedMovimiento {
  tipo: Tipo
  cantidad: number | null
  cuentaId: string | null
  cuentaOrigenId: string | null
  cuentaDestinoId: string | null
  categoriaId: string | null
  notas: string | null
  unmatchedCuentaText?: string
  unmatchedCategoriaText?: string
}

export class VoiceParseError extends Error {
  constructor(public reason: 'no-trigger-word' | 'no-cantidad') { super(reason) }
}

const TRIGGER_RE = /^\s*registra\s+/i
const TIPO_PATTERNS: Array<{ tipo: Tipo; re: RegExp }> = [
  { tipo: 'transferencia', re: /\btransferencia\b/i },
  { tipo: 'ingreso', re: /\bingreso\b/i },
  { tipo: 'gasto', re: /\bgasto\b/i },
]
const NOTAS_RE = /\s*(?:y\s+)?en\s+notas\s+escribe\s+(.+)$/i
const CANTIDAD_WITH_DE_RE = /\bde\s+(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i
const CANTIDAD_BARE_RE = /\b(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i
const CUENTA_CATEGORIA_RE = /\ben\s+(.+?)\s+de\s+(.+)$/i
const CATEGORIA_ONLY_RE = /\bde\s+(.+)$/i
const ORIGEN_DESTINO_RE = /\bde\s+(.+?)\s+a\s+(.+)$/i

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ')

export function parseVoiceCommand(transcript: string): ParsedMovimiento {
  if (!TRIGGER_RE.test(transcript)) throw new VoiceParseError('no-trigger-word')
  let working = transcript.replace(TRIGGER_RE, '').trim()

  let tipo: Tipo = 'gasto'
  for (const { tipo: t, re } of TIPO_PATTERNS) {
    if (re.test(working)) {
      tipo = t
      working = collapse(working.replace(new RegExp(`\\b(?:(?:un|una)\\s+)?${t}\\b`, 'i'), ''))
      break
    }
  }

  let notas: string | null = null
  const notasMatch = working.match(NOTAS_RE)
  if (notasMatch?.index !== undefined) {
    notas = notasMatch[1].trim()
    working = working.slice(0, notasMatch.index).trim()
  }

  const cantMatch = working.match(CANTIDAD_WITH_DE_RE) ?? working.match(CANTIDAD_BARE_RE)
  if (!cantMatch || cantMatch.index === undefined) throw new VoiceParseError('no-cantidad')
  const cantidad = Number(cantMatch[1])
  working = collapse(working.slice(0, cantMatch.index) + working.slice(cantMatch.index + cantMatch[0].length))

  if (tipo === 'transferencia') {
    const m = working.match(ORIGEN_DESTINO_RE)
    const origenText = m?.[1]?.trim() ?? null
    const destinoText = m?.[2]?.trim() ?? null
    const origen = origenText ? matchCatalogItem(origenText, CUENTAS) : null
    const destino = destinoText ? matchCatalogItem(destinoText, CUENTAS) : null
    return {
      tipo, cantidad, cuentaId: null,
      cuentaOrigenId: origen?.id ?? null,
      cuentaDestinoId: destino?.id ?? null,
      categoriaId: null, notas,
      unmatchedCuentaText: (origenText && !origen) || (destinoText && !destino)
        ? (origenText && !origen ? origenText : destinoText!) : undefined,
    }
  }

  let cuentaText: string | null = null
  let categoriaText: string | null = null
  const both = working.match(CUENTA_CATEGORIA_RE)
  if (both) { cuentaText = both[1].trim(); categoriaText = both[2].trim() }
  else { const c = working.match(CATEGORIA_ONLY_RE); if (c) categoriaText = c[1].trim() }

  const cuenta = cuentaText ? matchCatalogItem(cuentaText, CUENTAS) : null
  const categoria = categoriaText ? matchCatalogItem(categoriaText, CATEGORIAS) : null

  return {
    tipo, cantidad,
    cuentaId: cuenta?.id ?? null,
    cuentaOrigenId: null, cuentaDestinoId: null,
    categoriaId: categoria?.id ?? null,
    notas,
    unmatchedCuentaText: cuentaText && !cuenta ? cuentaText : undefined,
    unmatchedCategoriaText: categoriaText && !categoria ? categoriaText : undefined,
  }
}
```

### Hand trace of all 4 acceptance phrases

**#1 "Registra un gasto de 500 en BBV de gasolina"**
1. Strip trigger → `"un gasto de 500 en BBV de gasolina"`
2. Tipo: `gasto` matches → strip `"un gasto"` → `"de 500 en BBV de gasolina"`
3. Notas: no match → unchanged
4. Cantidad: `CANTIDAD_WITH_DE_RE` matches `"de 500"` → `cantidad=500`, strip → `"en BBV de gasolina"`
5. Branch gasto: `CUENTA_CATEGORIA_RE` matches `"en BBV de gasolina"` → cuentaText=`"BBV"`, categoriaText=`"gasolina"`
6. Fuzzy: `"bbv"` ⊆ `"bbva debito"` → matched; `"gasolina"` → matched
Result: `tipo=gasto, cantidad=500, cuenta≈BBV, categoria≈gasolina` ✅

**#2 "Registra 20 pesos de diversión y en notas escribe chicles"**
1. Strip trigger → `"20 pesos de diversión y en notas escribe chicles"`
2. Tipo: no keyword found → default `gasto`, no strip
3. Notas: matches `"y en notas escribe chicles"` → `notas="chicles"`, truncate → `"20 pesos de diversión"`
4. Cantidad: `CANTIDAD_WITH_DE_RE` fails (no digit after "de"); `CANTIDAD_BARE_RE` matches `"20 pesos"` → `cantidad=20`, strip → `"de diversión"`
5. Branch gasto: `CUENTA_CATEGORIA_RE` fails (no "en"); fallback `CATEGORIA_ONLY_RE` matches `"de diversión"` → categoriaText=`"diversión"`, cuentaText stays `null`
6. Fuzzy: categoria matched; cuenta id stays `null` → `crearMovimiento` fallback fills `CUENTA_DEFAULT.id`
Result: `tipo=gasto, cantidad=20, cuentaId=null, categoria≈diversión, notas=chicles` ✅

**#3 "Registra una transferencia de 100 de Nu apartados a BBVA"**
1. Strip trigger → `"una transferencia de 100 de Nu apartados a BBVA"`
2. Tipo: `transferencia` matches → strip `"una transferencia"` → `"de 100 de Nu apartados a BBVA"`
3. Notas: no match
4. Cantidad: `CANTIDAD_WITH_DE_RE` matches `"de 100"` (the **first** "de", consuming it) → `cantidad=100`, strip → `"de Nu apartados a BBVA"`
5. Branch transferencia: `ORIGEN_DESTINO_RE` on `"de Nu apartados a BBVA"` → matches leading `"de "`, non-greedy group1 up to `" a "` → origenText=`"Nu apartados"`, destinoText=`"BBVA"`
6. Fuzzy: both matched
Result: `tipo=transferencia, cantidad=100, origen≈Nu apartados, destino≈BBVA` ✅ — this is why step 4 must consume the **leading** "de": without it, a leftover bare "de" would sit in front of the transferencia's own "de" marker, producing `origenText="de Nu apartados"`, which fails fuzzy match against catalog "Nu Apartados PERSONALES".

**#4 "Registra un ingreso de 5000 en Banamex Débito de Sueldo"**
1. Strip trigger → `"un ingreso de 5000 en Banamex Débito de Sueldo"`
2. Tipo: `ingreso` matches → strip `"un ingreso"` → `"de 5000 en Banamex Débito de Sueldo"`
3. Notas: no match
4. Cantidad: `CANTIDAD_WITH_DE_RE` matches `"de 5000"` → `cantidad=5000`, strip → `"en Banamex Débito de Sueldo"`
5. Branch ingreso: `CUENTA_CATEGORIA_RE` matches → cuentaText=`"Banamex Débito"`, categoriaText=`"Sueldo"`
6. Fuzzy: both matched
Result: `tipo=ingreso, cantidad=5000, cuenta≈Banamex Débito, categoria≈Sueldo` ✅

## Fuzzy Matching

```ts
// components/voice-entry/voice-catalog-match.ts
import type { CatalogItem } from '@/lib/catalogs/catalog-store'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function matchCatalogItem(spokenText: string, catalog: CatalogItem[]): CatalogItem | null {
  const spoken = normalize(spokenText)
  if (!spoken) return null
  let best: CatalogItem | null = null
  let bestLen = Infinity
  for (const item of catalog) {
    const nombre = normalize(item.nombre)
    if (nombre.includes(spoken) || spoken.includes(nombre)) {
      if (nombre.length < bestLen) { best = item; bestLen = nombre.length }
    }
  }
  return best
}
```

`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` is standard built-in `String.prototype.normalize` — decomposes accented characters into base+combining-mark pairs, then strips the combining-mark Unicode range. No npm package needed. Tie-break: shortest matching `nombre` wins because it is the most specific catalog entry consistent with what was said — e.g. spoken "BBV" containing-matches both "BBVA" and "BBVA Débito Nómina"; picking the shorter "BBVA" avoids guessing a specific sub-account the user didn't mention, and any wrong guess is caught by the mandatory confirmation step anyway (proposal decision 3).

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Notas extracted before cantidad/cuenta/categoria | Regex-and-truncate as step 3, before step 4-5 | Extract notas last | "escribe chicles" would otherwise be captured as part of a cuenta/categoria/destino group — verified by trace #2 |
| Cantidad consumes leading "de" | `CANTIDAD_WITH_DE_RE` tried before bare-number fallback | Always strip bare number only | Prevents a leftover "de" from doubling up with the transferencia origen marker "de" — verified by trace #3 |
| Tipo keyword+article stripped immediately on detection | Regex removes `(un\|una)? + keyword` as soon as tipo is known | Leave keyword in string, ignore it in later regexes | Later regexes are generic (`en...de`, `de...a`) and would otherwise match against "gasto"/"ingreso"/"transferencia" tokens themselves |
| Fuzzy match tie-break | Shortest matching catalog `nombre` wins | First match in catalog array order (unspecified order) | Deterministic and favors the most specific/exact entry; safety net is the mandatory confirmation step regardless |
| SpeechRecognition typings | Local `types/speech-recognition.d.ts` ambient declarations | `@types/dom-speech-recognition` npm package | `package.json` has zero `@types/*` beyond framework-required ones; the Web Speech surface used here is ~15 lines (constructor, `lang`, `start`, `stop`, `onresult`, `onerror`) — not worth a new dependency for a small, stable, non-evolving API |
| `MovementForm` prefill mechanism | Parent remounts via `key={formKey}` bump on new parse | `useEffect` in `MovementForm` syncing state to prop changes | `MovementForm`'s 8 fields are 100% `useState` initializers; a remount is a 1-line change vs. 7 synced effects added to a legacy `.jsx` file the codebase is trying to phase out, not expand |
| Mic button placement | Sibling above `<MovementForm>` in `movimientos/page.tsx`, not injected into the form's title row | Add a slot/child prop to `MovementForm` | Keeps `movement-form.jsx` untouched structurally (only new props); avoids the movement domain importing from the new voice-entry domain |
| Empty-catalog detection | `VoiceEntryButton` polls `CUENTAS.length`/`CATEGORIAS.length` via a 300ms `setInterval` cleared once both are populated | Subscribe to a catalog-store event/observable | `catalog-store.ts` exports `CUENTAS`/`CATEGORIAS` as plain mutable `let` bindings, not reactive state — no event emitter exists to subscribe to; polling is the minimal fix consistent with the existing store's non-reactive design (documented gotcha) |
| Locale | `recognition.lang = 'es-MX'` | `es-ES` | Matches the app's existing `Intl.NumberFormat('es-MX', ...)` convention in `cuentas-card.tsx` and elsewhere — no other locale precedent exists in the codebase |
| New domain language | Fully `.ts`/`.tsx` under `components/voice-entry/` | Match `movement-form.jsx`'s `.jsx` | `AGENTS.md` documents `.jsx` as legacy, confined to `components/movement/`; all newer domains (`patrimonio`, `categorias`, `cuentas`) are already TS |
| Catalog import source | New files import `CUENTAS`/`CATEGORIAS` from `@/lib/catalogs/catalog-store` directly | Import via the legacy `lib/catalogs/cuentas.js`/`categorias.js` re-export chain (what `movement-form.jsx` uses) | New TS domain should depend on the TS-native source, not the legacy re-export shim kept only for the `.jsx` form |

## Data Flow

    [mic click]
         │
         ▼
    VoiceEntryButton (idle → listening)
         │  recognition.start(), lang='es-MX'
         ▼
    browser SpeechRecognition
         │  onresult(transcript) | onerror(e)
         ▼
    voice-parser.parseVoiceCommand(transcript)
         │  throws VoiceParseError('no-trigger-word' | 'no-cantidad') ──▶ error state (2.5s) ──▶ idle
         ▼
    ParsedMovimiento { tipo, cantidad, cuentaId/cuentaOrigenId/cuentaDestinoId, categoriaId, notas }
         │  (ids resolved inside parseVoiceCommand via voice-catalog-match.matchCatalogItem)
         ▼
    movimientos/page.tsx: setVoicePrefill(parsed); setFormKey(k => k+1)
         │
         ▼
    <MovementForm key={formKey} initialTipo=... initialMonto=... .../>  (remounts, useState re-initializes)
         │
         ▼
    user reviews / edits any field (unmatched cuenta/categoria show as CUENTA_DEFAULT/CATEGORIA_DEFAULT
    selection in the autocomplete — user can pick correctly, or leave as-is)
         │  submit (unchanged handleSubmit)
         ▼
    crearMovimiento / crearMovimientoTransferencia ──▶ insertarMovimiento / insertarTransferencia
         │
         ▼
    onMovimientoCreado() ──▶ movimientos list refetches (unchanged)

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `types/speech-recognition.d.ts` | Create | Ambient `SpeechRecognition`/`SpeechRecognitionEvent`/`SpeechRecognitionErrorEvent` declarations + `Window` augmentation for `webkitSpeechRecognition` |
| `components/voice-entry/voice-parser.ts` | Create | `parseVoiceCommand()`, `ParsedMovimiento`, `VoiceParseError` — pure, no DOM/browser deps, independently testable |
| `components/voice-entry/voice-catalog-match.ts` | Create | `normalize()`, `matchCatalogItem()` |
| `components/voice-entry/voice-recognition.ts` | Create | `useVoiceRecognition()` hook: constructs `SpeechRecognition`, wires `onresult`/`onerror`, exposes `start`/`stop`/`status` |
| `components/voice-entry/voice-entry-button.tsx` | Create | Mic button UI, state machine, catalog/support guards, wraps `parseVoiceCommand` + `useVoiceRecognition` |
| `components/voice-entry/voice-entry-button.css` | Create | `--theme-*` token-based styles, `.voice-entry-button--listening` pulse, `.dark` variant, matches `cuenta-card.css` conventions |
| `components/movement/movement-form.jsx` | Modify | Add 7 optional `initial*` props feeding existing `useState` initializers |
| `app/(app)/movimientos/page.tsx` | Modify | Render `<VoiceEntryButton onParsed={...} />` above `<MovementForm>`; add `voicePrefill`/`formKey` state; pass `initial*` props + `key={formKey}` |

## Interfaces / Contracts

```ts
// voice-parser.ts
function parseVoiceCommand(transcript: string): ParsedMovimiento  // throws VoiceParseError

// voice-catalog-match.ts
function matchCatalogItem(spokenText: string, catalog: CatalogItem[]): CatalogItem | null

// voice-recognition.ts
interface UseVoiceRecognitionResult {
  status: 'idle' | 'listening' | 'unsupported'
  start: () => void
  stop: () => void
}
function useVoiceRecognition(
  onTranscript: (transcript: string) => void,
  onError: (message: string) => void,
): UseVoiceRecognitionResult

// voice-entry-button.tsx
interface VoiceEntryButtonProps {
  onParsed: (parsed: ParsedMovimiento) => void
}
// internal state: 'idle' | 'listening' | 'unsupported' | 'loading-catalogs' | 'error'
```

```jsx
// movement-form.jsx — new prop surface (documented via JSDoc in the .jsx file; all optional, all default to current behavior when omitted)
MovementForm({
  onMovimientoCreado,
  initialTipo,          // 'gasto' | 'ingreso' | 'transferencia'
  initialMonto,          // string, e.g. String(cantidad)
  initialCuentaId,
  initialCategoriaId,
  initialCuentaOrigenId,
  initialCuentaDestinoId,
  initialNotas,
})
```

Exact state-initializer diff in `movement-form.jsx`:

Before:
```jsx
export default function MovementForm({ onMovimientoCreado }) {
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(CUENTAS[0]?.id || '')
  const [cuentaOrigenId, setCuentaOrigenId] = useState(CUENTAS[0]?.id || '')
  const [cuentaDestinoId, setCuentaDestinoId] = useState(CUENTAS[1]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState('')
  const [tipoMovimiento, setTipoMovimiento] = useState('gasto')
```

After:
```jsx
export default function MovementForm({
  onMovimientoCreado,
  initialTipo,
  initialMonto,
  initialCuentaId,
  initialCategoriaId,
  initialCuentaOrigenId,
  initialCuentaDestinoId,
  initialNotas,
}) {
  const [monto, setMonto] = useState(initialMonto || '')
  const [categoriaId, setCategoriaId] = useState(initialCategoriaId || CATEGORIAS[0]?.id || '')
  const [cuentaId, setCuentaId] = useState(initialCuentaId || CUENTAS[0]?.id || '')
  const [cuentaOrigenId, setCuentaOrigenId] = useState(initialCuentaOrigenId || CUENTAS[0]?.id || '')
  const [cuentaDestinoId, setCuentaDestinoId] = useState(initialCuentaDestinoId || CUENTAS[1]?.id || '')
  const [fecha, setFecha] = useState(() => toLocalDate(new Date()))
  const [hora, setHora] = useState(() => toLocalTime(new Date()))
  const [notas, setNotas] = useState(initialNotas || '')
  const [tipoMovimiento, setTipoMovimiento] = useState(initialTipo || 'gasto')
```

## UI Placement, Flow, and Guards

`app/(app)/movimientos/page.tsx` composition (inside `movimientos-page__container`, above `<MovementForm>`):

```tsx
const [voicePrefill, setVoicePrefill] = useState<ParsedMovimiento | null>(null)
const [formKey, setFormKey] = useState(0)
const handleVoiceParsed = useCallback((parsed: ParsedMovimiento) => {
  setVoicePrefill(parsed)
  setFormKey((k) => k + 1)
}, [])
// ...
<VoiceEntryButton onParsed={handleVoiceParsed} />
<MovementForm
  key={formKey}
  onMovimientoCreado={handleMovimientoCreado}
  initialTipo={voicePrefill?.tipo}
  initialMonto={voicePrefill?.cantidad != null ? String(voicePrefill.cantidad) : undefined}
  initialCuentaId={voicePrefill?.cuentaId ?? undefined}
  initialCategoriaId={voicePrefill?.categoriaId ?? undefined}
  initialCuentaOrigenId={voicePrefill?.cuentaOrigenId ?? undefined}
  initialCuentaDestinoId={voicePrefill?.cuentaDestinoId ?? undefined}
  initialNotas={voicePrefill?.notas ?? undefined}
/>
```

State machine (`VoiceEntryButton` internal `status`):

- `idle` --click--> `listening` (`recognition.start()`)
- `listening` --click again--> `idle` (`recognition.stop()`, transcript discarded)
- `listening` --`onresult` transcript, parses OK--> `onParsed(parsed)` called, then --> `idle`
- `listening` --`onresult` transcript, `VoiceParseError`--> `error` (message per `reason`) --auto-timeout 2.5s--> `idle`
- `listening` --browser `onerror` (`no-speech`/`not-allowed`/`audio-capture`)--> `error` --auto-timeout 2.5s--> `idle`
- `unsupported` / `loading-catalogs`: computed guard states, button `disabled`, not reachable via click

Guards (both render the button `disabled` rather than hidden — hiding would look like the feature doesn't exist; disabled + `title` tooltip communicates "not yet / not here" without layout shift, consistent with the disabled-`Guardar`-button pattern already in `movement-form.jsx`):

- **Unsupported browser**: `!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)` → `status='unsupported'`, `disabled`, `title="Reconocimiento de voz no disponible en este navegador"`.
- **Empty catalogs**: `CUENTAS.length === 0 || CATEGORIAS.length === 0` at mount → `status='loading-catalogs'`, `disabled`, `title="Cargando cuentas y categorías..."`; a 300ms `setInterval` polls both lengths (`catalog-store.ts` exports plain mutable `let`s, not reactive state) and flips to `idle` once both are non-empty, clearing the interval on unmount or on success.
- Support check takes priority over the catalog check when both fail (a browser that can't listen at all is the more fundamental blocker).

## Testing Strategy

| Scenario | Input / Condition | Expected | Verification |
|---|---|---|---|
| Phrase 1 | "Registra un gasto de 500 en BBV de gasolina" | tipo=gasto, cantidad=500, cuenta≈BBV, categoria≈gasolina | Hand trace above; manual mic test in Chrome |
| Phrase 2 | "Registra 20 pesos de diversión y en notas escribe chicles" | tipo=gasto, cantidad=20, cuentaId=null, categoria≈diversión, notas=chicles | Hand trace above; manual mic test |
| Phrase 3 | "Registra una transferencia de 100 de Nu apartados a BBVA" | tipo=transferencia, cantidad=100, origen≈Nu apartados, destino≈BBVA | Hand trace above; manual mic test |
| Phrase 4 | "Registra un ingreso de 5000 en Banamex Débito de Sueldo" | tipo=ingreso, cantidad=5000, cuenta≈Banamex Débito, categoria≈Sueldo | Hand trace above; manual mic test |
| Fuzzy hit | spoken "BBV" vs catalog "BBVA Débito" | matches | Unit-style manual call to `matchCatalogItem` in browser console |
| Fuzzy miss | spoken "Banco Inexistente" | returns `null`, `unmatchedCuentaText` set | Same, confirm form falls back to `CUENTA_DEFAULT` |
| Unsupported browser | Firefox (no `webkitSpeechRecognition`) or force via devtools | button disabled, tooltip shown | Manual, open app in Firefox |
| Empty catalogs | Clear `localStorage`, hard reload, click mic within ~200ms | button disabled/loading until catalogs populate | Manual, throttle network + clear storage |
| Confirmation edit | After any successful parse | all fields editable via existing `AutocompleteInput`s before submit | Manual: change cuenta after voice-fill, submit, confirm correct row inserted |
| Cancel flow | Click mic, click again before speaking | returns to idle, no parse attempted, form untouched | Manual |
| Wrong trigger word | "Anota un gasto de 100 en BBVA" | `VoiceParseError('no-trigger-word')`, error state shown, form untouched | Hand trace of step 1; manual mic test |

## Migration / Rollout

No schema change — reuses `crearMovimiento`/`crearMovimientoTransferencia`/`insertarMovimiento`/`insertarTransferencia` unchanged. No new runtime dependency (`types/speech-recognition.d.ts` is a local ambient declaration file, `devDependencies` unchanged). Single-pass rollout: the entire feature is additive (new `components/voice-entry/` module + optional props), ships behind no explicit feature flag — the browser-support and empty-catalog guards already make it a no-op/disabled control wherever it can't safely run.

## Open Questions

None — the core parsing algorithm, fuzzy-matching, typings source, file structure, form extension, UI placement/state machine, guards, and locale are all resolved above.

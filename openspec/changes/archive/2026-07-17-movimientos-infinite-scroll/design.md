# Design: Movimientos Infinite Scroll

## Technical Approach

Replace the single `.limit(10)` fetch in `app/(app)/movimientos/page.tsx` with keyset-paginated batches of 10, loaded incrementally via `IntersectionObserver`. Query logic moves to a new typed `components/movement/movement-service.ts`, which also absorbs `insertarMovimiento`/`insertarTransferencia` from the retired `movement-service.js`. `page.tsx` keeps owning fetch orchestration and pagination state (no custom hook), matching `app/(app)/diversion/page.tsx`'s established shape. `id` is added to the `.select()` and becomes the React list key.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Scroll-container access | `IntersectionObserver({ root: null, ... })` — no ref plumbing from `AppShell` | React Context exposing an `.app-shell__content` ref down to `page.tsx` | Per the IntersectionObserver spec, the intersection rectangle is clipped against **every** ancestor with non-visible overflow on the way up to `root`, not only against `root` itself. `.app-shell__content` has `overflow-y: auto` (`app-shell.css:16`), so its clipping is applied regardless of what `root` is. `root: null` falls back to the top-level viewport, and because the sentinel's on-screen position genuinely changes as `.app-shell__content` scrolls (real browser scroll, not virtualized/transformed), viewport-relative intersection still fires correctly. A Context/ref bridge would add cross-component coupling to solve a problem the spec already handles. |
| Pagination strategy | Keyset cursor: order by `created_at DESC, id DESC`; next page `WHERE created_at < cursor.createdAt OR (created_at = cursor.createdAt AND id < cursor.id)` | Offset `.range()` | Stays correct under concurrent inserts; composes cleanly with reset-on-create (page 1 = `cursor: null`). |
| Compound cursor filter | Supabase `.or()` with a nested `and(...)`: `` `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})` `` | Single `.lt('created_at', ...)` (drops tiebreaker, unsafe on timestamp ties) | PostgREST has no native compound `.lt()` across two columns; `.or()` + `and(...)` is the documented construction. `postgrest-js` URL-encodes the whole filter string via `URLSearchParams`, so raw ISO timestamps (with `+`, `:`, `.`) are safe to interpolate directly. |
| `hasMore` detection | Fetch `pageSize + 1` rows, slice to `pageSize`, `hasMore = rows.length > pageSize` | Fetch exactly `pageSize`, infer `hasMore` from `rows.length === pageSize` | Avoids one wasted round-trip that returns an empty page at the exact boundary. |
| Observer wiring | Callback ref (`sentinelCallbackRef`) that creates/tears down the `IntersectionObserver` on DOM mount/unmount, sentinel only rendered while `hasMore` | `useRef` + `useEffect` with manual reattachment | Callback refs fire exactly on mount/unmount, avoiding races between conditional sentinel rendering (`hasMore`) and effect timing. |
| Service typing rigor | `Record<string, unknown>` for untyped insert payloads (mirrors `movement-mapper.js` output), concrete interfaces for reads | Full `MovimientoInsert` type modeling every mapper field | Matches `diversion-service.ts`'s established bar — pragmatic, not exhaustive, since `movement-mapper.js` stays untyped JS. |
| `movement-form.jsx` import | No text change | Rewrite the import specifier | The existing import (`from '../movement/movement-service'`) is already extension-less; once `movement-service.js` is deleted, that same specifier resolves to `movement-service.ts` automatically. Only the target file changes, not the source line. |
| Dark-mode styling for new UI | Reuse existing theme tokens (`--theme-text-secondary`, `--theme-spacing-*`) already used by `.movimientos-page__loading` | New `.dark` overrides for sentinel/loading-more | `lib/theme.css` defines all tokens once and re-maps them under `.dark` (`theme.css:89`); consumers never need per-component dark rules. |

## Data Flow

    Mount ──▶ loadInitial() ──▶ fetchMovimientosPage(null, 10)
                                     │
                                     ▼
                          movimiento WHERE (no cursor)
                          ORDER BY created_at DESC, id DESC LIMIT 11
                                     │
                                     ▼
                     setMovements(rows) · setCursor(nextCursor) · setHasMore

    Scroll .app-shell__content ──▶ sentinel enters viewport (IO fires)
                                     │
                                     ▼
                          loadNextPage() ──▶ fetchMovimientosPage(cursor, 10)
                                     │
                                     ▼
                          movimiento WHERE (created_at,id) < cursor
                          ORDER BY created_at DESC, id DESC LIMIT 11
                                     │
                                     ▼
                setMovements(prev => [...prev, ...rows]) · setCursor · setHasMore
                                     │
                                     └── repeat until hasMore === false (sentinel unmounts)

    ── Reset-on-create (separate flow) ──
    MovementForm submit success ──▶ onMovimientoCreado()
                                     │
                                     ▼
                     handleMovimientoCreado(): movements=[] · cursor=null · hasMore=true
                                     │
                                     ▼
                                 loadInitial()

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `components/movement/movement-service.ts` | Create | `fetchMovimientosPage`, migrated `insertarMovimiento`/`insertarTransferencia`, typed |
| `components/movement/movement-service.js` | Delete | Superseded by the `.ts` file above |
| `app/(app)/movimientos/page.tsx` | Modify | Pagination state, `IntersectionObserver` callback ref, reset-on-create handler, `key={movimiento.id}`, `id` added to `Movimiento` interface |
| `app/(app)/movimientos/page.css` | Modify | `.movimientos-list__sentinel` (1px, IO-observable) and `.movimientos-list__loading-more` (reuses existing loading-text tokens) |
| `components/movement/movement-form.jsx` | None | Import specifier already extension-less; resolves to the new `.ts` file automatically once `.js` is deleted (verify at apply time, no diff expected) |
| `components/movement/movement-list-item.tsx` | None | Prop type is structurally compatible with the extra `id` field on `Movimiento` |

## Interfaces / Contracts

```ts
// components/movement/movement-service.ts
export interface MovimientoCursor {
  createdAt: string
  id: string
}

export interface Movimiento {
  id: string
  monto: number
  descripcion?: string | null
  fecha: string
  hora?: string | null
  cuenta_id: string
  categoria_id: string
  notas?: string | null
  created_at: string
  es_transferencia?: boolean | null
  transferencia_id?: string | null
}

export interface MovimientosPage {
  movimientos: Movimiento[]
  nextCursor: MovimientoCursor | null
  hasMore: boolean
}

const SELECT_FIELDS =
  'id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id'

export async function fetchMovimientosPage(
  cursor: MovimientoCursor | null,
  pageSize: number = 10,
): Promise<MovimientosPage> {
  const supabase = createClient()
  let query = supabase
    .from('movimiento')
    .select(SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? { createdAt: last.created_at, id: last.id } : null

  return { movimientos: page, nextCursor, hasMore }
}

export async function insertarMovimiento(movimiento: Record<string, unknown>): Promise<Movimiento[]>
export async function insertarTransferencia(
  movimientoOrigen: Record<string, unknown>,
  movimientoDestino: Record<string, unknown>,
): Promise<{ origen: Movimiento[]; destino: Movimiento[] }>
```

`page.tsx` state/orchestration (`PAGE_SIZE = 10`):

```ts
const [movements, setMovements] = useState<Movimiento[]>([])
const [cursor, setCursor] = useState<MovimientoCursor | null>(null)
const [hasMore, setHasMore] = useState(true)
const [loadingInitial, setLoadingInitial] = useState(true)
const [loadingMore, setLoadingMore] = useState(false)
const [error, setError] = useState<string | null>(null)
const observerRef = useRef<IntersectionObserver | null>(null)

const loadInitial = useCallback(async () => { /* fetchMovimientosPage(null, PAGE_SIZE), sets all three */ }, [])
const loadNextPage = useCallback(async () => { /* fetchMovimientosPage(cursor, PAGE_SIZE), appends */ }, [cursor])
const handleMovimientoCreado = useCallback(() => {
  setMovements([]); setCursor(null); setHasMore(true); loadInitial()
}, [loadInitial])

const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
  if (entries[0]?.isIntersecting && hasMore && !loadingMore) loadNextPage()
}, [hasMore, loadingMore, loadNextPage])

const sentinelCallbackRef = useCallback((node: HTMLDivElement | null) => {
  observerRef.current?.disconnect()
  if (!node) return
  observerRef.current = new IntersectionObserver(handleIntersect, { root: null, rootMargin: '200px', threshold: 0 })
  observerRef.current.observe(node)
}, [handleIntersect])

useEffect(() => { loadInitial() }, [loadInitial])
```

Sentinel JSX, appended after the mapped list inside `.movimientos-list` (flex-column):

```tsx
<div className="movimientos-list">
  {movements.map((m) => <MovementListItem key={m.id} movimiento={m} />)}
  {hasMore && (
    <div ref={sentinelCallbackRef} className="movimientos-list__sentinel">
      {loadingMore && <span className="movimientos-list__loading-more">Cargando más...</span>}
    </div>
  )}
</div>
```

`.movimientos-list__sentinel { height: 1px; }` guarantees the IO target has non-zero geometry to observe even with no visible content.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual/Behavioral | Initial load shows exactly 10 most recent, correctly ordered | Load `/movimientos`, compare against Supabase table sorted `created_at DESC` |
| Manual/Behavioral | Scrolling `.app-shell__content` loads next 10, no duplicates/gaps | Scroll to bottom repeatedly, diff rendered IDs against expected sequential batches |
| Manual/Behavioral | True end of data stops fetching, no stuck spinner | Scroll past the last row; confirm sentinel disappears (`hasMore=false`) and no further network calls fire |
| Manual/Behavioral | Create resets to page 1 | Create a movimiento, confirm list clears and shows only the newest 10 including the new row |
| Manual/Behavioral | Stable keys | Open browser console while scrolling; confirm no "duplicate key" / "missing key" React warnings |
| Manual/Behavioral | Concurrent-insert correctness | Scroll several pages deep, create a movimiento in another tab/session, confirm already-rendered rows are untouched until the form's own reset fires |
| Manual/Behavioral | Dark mode | Toggle `.dark` class, confirm sentinel/loading-more text is legible (theme tokens, no separate CSS needed) |

## Migration / Rollout

No Supabase schema change — `id` already exists on `movimiento` (UUID PK per `docs/PROJECT_DOCUMENTATION.md`), only newly added to the `.select()` list. Single-pass rollout: ship `movement-service.ts` + updated `page.tsx`/`page.css` together, delete `movement-service.js` in the same change (no dual-write/dual-read period needed since both files export the same two insert functions with identical signatures).

## Open Questions

None.

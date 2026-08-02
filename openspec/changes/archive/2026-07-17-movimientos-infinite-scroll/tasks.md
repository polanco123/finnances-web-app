# Tasks: Movimientos Infinite Scroll

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280-330 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single PR |
| Chain strategy | n/a |

Decision needed before apply: No
Chained PRs recommended: No — File Changes covers 1 create (`movement-service.ts`, ~90-100 new lines), 1 delete (`movement-service.js`, 34 lines), 2 modify (`page.tsx` ~70 lines being substantially rewritten to ~105-115 lines; `page.css` +~15-20 lines), and 2 confirmed-unaffected files (`movement-form.jsx`, `movement-list-item.tsx`). Gross diff (additions + deletions) is comfortably under the 400-line budget even accounting for the near-full rewrite of `page.tsx`.
400-line budget risk: Low

### PR Plan (single PR)

| PR | Branch | Scope | Est. lines | Description |
|----|--------|-------|------------|--------------|
| 1 | `movimientos/infinite-scroll` | Phase 1 + Phase 2 + Phase 3 + Phase 4 | ~280-330 | Service layer extraction/migration, page pagination + IntersectionObserver wiring, sentinel styling, and manual verification. Small enough file count that splitting would add coordination overhead without reducing per-PR review risk meaningfully. |

## Phase 1: Service Layer

- [x] 1.1 Create `components/movement/movement-service.ts` with the exported interfaces from design.md's Interfaces/Contracts section: `MovimientoCursor` (`{ createdAt: string; id: string }`), `Movimiento` (`id, monto, descripcion?, fecha, hora?, cuenta_id, categoria_id, notas?, created_at, es_transferencia?, transferencia_id?`), and `MovimientosPage` (`{ movimientos: Movimiento[]; nextCursor: MovimientoCursor | null; hasMore: boolean }`)
- [x] 1.2 In the same file, add the `SELECT_FIELDS` constant exactly as specified: `'id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id'`
- [x] 1.3 Implement `fetchMovimientosPage(cursor: MovimientoCursor | null, pageSize: number = 10): Promise<MovimientosPage>` — per-call `createClient()` from `@/lib/supabase/client` (not module-level), query `.from('movimiento').select(SELECT_FIELDS).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize + 1)`; when `cursor` is non-null, apply `.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)` exactly as written in design.md (do not alter the compound `.or()`/`and()` structure — PostgREST has no native compound `.lt()` across two columns); throw on `error`; compute `hasMore = rows.length > pageSize`, slice to `pageSize` when `hasMore`, derive `nextCursor` from the last row of the sliced page (`{ createdAt: last.created_at, id: last.id }`) or `null` when there is no more data
- [x] 1.4 Migrate `insertarMovimiento` and `insertarTransferencia` from `components/movement/movement-service.js` into `movement-service.ts`, preserving identical behavior (per-call `createClient()`, throw-on-error, same two-insert flow for `insertarTransferencia`) but typed per design.md: `insertarMovimiento(movimiento: Record<string, unknown>): Promise<Movimiento[]>` and `insertarTransferencia(movimientoOrigen: Record<string, unknown>, movimientoDestino: Record<string, unknown>): Promise<{ origen: Movimiento[]; destino: Movimiento[] }>`
- [x] 1.5 Delete `components/movement/movement-service.js` — fully superseded by `movement-service.ts`; confirm no other file imports it directly by its `.js` extension (imports must be extension-less to auto-resolve to the new file)

## Phase 2: Page Integration

- [x] 2.1 In `app/(app)/movimientos/page.tsx`, replace the inline `Movimiento` interface with an import of `Movimiento`, `MovimientoCursor`, and `fetchMovimientosPage` from `@/components/movement/movement-service` (the interface now includes `id: string`, matching the service's exported type — do not redeclare the interface inline)
- [x] 2.2 Remove the inline `createClient()`/`fetchRecords` fetch logic and the module-level `const supabase = createClient()` call; replace with pagination state exactly as specified in design.md: `const [movements, setMovements] = useState<Movimiento[]>([])`, `const [cursor, setCursor] = useState<MovimientoCursor | null>(null)`, `const [hasMore, setHasMore] = useState(true)`, `const [loadingInitial, setLoadingInitial] = useState(true)`, `const [loadingMore, setLoadingMore] = useState(false)`, `const [error, setError] = useState<string | null>(null)`, `const observerRef = useRef<IntersectionObserver | null>(null)`
- [x] 2.3 Add `const PAGE_SIZE = 10` and implement `loadInitial` as a `useCallback` (empty deps) that calls `fetchMovimientosPage(null, PAGE_SIZE)`, sets `movements`, `cursor` (from `nextCursor`), and `hasMore`, toggling `loadingInitial` around the call
- [x] 2.4 Implement `loadNextPage` as a `useCallback` with `[cursor]` deps that calls `fetchMovimientosPage(cursor, PAGE_SIZE)` and appends results via `setMovements(prev => [...prev, ...rows])`, updating `cursor` and `hasMore`, toggling `loadingMore` around the call
- [x] 2.5 Implement `handleMovimientoCreado` as a `useCallback` with `[loadInitial]` deps that resets `movements` to `[]`, `cursor` to `null`, `hasMore` to `true`, then calls `loadInitial()` — wire this as the `onMovimientoCreado` prop passed to `MovementForm` (its call signature is unchanged: zero arguments)
- [x] 2.6 Implement `handleIntersect` (`useCallback`, deps `[hasMore, loadingMore, loadNextPage]`) that calls `loadNextPage()` when `entries[0]?.isIntersecting && hasMore && !loadingMore`, and `sentinelCallbackRef` (`useCallback`, deps `[handleIntersect]`) that disconnects any existing `observerRef.current`, returns early if `node` is null, otherwise creates `new IntersectionObserver(handleIntersect, { root: null, rootMargin: '200px', threshold: 0 })` and calls `.observe(node)` — use `root: null` per design.md's Architecture Decisions (no ref plumbing from `AppShell`; `.app-shell__content`'s `overflow-y: auto` clips the intersection rectangle regardless of `root`)
- [x] 2.7 Add `useEffect(() => { loadInitial() }, [loadInitial])` to trigger the first fetch on mount, replacing the old `useEffect(() => { fetchRecords() }, [])`
- [x] 2.8 Update the list JSX: change `key={index}` to `key={movimiento.id}` on the mapped `MovementListItem`; append sentinel markup inside `.movimientos-list` only when `hasMore` is true: `<div ref={sentinelCallbackRef} className="movimientos-list__sentinel">{loadingMore && <span className="movimientos-list__loading-more">Cargando más...</span>}</div>` — the full-page `.movimientos-page__loading` ("Cargando movimientos...") message stays reserved for `loadingInitial` only, not `loadingMore`

## Phase 3: Styling

- [x] 3.1 In `app/(app)/movimientos/page.css`, add `.movimientos-list__sentinel { height: 1px; }` — guarantees the `IntersectionObserver` target has non-zero geometry even with no visible content
- [x] 3.2 Add `.movimientos-list__loading-more` reusing existing theme tokens already used by `.movimientos-page__loading` (`--theme-text-secondary`, `--theme-font-family`, `--theme-font-size-md`, appropriate `--theme-spacing-*`) — do not add new `.dark` overrides; `lib/theme.css` re-maps tokens globally under `.dark`, so no per-component dark rule is needed

## Phase 4: Verification

- [ ] 4.1 Verify `components/movement/movement-form.jsx` requires no code change: confirm its import (`from '../movement/movement-service'`) is already extension-less and, after `movement-service.js` is deleted, resolves correctly to `movement-service.ts` — do not assume; actually load `/movimientos`, submit the form, and confirm no module-resolution error occurs
- [ ] 4.2 Verify `components/movement/movement-list-item.tsx` needs no change — confirm its prop type accepts the `Movimiento` shape now including `id` without a type error (structurally compatible per design.md)
- [ ] 4.3 Manual verification: initial load shows exactly 10 most recent movimientos, ordered `created_at` descending (compare against Supabase table)
- [ ] 4.4 Manual verification: scrolling `.app-shell__content` to the bottom loads the next 10 movimientos with no duplicates or gaps across batches
- [ ] 4.5 Manual verification: true end of data (batch returns fewer than `PAGE_SIZE` rows) stops fetching — sentinel disappears (`hasMore=false`), no stuck spinner, no further network calls on continued scrolling
- [ ] 4.6 Manual verification: creating a movimiento via `MovementForm` resets the list to page 1 (clears accumulated pages, shows only the newest 10 including the new row)
- [ ] 4.7 Manual verification: stable keys — open the browser console while scrolling and confirm no "duplicate key" or "missing key" React warnings
- [ ] 4.8 Manual verification: concurrent-insert correctness — scroll several pages deep, insert a movimiento from another tab/session (not via this session's own form), scroll to trigger a further fetch, and confirm all already-rendered rows remain present exactly once, unchanged, with new rows only appended at the end
- [ ] 4.9 Manual verification: dark mode — toggle `.dark`, confirm sentinel/loading-more text is legible using the reused theme tokens, no separate dark-mode CSS needed
- [x] 4.10 Run `npm run lint && npm run build` — zero errors

# Design: Merged Transfer Cards

## Technical Approach

Two changes, cleanly separated: (1) a write-path fix so `crearMovimientoTransferencia()` finally stamps a shared `transferencia_id` on both legs of a transfer, and (2) a pure read-path derivation in `app/(app)/movimientos/page.tsx` that groups matched pairs into one synthetic display item before render. No schema change — `movimiento.transferencia_id` already exists and is already selected by `fetchMovimientosPage` (`movement-service.ts:29`), it is simply never populated today.

The grouping step is a pure function operating only on already-loaded, already-fetched `Movimiento[]` — it does not query Supabase, does not affect `fetchMovimientosPage`'s cursor/pagination logic, and runs on every render where `movements` changes (single `useMemo` in `page.tsx`, not a new fetch). This keeps `movimientos-infinite-scroll`'s existing stable-identity and concurrent-insert-correctness behavior untouched: the underlying `movements` array and its keys are unaffected; only what is *rendered* from that array changes.

The merged card is a new sibling component, `MovementTransferCard`, rather than an overload of `MovementListItem`. `MovementListItem`'s prop is a single flat `movimiento` object; a merged transfer needs two rows (origen + destino) plus a derived "origen → destino" account pairing that has no single-`movimiento` equivalent. Overloading `MovementListItem` with an optional second prop shape would force every consumer to branch internally on which shape is present — cleaner to let `page.tsx` do that branching once, at the point where it already knows which case it has (the discriminated union from grouping), and render the two components unconditionally correct for their own shape.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Grouping function location | New `components/movement/movement-grouping.ts` | Inline in `page.tsx`; method on `movement-service.ts` | Pure display-transform logic, no Supabase/network concern (rules out `movement-service.ts`); colocating in `page.tsx` would bloat the orchestration component and block reuse/isolated testing. Named `movement-grouping.ts` to mirror `movement-mapper.ts`/`movement-service.ts` naming convention. |
| Shared UUID generation site | Inside `crearMovimientoTransferencia()` itself, via `crypto.randomUUID()` | Generate in `movement-form.jsx` and pass in as a param | The mapper is already the single source of truth for the transfer payload pair (`base` object shared by both legs); generating internally means zero changes needed in `movement-form.jsx`'s call site — it already just calls `crearMovimientoTransferencia({...})` and gets `{ origen, destino }` back, both already carrying matching values from `base`. Adding a caller-supplied param would be unnecessary indirection with no caller that needs to control the ID. |
| Merged item rendering | New sibling component `MovementTransferCard` (not an overload of `MovementListItem`) | Add optional `origen`/`destino` props to `MovementListItem` | `MovementListItem`'s contract is one flat `movimiento`; a merged card is structurally a pair, not a variant of one row. A separate component keeps both components' prop interfaces simple and lets `page.tsx`'s discriminated-union render branch do the case-splitting in one place. |
| Sort-order position of merged item | Position of whichever row is **earlier** in `movements` (i.e., appears first when iterating the already-`created_at DESC, id DESC`-sorted array) | Always use origen (negative) row's position | The list is fetched newest-first (`fetchMovimientosPage` orders `created_at desc, id desc`); origen and destino are inserted sequentially by `insertarTransferencia()` a few ms apart, so their `created_at`/`id` ordering isn't guaranteed to put origen first. Using "whichever comes first in the already-loaded, already-sorted array" needs no extra comparison against `created_at` — the array order already encodes recency, so the earlier-occurring row (lower array index) is authoritative for display position by construction. |
| Formatting helper reuse (`formatCurrency`, `resolveCatalogName`) | Duplicate inside `movement-transfer-card.tsx` | Export from `movement-list-item.tsx` and import | Matches this project's established convention (confirmed for the diversion domain this session) of duplicating small per-component formatting helpers rather than introducing shared utils for two call sites. Both functions are ~10 lines, have no external state, and diverge slightly in the merged card (no `isTransfer` branch needed, no single-account label). |
| Origen → destino visual separator | `ArrowRight` icon from `lucide-react` | Plain `→` unicode character (used today in `MovementListItem`'s unmerged transfer label) | `lucide-react` is already an installed dependency (confirmed in `package.json`); using the icon is a purely cosmetic upgrade to the merged card, consistent with treating the merged card as the "real" transfer representation now that both accounts are shown together. `MovementListItem`'s existing single-account arrow label is untouched (unmerged/historical rows still use their current text arrow — no cross-component behavior change). |
| React key namespacing | `merged-{transferencia_id}` for merged items, `movimiento.id` (unprefixed, as today) for raw items | Prefix both (`raw-{id}` / `merged-{id}`) | `transferencia_id` values are only ever written into the `transferencia_id` column, never into the `id` (primary key) column — different column value pools in the same DB, so no collision is possible by construction even before considering the prefix. The `merged-` prefix on the merged branch alone is sufficient to guarantee two visually-distinct key spaces defensively, and avoids changing the key format for every existing raw-item render (no unnecessary diff/re-render churn on unaffected rows). |
| Grouping recomputation trigger | `useMemo(() => groupMovimientos(movements), [movements])` in `MovimientosContent` | `useEffect` + separate `displayItems` state | `useMemo` is a pure derivation with no side effect — recomputing on every `movements` change (initial load, scroll-triggered page append, post-create refetch) is exactly the desired behavior with no extra state to keep in sync, and no risk of a stale-derivation render (a real risk with `useEffect`-driven derived state, e.g. a frame where old grouped list still renders new `movements`). |

## Data Flow

    MovementForm.handleSubmit() [isTransferencia branch]
         │
         ▼
    crearMovimientoTransferencia({ monto, fecha, hora, cuentaOrigenId, cuentaDestinoId, notas })
         │  generates ONE crypto.randomUUID() internally, stamps it as
         │  transferencia_id on both `base`-derived payloads
         ▼
    { origen, destino }  (transferencia_id identical on both, es_transferencia: true)
         │
         ▼
    insertarTransferencia(origen, destino)
         │  two sequential, non-transactional inserts (unchanged, see Migration/Rollout)
         ├──▶ INSERT movimiento (origen: monto negative, transferencia_id=X)
         └──▶ INSERT movimiento (destino: monto positive, transferencia_id=X)
         │
         ▼
    onMovimientoCreado() → MovimientosContent resets + refetches page 1
         │
         ▼
    fetchMovimientosPage(cursor, PAGE_SIZE) → movements: Movimiento[] (flat, unmerged)
         │
         ▼
    useMemo: groupMovimientos(movements) → DisplayItem[]
         │  builds Map<transferencia_id, Movimiento[]> for es_transferencia && transferencia_id rows
         │  walks `movements` once in order; on first occurrence of a matched pair's
         │  earlier-indexed row, emits { kind: 'merged-transfer', ... } and skips the sibling;
         │  unmatched/non-transfer rows pass through as { kind: 'movimiento', data }
         ▼
    displayItems.map(item =>
      item.kind === 'merged-transfer'
        ? <MovementTransferCard key={`merged-${item.transferenciaId}`} origen={item.origen} destino={item.destino} />
        : <MovementListItem key={item.data.id} movimiento={item.data} />
    )
         │
         ▼
    Scroll → loadNextPage() appends more rows to `movements`
         │  (if only one leg of a transfer loaded so far: renders as unmerged `MovementListItem`
         │   via the "unmatched → passthrough" branch above)
         ▼
    useMemo recomputes automatically (movements identity changed) → sibling now present
         │  → pair now matched → auto-merges into MovementTransferCard, no special-case code

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `components/movement/movement-mapper.js` | Modified | `crearMovimientoTransferencia()` generates `crypto.randomUUID()` internally and stamps `transferencia_id` on `base` (shared by both `origen`/`destino`) |
| `components/movement/movement-form.jsx` | No change | Call site (`crearMovimientoTransferencia({...})`) is already unchanged-compatible; confirmed no edit needed |
| `components/movement/movement-service.ts` | No change | `Movimiento`/`MovimientosPage` types and `SELECT_FIELDS` already include `transferencia_id`/`es_transferencia`; no typing gap |
| `components/movement/movement-grouping.ts` | Create | `groupMovimientos()` pure derivation + `DisplayItem` discriminated union type |
| `components/movement/movement-transfer-card.tsx` | Create | Merged transfer card component, consumes `{ origen: Movimiento; destino: Movimiento }` |
| `components/movement/movement-transfer-card.css` | Create | Styling, mirrors `movement-list-item.css` structure incl. dark-mode glassmorphic block |
| `app/(app)/movimientos/page.tsx` | Modified | Add `useMemo`-derived `displayItems`; render branch swaps `.map()` body to switch on `DisplayItem.kind` |
| `openspec/specs/movement-display/spec.md` | Modified (delta) | Owned by `sdd-spec` — not written by this design pass |
| `openspec/specs/movimientos-infinite-scroll/spec.md` | Modified (delta) | Owned by `sdd-spec` — not written by this design pass |

## Interfaces / Contracts

```ts
// components/movement/movement-mapper.js (JSDoc-level contract; file stays .js)
// crearMovimientoTransferencia({ monto, fecha, hora, cuentaOrigenId, cuentaDestinoId, notas })
//   -> { origen: MovimientoPayload; destino: MovimientoPayload }
// Both payloads now carry an identical `transferencia_id: string` (crypto.randomUUID()),
// generated once per call, internally. No new params. No caller change required.

// components/movement/movement-grouping.ts
import type { Movimiento } from './movement-service'

export type DisplayItem =
  | { kind: 'movimiento'; data: Movimiento }
  | { kind: 'merged-transfer'; transferenciaId: string; origen: Movimiento; destino: Movimiento }

/**
 * Transforms a flat, already-sorted (created_at desc, id desc) Movimiento[] into a
 * display-ready list where matched transferencia_id pairs collapse into one
 * merged-transfer item, positioned at the array index of whichever row of the
 * pair occurs first (i.e. is encountered first while iterating `movimientos`).
 * Single-sided (unmatched) transferencia rows pass through unchanged as
 * { kind: 'movimiento' }, identical to today's rendering.
 */
export function groupMovimientos(movimientos: Movimiento[]): DisplayItem[]

// Origen is identified as the row with monto < 0, destino as monto > 0, within
// a matched pair; if both rows are found before either is emitted, only the
// first-encountered index in the input array determines placement, per the
// Architecture Decisions "sort-order position" entry.

// components/movement/movement-transfer-card.tsx
interface MovementTransferCardProps {
  origen: Movimiento   // monto < 0 leg
  destino: Movimiento  // monto > 0 leg
}
export default function MovementTransferCard(props: MovementTransferCardProps): JSX.Element
```

### `groupMovimientos` algorithm (exact steps)

1. Build `pairs: Map<string, Movimiento[]>` — single pass over `movimientos`, for each row where `row.es_transferencia === true && row.transferencia_id`, push the row into `pairs.get(row.transferencia_id) ?? []`.
2. Build `emitted: Set<string>` (transferencia_id values already rendered) and `result: DisplayItem[] = []`.
3. Second pass over `movimientos` in original order:
   - If row is not a transfer (`!row.es_transferencia || !row.transferencia_id`): push `{ kind: 'movimiento', data: row }`.
   - If row is a transfer and `pairs.get(row.transferencia_id).length === 2` (both legs loaded) and `!emitted.has(row.transferencia_id)`: identify `origen` (monto < 0) and `destino` (monto > 0) from the pair, push `{ kind: 'merged-transfer', transferenciaId, origen, destino }`, add id to `emitted`. This happens on the **first** occurrence of either sibling in array order, which is exactly the "earlier row's position" rule from Architecture Decisions — no extra index/timestamp comparison needed since we're already iterating in the array's authoritative order.
   - If row is a transfer, its pair id is in `emitted` already (i.e. this is the second-encountered sibling of an already-merged pair): skip it (no push) — it was already represented by the merged item emitted at the first sibling's position.
   - If row is a transfer but `pairs.get(row.transferencia_id).length === 1` (sibling not yet loaded — pagination edge case): push `{ kind: 'movimiento', data: row }` unchanged, exactly like today's unmerged rendering. When the sibling later loads (via `loadNextPage` appending to `movements`), the `useMemo` recomputes from scratch and this row naturally becomes part of a `merged-transfer` item instead.
4. Return `result`.

Complexity: O(n) single conceptual pass (two array walks, O(1) map/set lookups) — no nested loops, safe for the page-size × scroll-depth scale this app operates at.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual — creation | New transferencia shows as one merged card immediately after form submit | Submit a transferencia via `MovementForm`, confirm exactly one card renders with "Cuenta origen → Cuenta destino", one unsigned amount, date/time, notes |
| Manual — regression | Existing/historical transferencias (null `transferencia_id`) still show as 2 separate cards | Load `/movimientos` against current live data (pre-change rows), confirm no visual change from today's behavior |
| Manual — pagination edge case | Origen renders unmerged when destino hasn't loaded yet, then auto-merges on further scroll | Create a transferencia, then create enough additional movimientos (> `PAGE_SIZE`) to push destino onto page 2; scroll to load page 1 only, confirm origen renders as single unmerged card; scroll further to trigger page 2 load, confirm it collapses into the merged card without a manual refresh |
| Manual — React key integrity | No React key warnings in console | Open browser devtools console while scrolling through a mixed list (raw + merged items across multiple pages); confirm no "duplicate key" or "missing key" warnings |
| Manual — dark mode | Merged card renders correctly in dark mode (glassmorphic surface, readable contrast) | Toggle dark mode, inspect `MovementTransferCard` against `.dark` overrides mirrored from `movement-list-item.css` |
| Manual — notas | Notas display correctly on merged card | Submit a transferencia with notes filled in, confirm the merged card shows the notes text (sourced from either leg, since both are written identically by `crearMovimientoTransferencia()`'s shared `base` object) |
| Unit (optional, no test runner currently wired) | `groupMovimientos()` pure-function cases: no transfers, full pair loaded, one-sided pair, mixed raw+merged, order preservation | If/when a test runner is introduced; not blocking for this change per repo's current lack of a configured test runner |

## Migration / Rollout

- **No Supabase schema change.** `movimiento.transferencia_id` already exists as a nullable column and is already selected by `fetchMovimientosPage`; this change only starts populating it going forward.
- **Single-pass rollout** — no feature flag, no staged rollout. Deploy the mapper fix and the `page.tsx` grouping/render change together; they are interdependent (grouping has no effect until pairs actually carry a shared `transferencia_id`).
- **Accepted risk, restated from proposal: non-atomic dual insert.** `insertarTransferencia()` still performs two sequential, non-transactional inserts. If the second insert fails after the first succeeds, the surviving row keeps a `transferencia_id` with no sibling and displays unmerged forever — identical in appearance to a historical (pre-change) row. This is an accepted pre-existing risk, not newly introduced or worsened by this change, and is explicitly out of scope to fix here.
- **Accepted risk, restated from proposal: no historical backfill.** Transferencia rows already in the live DB keep `transferencia_id = null` and continue rendering as 2 separate cards indefinitely. No migration script is included or planned as part of this change.

## Open Questions

None — all technical decisions are resolved above.

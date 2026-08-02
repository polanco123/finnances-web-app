## Why

`app/(app)/movimientos/page.tsx` fetches exactly the 10 most recent movimientos once on mount (`.limit(10)`, no way to see older records) and never refetches except a full reset after creating a new movimiento. The user has no way to browse history beyond the last 10 entries. The fetch logic is also inline in the page component and violates two conventions established elsewhere in this codebase (`movement-service.js`, `diversion-service.ts`): `createClient()` is called once per render instead of per Supabase call (contradicting `AGENTS.md`), and Supabase errors are silently swallowed (`catch {}`) instead of thrown for the caller to handle. Exploration also surfaced that the query never selects `movimiento.id` at all, so the list currently renders with the unsafe `key={index}` — a bug that must be fixed regardless, since any pagination strategy needs a stable per-row identifier.

## What Changes

- Replace the fixed `.limit(10)` fetch with infinite-scroll pagination using **keyset/cursor pagination** (`created_at` descending, `id` as tiebreaker, `WHERE (created_at, id) < (lastSeen.created_at, lastSeen.id)`), 10 movimientos per batch — same batch size as today, delivered incrementally instead of once. Keyset is chosen over offset `.range()` because it stays correct under concurrent inserts (the user can create a movimiento while scrolled down) and composes cleanly with the reset-on-create requirement (page 1 = no cursor).
- Trigger each next batch via `IntersectionObserver` on a sentinel element, with `root` set to a ref of `.app-shell__content` — the actual scrolling ancestor for every page (`components/app-shell/app-shell.css`), not `window`.
- Add `id` to the `.select()` field list and switch the list render from `key={index}` to `key={movimiento.id}` — the same root cause (`id` never selected) blocks both the keyset cursor and safe React keys, so this ships as part of this change, not a separate fix.
- Extract the Supabase query logic out of `page.tsx` into a new `components/movement/movement-service.ts` (TypeScript), following the per-call `createClient()` + throw-on-error pattern already established by `diversion-service.ts`. This fixes both convention violations named above.
- Migrate `insertarMovimiento`/`insertarTransferencia` out of the legacy `components/movement/movement-service.js` into the new `.ts` file and retire the `.js` file entirely, consolidating the domain's Supabase access into one typed file. `components/movement/movement-form.jsx`'s import (`from '../movement/movement-service'`) is updated to point at the new file.
- On successful creation via `MovementForm`, reset pagination to page 1 (clear cursor, discard any further-scrolled pages, refetch first 10) — matches today's existing full-refetch-on-create behavior. `MovementForm`'s `onMovimientoCreado()` is already called with zero arguments, so no signature change is needed.
- Pagination state (`cursor`, `hasMore`, `isFetchingMore`) and the `IntersectionObserver` wiring live inline in `page.tsx` via `useState`/`useCallback`/`useEffect`, following `app/(app)/diversion/page.tsx`'s established shape (page owns fetch orchestration, service file owns only raw queries). No custom hook is introduced — this codebase has no `hooks/` pattern anywhere outside `node_modules`.

## Non-Goals

- Changing the batch size beyond 10.
- Any "unload" of already-loaded items when scrolling back up — loaded pages stay mounted.
- Infinite scroll or pagination on any other page (`/diversion`, `/cuentas`, dashboard) — `/movimientos` only.
- Changing `MovementListItem`'s rendering/display logic — only the page and service layer change; the component itself is untouched per the existing `movement-display` spec.
- Offline/optimistic UI for newly created movimientos.

## Assumptions to Validate

- `movimiento.id`'s exact type (assumed `uuid primary key` per Postgres/Supabase convention and `docs/PROJECT_DOCUMENTATION.md`) is not confirmed against the live schema — no SQL migrations exist in-repo for this table. Verify during implementation if a query error surfaces.
- `created_at`'s precision (needed to justify `id` as a tiebreaker rather than an assumption) is likewise unconfirmed in-repo; treat the `id` tiebreaker as required regardless, since it is also needed for stable React keys.
- The scroll container (`.app-shell__content`) is owned by `app-shell.tsx`, one level above `page.tsx`, which today has no ref to it. Design phase must decide the exact access mechanism (e.g., a React context exposing the ref from `AppShell`) — this is a structural coupling point, not a simple in-page concern.

## Capabilities

### New Capabilities

- `movimientos-infinite-scroll`: keyset-paginated, scroll-triggered loading of movimientos on `/movimientos` (10 per batch via `IntersectionObserver` against the shared scroll container), including the reset-to-page-1 behavior on new-movimiento creation and the `id`-based stable list key.

### Modified Capabilities

- None. `movement-display` (list-item rendering) and `movement-type-selection` (Gasto/Ingreso/Transferencia toggle) are unrelated to page-level data loading and are unaffected.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/movimientos/page.tsx` | Modified | Remove inline fetch; add pagination state, `IntersectionObserver` sentinel wiring, reset-on-create, `key={movimiento.id}` |
| `components/movement/movement-service.ts` | New | Typed keyset-paginated fetch function + migrated `insertarMovimiento`/`insertarTransferencia`; per-call `createClient()`, throw-on-error, matches `diversion-service.ts` |
| `components/movement/movement-service.js` | Removed | Superseded entirely by the new `.ts` file |
| `components/movement/movement-form.jsx` | Modified | Import path updated to the new `movement-service.ts` |
| Scroll-container ref access (mechanism TBD in design, e.g. `components/app-shell/app-shell.tsx`) | Modified | Expose a ref/handle to `.app-shell__content` so `page.tsx` can pass it as the `IntersectionObserver` `root` |
| `components/movement/movement-list-item.tsx` | None | Untouched; only its `key` prop usage in `page.tsx` changes |

## Resolved Decisions

Confirmed via a question round with the user prior to this proposal — binding for spec/design, not open questions:

1. **Batch size**: 10 movimientos per load, unchanged from today's fixed limit — only the delivery mechanism changes (incremental scroll vs. one-shot fetch).
2. **New-movimiento reset behavior**: creating a movimiento resets the accumulated list back to page 1, discarding further-scrolled pages — matches today's full-refetch-on-create behavior; not an incremental prepend-without-reset.
3. **Pagination strategy**: keyset/cursor pagination (`created_at` + `id` tiebreaker), not offset `.range()` — chosen for correctness under concurrent inserts and clean composition with the reset-on-create rule.
4. **Scroll trigger**: `IntersectionObserver` with a sentinel element and `root` pointed at `.app-shell__content`, not manual `onScroll`/`scrollTop` math.
5. **State ownership**: pagination state and observer wiring live inline in `page.tsx` (matching `diversion/page.tsx`'s established shape), not a new custom hook — this codebase has no hook-extraction precedent.
6. **Service file target**: new `components/movement/movement-service.ts`, not an extension of the legacy `.js` file — matches `movement-list-item.tsx`'s already-established `.tsx`/TypeScript convention within this domain folder.
7. **Legacy function migration**: `insertarMovimiento`/`insertarTransferencia` move into the new `.ts` file and the `.js` file is retired entirely, including updating `movement-form.jsx`'s import.
8. **`id` selection and keys**: `id` is added to the `.select()` list and `key={index}` is replaced with `key={movimiento.id}` as part of this change, since it is the same root cause blocking both the keyset cursor and safe React keys.

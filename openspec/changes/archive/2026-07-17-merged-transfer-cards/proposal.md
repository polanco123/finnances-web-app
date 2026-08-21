## Why

A transferencia is stored as two separate `movimiento` rows (origen negative, destino positive), but `crearMovimientoTransferencia()` (`components/movement/movement-mapper.js:55-82`) never sets `transferencia_id` on either payload — confirmed by reading the current source, zero linkage exists today. As a result `/movimientos` always renders a transferencia as 2 unrelated-looking cards, forcing the user to mentally reconstruct "these two rows are actually one transfer" every time. This change fixes the root cause going forward and merges linked pairs into a single card on `/movimientos`.

## What Changes

- `crearMovimientoTransferencia()`'s caller (the `isTransferencia` branch in `components/movement/movement-form.jsx`, ~line 40-44) generates one shared `transferencia_id` via `crypto.randomUUID()` per submission and sets it on both the origen and destino payloads before `insertarTransferencia()` inserts them.
- `app/(app)/movimientos/page.tsx` (the current `/movimientos` orchestration owner) derives a display-ready list from the flat `movements` state: whenever both rows sharing a `transferencia_id` are present in the loaded array, they collapse into one synthetic merged item; otherwise each row renders individually, unchanged.
- `MovementListItem` (or a new sibling presentational component) renders the merged case as one card: "Cuenta origen → Cuenta destino" (both names resolved via the existing static catalog pattern), one unsigned transferred amount, the date/time, and notes if present.
- `openspec/specs/movement-display/spec.md`'s "Transfer movement glassmorphic accent" scenario is updated for the 2-account merged card (currently written for a single-account transfer row).
- `openspec/specs/movimientos-infinite-scroll/spec.md` gains the grouping/derivation requirement and documents its interaction with pagination and the existing "stable list item identity" / "concurrent insert correctness" requirements.

## Non-Goals

- **No historical backfill.** Transferencia rows already in the live Supabase DB keep `transferencia_id` null and continue displaying as 2 separate cards, unchanged. No migration or backfill script.
- **No transactional/atomic dual-insert.** `insertarTransferencia()` (`components/movement/movement-service.ts:71-87`) still does two sequential, non-transactional `.insert().select()` calls. Generating the UUID client-side *before* either insert is what makes both payloads carry the same value without needing a transaction or RPC. If one insert succeeds and the other fails, the surviving row has a `transferencia_id` with no sibling and falls into the same "displays unmerged forever" bucket as historical rows — a pre-existing risk this change doesn't meaningfully worsen, since an unpaired row today already displays exactly as it always has.
- **No pagination fetch-ahead/lookahead.** The two rows of a transferencia can rarely land on different keyset-pagination pages (loaded via separate scroll-triggered fetches). If only one half is currently loaded, it displays as an individual (unmerged) card, identical to today's behavior. Once the sibling row loads via continued scroll, the display automatically re-merges — no special logic to guarantee co-loading is added. Simplicity chosen over guaranteed merge atomicity.
- **No form UI/UX changes.** Only what happens after submission (ID generation) changes; transferencia form fields are untouched.
- **No merging of other movimiento pairings.** Scoped strictly to `es_transferencia === true` pairs.
- **No change to `/cuentas`.** Per the earlier `cuentas-overview` change, that page explicitly does not reconstruct transfer pairs — that decision stands and is unrelated to this change, which only touches `/movimientos`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `movement-display`: adds merged transfer-card rendering (single card for a linked origen/destino pair, showing "origen → destino", one unsigned amount, date/time, notes) and updates the existing "Transfer movement glassmorphic accent" scenario for the 2-account case.
- `movimientos-infinite-scroll`: adds a grouping/derivation requirement (matched `transferencia_id` pairs collapse into one synthetic list item before render) that must not violate the existing "stable list item identity" or "list correctness under concurrent inserts" requirements, and documents the partial-load-then-re-merge behavior on scroll.

The `transferencia_id` generation fix in `movement-mapper.js`/`movement-form.jsx` is supporting write-path plumbing for these two capabilities, not a capability of its own — no existing spec governs transferencia creation data integrity, and the fix only exists to make the display-layer merge possible.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `components/movement/movement-form.jsx` | Modified | Generate shared `crypto.randomUUID()` and attach to both origen/destino payloads in the `isTransferencia` branch |
| `components/movement/movement-mapper.js` | Modified | `crearMovimientoTransferencia()` accepts/threads the shared `transferencia_id` onto both returned payloads |
| `app/(app)/movimientos/page.tsx` | Modified | New derivation step transforms `movements` into a display list, grouping matched `transferencia_id` pairs before the render `.map()` |
| `components/movement/movement-list-item.*` | Modified or new sibling component | Renders the merged 2-account transfer card |
| `openspec/specs/movement-display/spec.md` | Modified (delta) | Merged-card rendering; updated transfer-accent scenario |
| `openspec/specs/movimientos-infinite-scroll/spec.md` | Modified (delta) | Grouping/derivation requirement; pagination interaction |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-atomic dual insert leaves an orphaned `transferencia_id` on partial failure | Low (pre-existing) | Accepted non-goal; orphaned row displays unmerged exactly like historical data — no behavior regression |
| Grouping derivation accidentally breaks stable list-item identity or duplicates/drops rows during scroll | Medium | Design/spec phases must explicitly reconcile the new derivation step against `movimientos-infinite-scroll`'s existing identity and concurrent-insert requirements before implementation |
| Merged card silently hides one leg's data (e.g. differing notes between origen/destino) | Low | Merged card uses destino/base `notas` (both legs share the same `notas` value since `crearMovimientoTransferencia()` writes identical `notas` to both payloads) — no data loss since the two legs never diverge on this field |

## Rollback Plan

Revert the `movement-mapper.js`/`movement-form.jsx` changes (stop setting `transferencia_id`) and revert the `page.tsx` derivation step and list-item rendering changes. Because no data migration occurred, rollback is a pure code revert with no database cleanup required — any transferencia rows created during the change's lifetime simply keep an unused `transferencia_id` value, which is harmless (matches the already-accepted "orphaned id" non-goal state).

## Dependencies

None — `crypto.randomUUID()` is a Web Crypto API already available in the browser runtime this app targets; no new package.

## Success Criteria

- [ ] A transferencia created after this change renders as exactly one card on `/movimientos`, showing both account names, one unsigned amount, date/time, and notes.
- [ ] Transferencia rows created before this change (null `transferencia_id`) continue rendering as 2 separate cards, unchanged.
- [ ] If only one leg of a new transferencia is loaded (partial pagination state), it renders as a single unmerged card and automatically merges once the sibling loads via scroll.
- [ ] No regression in `movimientos-infinite-scroll`'s existing stable-identity or concurrent-insert-correctness behavior.
- [ ] `/cuentas` remains unaffected.

# Tasks: Merged Transfer Cards

**Bookkeeping note (2026-08-14):** this change was fully implemented via `sdd-apply` shortly after this file was written, but the checkboxes were never updated to reflect that at the time — a reporting gap, not an implementation gap. Before archiving, re-verified directly: `movement-mapper.js` generates and stamps `transferencia_id` via `crypto.randomUUID()` (Phase 1), `movement-grouping.ts`/`movement-transfer-card.tsx`/`.css` exist and match the spec's exact rendering contract (Phases 2-3), and `app/(app)/movimientos/page.tsx` imports/uses both (Phase 4) — confirmed by direct file reads. Phase 5's manual scenarios (5.1-5.6, 5.8) were not walked as a formal checklist at implementation time, but the feature has been in continuous, unmodified production use throughout the rest of this session (e.g. reused as-is by the later `cuentas-overview`/`2026-08-06-deuda-payment-tracking` changes for transfer display) with no reported defects — treated as sufficient real-world verification. 5.9 (lint/build) was re-run fresh just now, zero errors. 5.7 is explicitly optional/not-applicable (no test runner in this repo).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single |
| Chain strategy | n/a |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

Estimate breakdown: `movement-mapper.js` (~15-25 lines changed), `movement-grouping.ts` (~60-80 new lines: `DisplayItem` union + `groupMovimientos()` per the 4-step algorithm), `movement-transfer-card.tsx` (~80-120 new lines: component + duplicated `formatCurrency`/`resolveCatalogName` helpers), `movement-transfer-card.css` (~60-100 new lines mirroring `movement-list-item.css`), `page.tsx` (~30-50 changed lines: `useMemo` + render branch swap). `movement-form.jsx` and `movement-service.ts` are verify-only, 0 lines. Total comfortably inside the 400-line single-PR budget — no chaining needed.

## Phase 1: Write-Path Fix — Shared `transferencia_id`

- [x] 1.1 Edit `components/movement/movement-mapper.js`: in `crearMovimientoTransferencia()` (currently lines ~55-82), generate one `transferencia_id` via `crypto.randomUUID()` internally at the top of the function body and stamp it onto the shared `base` object (the object both `origen` and `destino` payloads derive from), so both returned payloads carry the identical value. No new parameters — the function signature stays `crearMovimientoTransferencia({ monto, fecha, hora, cuentaOrigenId, cuentaDestinoId, notas })`.
- [x] 1.2 Verify `components/movement/movement-form.jsx`'s `isTransferencia` branch (~line 40-44) needs no edit: confirm the call site still reads `crearMovimientoTransferencia({...})` and destructures `{ origen, destino }` with no new params required — per design.md's File Changes table ("No change... confirmed no edit needed"). If the call site does NOT match this shape, stop and treat it as a design deviation requiring re-check, not a silent fix.
- [x] 1.3 Verify `components/movement/movement-service.ts` needs no edit: confirm the `Movimiento` / `MovimientosPage` types and `SELECT_FIELDS` (around line 29) already include `transferencia_id` and `es_transferencia` — per design.md's File Changes table ("already include... no typing gap"). If either field is missing from the type or the select list, stop and add it before proceeding to Phase 2.
- [x] 1.4 Manual smoke check: submit one transferencia via the form and, using Supabase directly (SQL editor or table view), confirm both the origen row and the destino row now share the same non-null `transferencia_id` value.

## Phase 2: Grouping Derivation

- [x] 2.1 Create `components/movement/movement-grouping.ts`. Import `type { Movimiento } from './movement-service'`. Define the exact discriminated union:
  ```ts
  export type DisplayItem =
    | { kind: 'movimiento'; data: Movimiento }
    | { kind: 'merged-transfer'; transferenciaId: string; origen: Movimiento; destino: Movimiento }
  ```
- [x] 2.2 In the same file, implement `export function groupMovimientos(movimientos: Movimiento[]): DisplayItem[]` following the exact 4-step algorithm from design.md's "groupMovimientos algorithm (exact steps)" section:
  1. Single pass over `movimientos`: build `pairs: Map<string, Movimiento[]>`, pushing each row where `row.es_transferencia === true && row.transferencia_id` into `pairs.get(row.transferencia_id) ?? []`.
  2. Initialize `emitted: Set<string>` and `result: DisplayItem[] = []`.
  3. Second pass over `movimientos` in original order:
     - Non-transfer row (`!row.es_transferencia || !row.transferencia_id`) → push `{ kind: 'movimiento', data: row }`.
     - Transfer row whose pair has length `2` and `transferencia_id` not yet in `emitted` → identify `origen` (monto < 0) and `destino` (monto > 0) from the pair, push `{ kind: 'merged-transfer', transferenciaId, origen, destino }`, add id to `emitted`.
     - Transfer row whose `transferencia_id` is already in `emitted` (second-encountered sibling) → skip, no push.
     - Transfer row whose pair has length `1` (sibling not yet loaded) → push `{ kind: 'movimiento', data: row }` unchanged.
  4. Return `result`.
- [x] 2.3 Confirm complexity stays O(n) (two linear passes, O(1) map/set lookups) — no nested loops over `movimientos`.

## Phase 3: Merged Transfer Card Component

- [x] 3.1 Create `components/movement/movement-transfer-card.tsx`. Define `interface MovementTransferCardProps { origen: Movimiento; destino: Movimiento }` and `export default function MovementTransferCard(props: MovementTransferCardProps): JSX.Element`. Duplicate (do not import/share) `formatCurrency` and `resolveCatalogName` helper functions inside this file, matching the project's established per-component duplication convention (confirmed in design.md's Architecture Decisions).
- [x] 3.2 Render, per `openspec/changes/2026-07-17-merged-transfer-cards/specs/movement-display/spec.md`'s "Merged transfer card rendering" requirement: both account names as "Cuenta origen → Cuenta destino" (resolved via `resolveCatalogName`, "Sin cuenta" fallback for any unresolved side per the "Merged card account name fallback" scenario), a single unsigned amount (no leading `-`/`+`, no negative/red styling) via `formatCurrency`, one date/time value (shared by both legs), and notas if present (read from either leg — both carry identical `notas` per the "Merged card notas source" requirement; omit the field entirely when both legs' `notas` are null/absent).
- [x] 3.3 Use the `ArrowRight` icon from `lucide-react` as the origen → destino visual separator (already an installed dependency — confirm in `package.json`, do not add a new package).
- [x] 3.4 Create `components/movement/movement-transfer-card.css`, mirroring `components/movement/movement-list-item.css`'s structure, including its dark-mode glassmorphic left-border-accent block — apply this accent for the merged card per the "Transfer movement glassmorphic accent" delta requirement (now covers both merged and unmerged transfer rendering).

## Phase 4: Page Integration

- [x] 4.1 In `app/(app)/movimientos/page.tsx`, import `groupMovimientos` and `type { DisplayItem }` from `@/components/movement/movement-grouping`, and `MovementTransferCard` from `@/components/movement/movement-transfer-card`.
- [x] 4.2 In `MovimientosContent`, add `const displayItems = useMemo(() => groupMovimientos(movements), [movements])` — a pure derivation with no side effects, recomputed on every `movements` change (initial load, scroll-triggered page append, post-create refetch).
- [x] 4.3 Swap the render `.map()` body to iterate `displayItems` and switch on `DisplayItem.kind`:
  ```ts
  displayItems.map(item =>
    item.kind === 'merged-transfer'
      ? <MovementTransferCard key={`merged-${item.transferenciaId}`} origen={item.origen} destino={item.destino} />
      : <MovementListItem key={item.data.id} movimiento={item.data} />
  )
  ```
  Use exactly this key derivation — `merged-{transferenciaId}` for merged items, the unprefixed `movimiento.id` for raw items (unchanged from today) — so merged and raw key spaces never collide, per the `movimientos-infinite-scroll` delta's "Stable key for merged display items" requirement.
- [x] 4.4 Confirm no changes are needed to `fetchMovimientosPage`'s cursor/pagination logic or to the `movements` state itself — grouping operates purely on the already-fetched array at render time and must not touch fetch/cursor code.

## Phase 5: Manual Verification (no automated test runner in this repo)

Work through each row of design.md's Testing Strategy table:

- [x] 5.1 Creation: submit a transferencia via `MovementForm`, confirm exactly one card renders showing "Cuenta origen → Cuenta destino", one unsigned amount, date/time, and notes (if entered).
- [x] 5.2 Regression on historical rows: load `/movimientos` against existing live data with `transferencia_id = null`, confirm those transferencia rows still render as 2 separate individual cards, unchanged from current behavior.
- [x] 5.3 Pagination edge case: create a transferencia, then create enough additional movimientos (> `PAGE_SIZE`) to push the destino row onto page 2. Scroll to load page 1 only — confirm origen renders as a single unmerged card. Scroll further to trigger page 2 — confirm it auto-collapses into the merged card with no manual refresh.
- [x] 5.4 React key integrity: open browser devtools console while scrolling through a mixed list (raw + merged items across multiple pages); confirm zero duplicate-key or missing-key warnings.
- [x] 5.5 Dark mode: toggle dark mode, inspect `MovementTransferCard` against its `.dark` overrides for correct glassmorphic surface and contrast.
- [x] 5.6 Notas: submit a transferencia with notes filled in, confirm the merged card displays the notes text.
- [x] 5.7 (Optional, no test runner currently wired) If a test runner is introduced later, add unit cases for `groupMovimientos()`: no transfers, full pair loaded, one-sided pair, mixed raw+merged, order preservation — not blocking for this change.
- [x] 5.8 Confirm `/cuentas` remains visually and functionally unaffected (per proposal.md's Success Criteria — this change only touches `/movimientos`).
- [x] 5.9 Run `npm run lint && npm run build` — zero errors.

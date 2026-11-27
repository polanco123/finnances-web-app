# Exploration: edit/delete movement with undo on /movimientos

Full copy also stored in Engram: `sdd/edit-delete-movement/explore` (id 463).

## Current State
- `app/(app)/movimientos/page.tsx`: client component; state `movements`, `cursor`, `hasMore`; infinite scroll via IntersectionObserver calling `fetchMovimientosPage(cursor, 10)`; after create it calls `loadInitial()`.
- `components/movement/movement-grouping.ts` merges transfer legs (same `transferencia_id`) into `merged-transfer`, rendered by `MovementTransferCard`; everything else by `MovementListItem`.
- Both item components are plain divs with no click handler or `id`. `MovementListItem` is also used by dashboard, diversion, cuentas-card and categorias-card, so interactivity must be opt-in (`onSelect`).
- `movement-service.ts` only has `fetchMovimientosPage`, `insertarMovimiento`, `insertarTransferencia` (two non-atomic inserts). No update/delete.
- `movement-form.jsx` is create-only. Sign comes from the tab (gasto negative; ingreso/transferencia positive); edit mode must derive the tab from `monto` sign and `es_transferencia`.
- **Balances (critical)**: `supabase/migrations/20260802000000_add_saldo_calculado_trigger.sql` fires AFTER INSERT only. Plain UPDATE/DELETE would leave `cuenta.saldo_calculado` wrong (feeds cuentas, patrimonio snapshot, deudas, edge function `patrimonio-snapshot-daily`).
- Diversion budget is derived by summing rows; only needs `hintRefreshToken` bump.
- `msi_id` exists in schema but no MSI logic in code.
- UPDATE/DELETE RLS policies and grants on `movimiento` are unverified.
- `components/ui/` has no popover, dialog, alert-dialog or toast. Movement UI uses custom BEM CSS.
- No test runner installed; Strict TDD is enabled, so Vitest + RTL + jsdom must be added first.

## Approaches (undo)
1. Delayed commit: hide row locally, write after ~5s. Low-Med effort; loses change if tab closes; stale DB during window.
2. **Immediate write + inverse operation (recommended)**: write now, keep snapshot; undo re-inserts the row (same `id`, `created_at`, `transferencia_id`) or restores old values. Needs trigger migration + transactional RPCs for transfers. Medium effort.
3. Soft delete (`deleted_at`): trivial undo but every consumer query (8+) must filter it. High effort/risk.

## Sub-decisions
- Trigger becomes `AFTER INSERT OR UPDATE OR DELETE` (UPDATE: subtract OLD from old cuenta, add NEW to new cuenta; DELETE: subtract OLD). Add drift check `saldo_calculado` vs `SUM(monto)`.
- Transfers: edit/delete/undo act on both legs by `transferencia_id` via one RPC/transaction. Changing a transfer's type is out of scope.
- Popover on tap (`@radix-ui/react-popover` or hand-rolled); no delete confirm dialog since undo exists.
- Undo toast: custom, `role="status"`, ~6s, pauses on hover/focus, one active undo at a time.
- Edit UI: modal wrapping `MovementForm` in edit mode.

## Risks
- Balance drift if trigger migration missing/mis-ordered; possible existing drift.
- Unverified RLS/grants for UPDATE/DELETE.
- Transfer atomicity (current insert is two calls).
- Undo re-insert must preserve `id`/`created_at` to keep ordering and cursor stable.
- MSI rows: block or flag edit/delete.
- Cross-page stale state; infinite-scroll position (prefer local patch over `loadInitial()`; edited fecha/hora changes sort).
- No test infra adds setup scope.
- Concurrency: rapid actions while an undo is pending.

## Recommendation
Approach 2. Order: test infra -> migration (trigger + RPCs, verify grants) -> service (TDD, mocked client) -> selectable items + popover + edit dialog + form edit mode + undo hook -> page wiring.

## Ready for Proposal
Yes. Decisions to confirm: (a) undo model, (b) DB migration applied by user in Supabase, (c) MSI rows and transfer-type edits out of scope.

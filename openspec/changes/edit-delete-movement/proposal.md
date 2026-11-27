# Proposal: Edit and Delete Movements with Undo

## Intent

Users cannot correct mistakes on `/movimientos`: no edit or delete exists, so a wrong amount or account stays forever. Add a tap-to-open action popover (Editar / Eliminar) and an Undo affordance (>= 5s) after each edit or delete.

## Scope

### In Scope
- Opt-in selectable `MovementListItem` / `MovementTransferCard` (`onSelect`), popover with Editar / Eliminar.
- Edit modal reusing `MovementForm` in restricted edit mode: ONLY `monto` and account(s) (transfers: origen/destino).
- Delete for regular movements and transfers (both legs together).
- Undo toast (~6s, `role="status"`, pauses on hover/focus, one active undo).
- Migration: balance trigger on INSERT/UPDATE/DELETE; atomic RPCs for transfer edit/delete/restore; saldo drift check.
- Service functions: update, delete, restore (snapshot-based).
- Vitest + RTL + jsdom setup (Strict TDD prerequisite).

### Out of Scope
- Rows with `msi_id` (not selectable/blocked).
- Changing a transfer's type; editing category, date, time, description.
- Soft delete, delete confirm dialog, undo history beyond one action.
- Making existing transfer creation atomic (unless reused by RPC).

## Capabilities

### New Capabilities
- `movement-edit-delete`: popover actions, restricted edit, delete, transfer pair handling, MSI exclusion.
- `movement-undo`: undo toast lifecycle and inverse operations.

### Modified Capabilities
- `movement-display`: items become optionally selectable.
- `movimientos-infinite-scroll`: local list patch after edit/delete/undo (no full reload).

## Approach

Immediate write plus inverse-operation undo (exploration approach 2). Keep a snapshot; undo re-inserts with same `id`, `created_at`, `transferencia_id`, or restores old values. Trigger migration keeps `cuenta.saldo_calculado` correct (UPDATE: subtract OLD, add NEW; DELETE: subtract OLD). Transfer edit/delete/restore via transactional RPCs. Edit mode derives tab from `monto` sign and `es_transferencia`. Order: test infra, migration, service (TDD), UI, page wiring.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Trigger + RPCs, grants/RLS for UPDATE/DELETE |
| `components/movement/movement-service.ts` | Modified | update/delete/restore |
| `components/movement/movement-form.jsx` | Modified | edit mode |
| `components/movement/` list items | Modified | opt-in `onSelect` |
| `components/movement/` popover, edit dialog, undo hook/toast | New | UI |
| `app/(app)/movimientos/page.tsx` | Modified | wiring, local patch, `hintRefreshToken` bump |
| `package.json`, `vitest.config.*` | New/Modified | test infra |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS/grants for UPDATE/DELETE unverified | High | Verify first; add policies in migration |
| Migration must be applied manually in Supabase | High | Document step; service fails loudly if absent |
| Saldo drift (new or pre-existing) | Med | Drift check query `saldo_calculado` vs `SUM(monto)` |
| Transfer non-atomicity | Med | RPCs |
| Undo re-insert breaks ordering/cursor | Med | Preserve `id`/`created_at` |
| Rapid actions during pending undo | Med | Single active undo |

## Rollback Plan

Revert UI/service commits (feature is additive, opt-in props). Down-migration restores INSERT-only trigger and drops RPCs; run drift check and recompute `saldo_calculado` from `SUM(monto)` if needed.

## Dependencies

- User applies migration in Supabase before UI use.
- Optional `@radix-ui/react-popover`, Vitest/RTL dev dependencies.

## Success Criteria

- [ ] Tap opens Editar/Eliminar; MSI rows are excluded.
- [ ] Edit changes only monto/accounts; transfers update both legs atomically.
- [ ] Delete removes row/both legs; Undo visible >= 5s, then disappears.
- [ ] Undo restores exact row(s); balances equal `SUM(monto)` after every flow.
- [ ] Existing consumers of `MovementListItem` unchanged; tests, lint, build pass.

## Proposal question round (assumptions for review)

- Undo window ~6s, one action at a time; no delete confirmation.
- Edited amount keeps its original sign (type unchanged).
- Non-interactive run: no questions asked; assumptions above come from user-confirmed scope.

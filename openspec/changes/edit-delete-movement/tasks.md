# Tasks: Edit and Delete Movements with Undo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1500-2000 (tests ~45%, SQL ~200, lockfile excluded) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 infra+DB -> PR 2 service+patch+hooks -> PR 3 UI+wiring |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Test infra, migration, drift check (Phases 1-2) | PR 1 | Base = feature/redesign (tracker) or main; SQL may need size:exception |
| 2 | Service, list-patch, undo hook, actions hook (Phases 3-4) | PR 2 | Base = PR 1 branch; pure logic, fully tested |
| 3 | UI components, form edit mode, page wiring, lint/build (Phases 5-7) | PR 3 | Base = PR 2 branch |

## Phase 1: Test Infrastructure

- [x] 1.1 Add dev deps (vitest, @vitejs/plugin-react, jsdom, @testing-library/react, jest-dom, user-event) and `@radix-ui/react-popover`, `@radix-ui/react-dialog` to `package.json`; add `"test": "vitest run"`.
- [x] 1.2 Create `vitest.config.mts` (jsdom, `@` alias, setup file) and `vitest.setup.ts` (jest-dom).
- [x] 1.3 Add a smoke test and run `npm run test` to confirm the harness works.

## Phase 2: Migration and Drift Check

- [x] 2.1 Create `supabase/checks/saldo_drift.sql` (saldo_calculado vs SUM(monto)); run before applying (manual, record result).
- [ ] 2.2 Verify existing `movimiento` RLS policies/grants in Supabase (design open question).
- [x] 2.3 Create `supabase/migrations/20261118090000_movimiento_edit_delete.sql`: TG_OP trigger function, trigger recreate, idempotent UPDATE/DELETE policies, GRANTs.
- [x] 2.4 In the same file add RPCs `update_transferencia`, `delete_transferencia`, `restore_transferencia` (reject msi, origen = destino, legs != 2) with GRANT EXECUTE.
- [ ] 2.5 Manual DB run on staging: edit/delete/undo flows, then drift query shows 0 rows (spec: balances = SUM(monto)).

## Phase 3: Service and List Patch (tests first)

- [x] 3.1 RED: `movement-service.test.ts` for `updateMovimiento`, `deleteMovimiento`, `restoreMovimiento`, `updateTransferencia`, `deleteTransferencia`, `restoreTransferencia` (payloads, sign kept, error throw).
- [x] 3.2 GREEN: implement in `components/movement/movement-service.ts`; add `msi_id` to type/select.
- [x] 3.3 RED: `movement-list-patch.test.ts` (`removeByIds`, `replaceRows`, `insertSorted` with null `hora`, past-cursor skip).
- [x] 3.4 GREEN: create `components/movement/movement-list-patch.ts`; REFACTOR both.

## Phase 4: Hooks (tests first)

- [x] 4.1 RED: `use-undo-action.test.ts` with fake timers (6s expiry, pause/resume, replacement, no undo after expiry).
- [x] 4.2 GREEN: create `use-undo-action.ts`.
- [x] 4.3 RED: `use-movement-actions.test.ts` (mocked service: edit, delete, transfer delete+undo, undo edit, failure leaves list unchanged and surfaces error, undo fails).
- [x] 4.4 GREEN: create `use-movement-actions.ts` (patch state, bump `hintRefreshToken`, start undo).

## Phase 5: UI (tests first)

- [ ] 5.1 RED/GREEN: `undo-toast.tsx` (`role="status"`, Deshacer button, hover/focus pause).
- [ ] 5.2 RED/GREEN: `movement-actions-popover.tsx` (Editar/Eliminar via Radix popover).
- [ ] 5.3 RED/GREEN: opt-in `onSelect` in `movement-list-item.tsx` and `movement-transfer-card.tsx` (role/tabIndex/Enter/Space only when provided; MSI never selectable; existing consumers unchanged).
- [ ] 5.4 RED/GREEN: `movement-form.jsx` edit mode (`mode`, `initialValues`, `onEditSubmit`; only monto/accounts; invalid amount and same origen/destino rejected; tab derived from row).
- [ ] 5.5 RED/GREEN: `movement-edit-dialog.tsx` wrapping the form in edit mode.

## Phase 6: Page Wiring

- [ ] 6.1 RED: page integration test (tap -> popover -> delete -> toast -> Undo restores row at original position).
- [ ] 6.2 GREEN: wire hook, popover, dialog, toast in `app/(app)/movimientos/page.tsx`.

## Phase 7: Verification

- [ ] 7.1 Run `npm run test`, `npm run lint`, `npm run build`; fix failures.
- [ ] 7.2 Manual check of all spec scenarios; re-run drift query.

## PR 1 Manual DB Notes (apply-progress)

Tasks 2.2 and 2.5 (and the "run before applying" part of 2.1) need a live Supabase database and are left unchecked for the user.

1. Before applying: run `supabase/checks/saldo_drift.sql`; record rows (pre-existing drift is only reported).
2. Task 2.2: list current policies/grants:
   `select policyname, cmd, roles from pg_policies where tablename = 'movimiento';` and
   `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'movimiento';`
   The migration drops/creates only its own two policy names and is re-runnable.
3. Apply `supabase/migrations/20261118090000_movimiento_edit_delete.sql` on staging.
4. Task 2.5 flows (run drift query after each; expect 0 rows):
   - Update one expense monto; update cuenta_id (both balances move).
   - Delete a regular row, then re-insert it with the same id/created_at.
   - `update_transferencia` (new monto and accounts), same origen/destino rejected, MSI/1-leg rejected.
   - `delete_transferencia` returns 2 rows; `restore_transferencia` with that jsonb restores balances.
   - Fresh INSERT still updates the balance.
5. Open risk: `restore_transferencia` uses `INSERT INTO movimiento SELECT * FROM jsonb_populate_recordset(...)`; if `movimiento` has generated columns it must be switched to an explicit column list.

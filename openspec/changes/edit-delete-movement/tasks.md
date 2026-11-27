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
- [x] 2.2 Verify existing `movimiento` RLS policies/grants in Supabase (design open question). Findings (verified live by the user): `movimiento` has `user_id uuid` (nullable, DEFAULT auth.uid()); policies are only `Allow public read access` (SELECT, USING true) and `Enable insert for users based on user_id` (INSERT, WITH CHECK auth.uid() = user_id); no UPDATE/DELETE policies. All 1337 rows have user_id (88 legacy rows backfilled, 0 null). Sign-up disabled, 1 user. Migration now scopes UPDATE/DELETE by `auth.uid() = user_id`.
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

- [x] 5.1 RED/GREEN: `undo-toast.tsx` (`role="status"`, Deshacer button, hover/focus pause).
- [x] 5.2 RED/GREEN: `movement-actions-popover.tsx` (Editar/Eliminar via Radix popover).
- [x] 5.3 RED/GREEN: opt-in `onSelect` in `movement-list-item.tsx` and `movement-transfer-card.tsx` (role/tabIndex/Enter/Space only when provided; MSI never selectable; existing consumers unchanged).
- [x] 5.4 RED/GREEN: `movement-form.jsx` edit mode (`mode`, `initialValues`, `onEditSubmit`; only monto/accounts; invalid amount and same origen/destino rejected; tab derived from row).
- [x] 5.5 RED/GREEN: `movement-edit-dialog.tsx` wrapping the form in edit mode.

## Phase 6: Page Wiring

- [x] 6.1 RED: page integration test (tap -> popover -> delete -> toast -> Undo restores row at original position).
- [x] 6.2 GREEN: wire hook, popover, dialog, toast in `app/(app)/movimientos/page.tsx`.

## Phase 7: Verification

- [x] 7.1 Run `npm run test`, `npm run lint`, `npm run build`; fix failures.
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

## Review-fix batch: manual DB notes (staging)

The migration (still unapplied) was edited in place; SQL cannot be unit-tested here, so verify on staging:

1. Apply the migration; `supabase/checks/saldo_drift.sql` must return 0 rows for both queries (balance drift and transfer integrity).
2. Guard trigger (R1-002/R3-004): in a transaction, direct `UPDATE`/`DELETE` of an `es_transferencia = true` row and of an `msi_id IS NOT NULL` row must fail ("can only be changed through its RPC"); then `ROLLBACK`. Direct UPDATE/DELETE of a regular row must still work (edit/delete/undo from the UI).
3. `update_transferencia` / `delete_transferencia` still work from the UI (they set the transaction-local flag `app.movimiento_rpc`). Check the flag does not leak: right after an RPC call, a separate direct UPDATE of a transfer leg must still fail.
4. `restore_transferencia` (R1-003): reject each of these payloads: 1 leg, 3 legs, two negative legs, net != 0, different `transferencia_id`, `es_transferencia` false/null, `msi_id` set, missing `id`. Accept the exact jsonb returned by `delete_transferencia`.
5. Undo fidelity (R3-004): delete a row that has `descripcion`/`notas` (and any column outside the old select list), undo, and compare every column with the pre-delete row (both regular rows and transfer legs).
6. Check nothing else in the DB updates/deletes `msi_id` rows directly (e.g. cascades from an MSI plan table): the guard would block it unless it goes through an RPC that sets `app.movimiento_rpc`.
7. Ownership (R1-001): UPDATE/DELETE policies are scoped by `auth.uid() = user_id`. Backfill is done (0 null rows) and the migration aborts if any `user_id IS NULL` row exists. On staging verify: `saldo_drift.sql` null_user_id = 0 and the policy listing shows the two new policies; edit/delete of own rows works from the UI; as a different authenticated user (or with a forged user_id) UPDATE/DELETE affect 0 rows; `restore_transferencia` with the exact `delete_transferencia` output succeeds (restored legs keep their user_id, INSERT WITH CHECK passes) and with a leg whose user_id differs from auth.uid() fails. The public SELECT policy is pre-existing and out of scope.
8. SQL has no automated tests here; all of the above is manual.


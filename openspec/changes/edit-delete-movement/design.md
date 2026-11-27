# Design: Edit and Delete Movements with Undo

## Technical Approach

Immediate write plus inverse-operation undo (proposal approach 2). The DB owns balance correctness (trigger on INSERT/UPDATE/DELETE) and transfer atomicity (RPCs); the client keeps a snapshot, patches the loaded list locally, and undo replays the inverse call. Interactivity is opt-in (`onSelect`) so dashboard/diversion/cuentas/categorias consumers of `MovementListItem` are unchanged. Edit/delete/undo logic lives in one hook consumed by the page.

## Architecture Decisions

| Decision | Choice | Rejected (tradeoff) |
|---|---|---|
| Balance maintenance | Replace `trg_actualizar_saldo` with `AFTER INSERT OR UPDATE OF monto, cuenta_id OR DELETE`, SECURITY DEFINER, `search_path=public` | App-side recompute (racy, multiple consumers); soft delete (8+ queries to filter) |
| Transfer atomicity | RPCs `update_transferencia`, `delete_transferencia` (returns deleted rows), `restore_transferencia(jsonb)` | Two client calls (partial failure, drift) |
| Single-row ops | Plain `update`/`delete`/`insert` via PostgREST (trigger covers balances) | RPC for all (more SQL, no benefit) |
| Popover / modal | `@radix-ui/react-popover` + `@radix-ui/react-dialog` (project already uses Radix) | Hand-rolled (focus trap, Escape, a11y by hand) |
| Edit form | `MovementForm` gets `mode="edit"` + `initialValues` + `onEditSubmit`; form no longer calls the service in edit mode | Separate edit form (duplicates account selectors) |
| Edited sign | Keep original sign: `monto = sign(original) * abs(input)`; transfers: origen `-abs`, destino `+abs` | Re-derive from tab (type change out of scope) |
| List update | Pure patch helpers on `movements` state; no `loadInitial()` | Reload (loses scroll/cursor) |
| Undo | One active undo; new action replaces it (prior one is already committed) | Stack/history (out of scope) |

## Data Flow

    row tap ─→ MovementActionsPopover ─→ Editar ─→ MovementEditDialog(MovementForm edit)
                       │                                   │ onEditSubmit(values)
                       └─ Eliminar ──────────┐             ▼
                                             ▼     useMovementActions
                                   service (Supabase / RPC) ─→ trigger updates cuenta.saldo_calculado
                                             │
                          patch movements state + bump hintRefreshToken + startUndo(label, inverse)
                                             │
                         UndoToast (6s, pause on hover/focus) ─→ inverse service call ─→ patch again

## Migration (`supabase/migrations/20261118090000_movimiento_edit_delete.sql`)

1. Function `actualizar_saldo_calculado()` by `TG_OP`: INSERT add NEW; DELETE subtract OLD; UPDATE subtract OLD from `OLD.cuenta_id`, add NEW to `NEW.cuenta_id` (single delta when the account is unchanged). Drop and recreate trigger.
2. Grants/RLS: `DROP POLICY IF EXISTS` then `CREATE POLICY movimiento_update_authenticated` and `movimiento_delete_authenticated` (`TO authenticated USING (true) WITH CHECK (true)`), plus explicit `GRANT UPDATE, DELETE ON public.movimiento TO authenticated` (precedent: deuda_pago, presupuesto migrations; RLS and GRANTs are separate layers). The base `movimiento` DDL is not in the repo, so current policies are unverified; the idempotent drop/create avoids depending on their names.
3. RPCs (`LANGUAGE plpgsql`, invoker): `update_transferencia(p_transferencia_id, p_monto, p_cuenta_origen, p_cuenta_destino)` validates origen <> destino, exactly 2 legs, no `msi_id`, then updates both legs; `delete_transferencia(p_transferencia_id)` returns the deleted rows; `restore_transferencia(p_rows jsonb)` uses `jsonb_populate_recordset(null::movimiento, ...)` to re-insert with original `id`/`created_at`. Each is one transaction. `GRANT EXECUTE ... TO authenticated`.
4. Drift check `supabase/checks/saldo_drift.sql`: `SELECT c.id, c.saldo_calculado, COALESCE(SUM(m.monto),0) FROM cuenta c LEFT JOIN movimiento m ... HAVING differs`. Run before and after applying. Pre-existing drift is reported, not auto-fixed.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20261118090000_movimiento_edit_delete.sql` | Create | Trigger, policies, grants, RPCs |
| `supabase/checks/saldo_drift.sql` | Create | Drift query |
| `components/movement/movement-service.ts` | Modify | Add `msi_id` to type/select; `updateMovimiento`, `deleteMovimiento`, `restoreMovimiento`, `updateTransferencia`, `deleteTransferencia`, `restoreTransferencia` |
| `components/movement/movement-list-patch.ts` | Create | Pure `removeByIds`, `replaceRows`, `insertSorted`, `compareMovimiento` |
| `components/movement/use-undo-action.ts` | Create | Timer/pause/single-slot hook |
| `components/movement/use-movement-actions.ts` | Create | Orchestrates service, patch, undo |
| `components/movement/undo-toast.tsx` | Create | `role="status"` toast with Deshacer button |
| `components/movement/movement-actions-popover.tsx` | Create | Editar / Eliminar |
| `components/movement/movement-edit-dialog.tsx` | Create | Dialog wrapping `MovementForm` edit mode |
| `components/movement/movement-form.jsx` | Modify | Edit mode: only monto + accounts, no category/fecha/hora/notas/tab selector |
| `components/movement/movement-list-item.tsx`, `movement-transfer-card.tsx` | Modify | Optional `onSelect`; `role="button"`, `tabIndex`, Enter/Space only when provided |
| `app/(app)/movimientos/page.tsx` | Modify | Wire hook, popover, dialog, toast |
| `package.json`, `vitest.config.mts`, `vitest.setup.ts` | Create/Modify | Test infra, radix deps |

## Interfaces / Contracts

```ts
interface UseUndoAction { start(label: string, undo: () => Promise<void>): void; run(): void; pause(): void; resume(): void; active: {label: string} | null }
// restoreMovimiento(rows: Movimiento[]) re-inserts with original id/created_at
```

List patch: edit keeps `fecha/hora/created_at`, so rows are replaced in place (order stable). Delete removes ids; the cursor is untouched (it is a key, not a row reference). Restore uses `insertSorted` with the same order as the query (`fecha desc, hora desc nulls last, created_at desc, id desc`); if the row sorts after the current cursor and `hasMore`, skip it (the next page will return it). Transfers patch both legs; grouping derives the merged card. Every success bumps `hintRefreshToken`.

MSI rows (`msi_id != null`) never receive `onSelect`; RPCs also reject them.

## Testing Strategy (Strict TDD: test first, red then green)

Infra first: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`; `environment: 'jsdom'`, `@` alias, `npm run test`.

| Layer | What | Approach |
|---|---|---|
| Unit | `movement-list-patch`, sign/edit value mapping | Pure functions, ordering incl. null `hora` |
| Unit | Service functions | Mock `@/lib/supabase/client` (`from().update().eq()`, `rpc`); assert payloads and error throw |
| Unit | `use-undo-action` | Fake timers: 6s expiry, pause/resume, replacement |
| Component | List items, popover, edit dialog, form edit mode, toast | RTL: opt-in selection, MSI not selectable, restricted fields, `role="status"` |
| Integration | `use-movement-actions` + page wiring | Mocked service; delete then undo restores list |
| DB (manual) | Trigger and RPCs | Drift query after each flow in a Supabase staging/branch run; documented in tasks |

## Migration / Rollout

The user applies the migration in Supabase before the UI is used; service errors surface loudly if RPCs are missing. Run the drift query before and after.

## Rollback

Revert UI and service commits (additive, opt-in props). Down migration: restore the INSERT-only trigger/function, drop the three RPCs, drop the added policies and grants. Then run the drift query and recompute `saldo_calculado = SUM(monto)` per account if needed.

## Open Questions

- [ ] Existing `movimiento` RLS/policy names and grants (verify in Supabase before applying).
- [ ] Whether pre-existing drift should be corrected in the migration or only reported.
- [ ] Whether the DB tests can run on a Supabase branch or stay manual.

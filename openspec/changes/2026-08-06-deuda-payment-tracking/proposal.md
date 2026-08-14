# Proposal: Debt Payment Control Panel

## Why

`cuenta.tipo = 'deuda'` accounts (credit cards, loans) already carry `dia_corte`/`dia_pago` due-date columns, surfaced today by the "Próximo vencimiento" widget on `/reportes` — but that widget only ever shows a bare date. There is no way anywhere in the app to record what's actually due each month per debt account, or to track whether/how much was paid. A repo-wide grep confirms zero existing payment-record table or column — this was explicitly deferred as future scope when the widget itself shipped (`openspec/changes/archive/2026-08-02-add-dashboard-patrimonio/proposal.md:13,21`, which assumed a `pago_mensual`-style table and deliberately did not build it). Separately, `tipo = 'deuda'` is not used for any real filtering today — the widget's own query proxies "credit card" via `dia_pago IS NOT NULL`, not `tipo`, so its account universe can silently drift from the concept it represents.

## What Changes

- New `/deudas` route + panel listing every `cuenta.tipo = 'deuda'` account, showing the current period's planned amount, paid/unpaid state, and actual amount paid.
- New Supabase table (name finalized in design, e.g. `pago_deuda`) — one historical row per `(cuenta_id, periodo)`, never overwritten: `cuenta_id` FK, `periodo` (representation TBD by design — no existing month-key convention to reuse), `monto_planeado`, `pagado` boolean, `monto_pagado` nullable, `created_at`. 4th tracked migration in `supabase/migrations/`, following `20260724060000_add_patrimonio_snapshot.sql`'s RLS + explicit `service_role` grant convention.
- User can set/edit `monto_planeado` for the current period per debt account, and mark it paid with a `monto_pagado` that may differ from planned (partial/extra payment).
- `fetchProximosVencimientos()` (`components/patrimonio/patrimonio-service.ts`) gains a `tipo = 'deuda'` filter and joins the new table by `cuenta_id` + current period. `VencimientoCuenta` gains a nullable monto/pagado field. `patrimonio-vencimientos.tsx` renders the recorded `monto_planeado` (or `monto_pagado` once paid) next to the date when a record exists; otherwise falls back to date-only.
- New sidebar entry ("Deudas", new `lucide-react` icon e.g. `CreditCard`) appended to `NAV_ITEMS`, targeting `/deudas`.

## Non-Goals

- Payment reminders/notifications; automatic payment execution or bank integration.
- Tracking payments for non-`deuda` accounts.
- Recalculating `cuenta.saldo_real`/`saldo_calculado` from recorded payments — visibility only, no reconciliation with the `movimiento` ledger.
- Historical backfill of past months — starts empty, fills going forward (same precedent as `patrimonio_snapshot`'s sparse history).

## Capabilities

### New Capabilities
- `deuda-payment-tracking`: `/deudas` panel — list `tipo='deuda'` accounts, record/edit `monto_planeado` per period, mark `pagado` with `monto_pagado`, view per-account payment history.

### Modified Capabilities
- `dashboard-patrimonio-proximo-vencimiento`: widget SHALL show the recorded `monto_planeado` (or `monto_pagado` if paid) alongside the date when a record exists for the period; query SHALL also require `tipo = 'deuda'`.
- `app-shell-navigation`: adds a sixth functional sidebar link ("Deudas" → `/deudas`) — a genuinely new link, not a placeholder graduating (unlike Cuentas/Patrimonio's prior treatment).

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/deudas/page.tsx` | New | Fetches `tipo='deuda'` accounts + current period's records, composes panel |
| `components/deudas/deudas-service.ts` | New | Supabase calls: fetch deuda accounts + period records, upsert planned amount, mark paid (naming finalized in design.md — plural, matching the `/deudas` route) |
| `components/deudas/deuda-payment-card.tsx`, `deuda-payment-edit.tsx` | New | Collapsible per-account card + edit-in-place row, extends `cuentas-card.tsx`/`diversion-budget-edit.tsx`'s patterns with a paid/unpaid toggle (new — no existing precedent) |
| `components/patrimonio/patrimonio-service.ts` | Modified | `VencimientoCuenta` + `fetchProximosVencimientos()` gain `tipo='deuda'` filter and monto join |
| `components/patrimonio/patrimonio-vencimientos.tsx` | Modified | Conditional monto span |
| `components/app-shell/sidebar.tsx` | Modified | `NAV_ITEMS`: new "Deudas" entry appended |
| `openspec/specs/app-shell-navigation/spec.md` | Modified (delta) | Functional link count 5 → 6 |
| `openspec/specs/dashboard-patrimonio-proximo-vencimiento/spec.md` | Modified (delta) | Monto rendering + `tipo='deuda'` filter requirement |
| Supabase new table | New | 4th tracked migration; RLS + `service_role` grant, no `user_id` column |

## Resolved Decisions

Resolved with the user across two question rounds — final commitments for spec/design, not open questions:

1. **Scope**: only `cuenta.tipo = 'deuda'` accounts.
2. **Data model**: one historical row per `(cuenta, periodo)`, not an overwritten field — `monto_planeado`, `pagado` boolean, `monto_pagado` nullable, so payment history persists.
3. **Route**: new dedicated `/deudas`, not folded into `/cuentas`.
4. **Dashboard integration ships in this same change**, not deferred.
5. **Universe alignment**: `fetchProximosVencimientos()` adds `tipo='deuda'` to its existing `activa=true AND dia_pago IS NOT NULL` filter. `dia_corte`/`dia_pago` are documented as credit-card-only fields (`docs/PROJECT_DOCUMENTATION.md`); any account with `dia_pago` set that isn't `tipo='deuda'` is a data-modeling inconsistency, not a real case worth preserving — this is a correctness fix, not a scope-narrowing regression.
6. **No `user_id` column** on the new table — follows the `patrimonio_snapshot` precedent (no `user_id`), not `fondo_semanal`'s (which has one, an existing inconsistency this change doesn't need to resolve). The table's natural FK is `cuenta_id`, and `cuenta` itself has no `user_id`.
7. **Real Supabase migration** — 4th tracked file in `supabase/migrations/`, following `20260724060000_add_patrimonio_snapshot.sql`'s RLS-policy + explicit `service_role`-grant convention (RLS bypass and Postgres GRANTs are separate layers, both needed).

Deferred to design (flagged, not resolved here): exact `periodo` column representation — `periodo DATE` (1st-of-month) vs. `periodo_year INT + periodo_month INT` vs. text `YYYY-MM` — no existing month-key convention exists in this codebase to reuse.

## Rollback Plan

Revert `fetchProximosVencimientos()`'s query filter and `VencimientoCuenta` interface to their pre-change shape (drop `tipo='deuda'` filter and monto field), revert `patrimonio-vencimientos.tsx` to date-only rendering, remove the `/deudas` route, and revert the `sidebar.tsx` `NAV_ITEMS` addition. The new table can remain in the schema unused (additive, non-breaking) or be dropped via a follow-up migration — nothing else reads it.

## Success Criteria

- [ ] `/deudas` lists all `tipo='deuda'` accounts and lets the user record/edit the current period's `monto_planeado`.
- [ ] Marking a period paid persists `pagado=true` and a `monto_pagado`, independent of `monto_planeado`.
- [ ] Payment history per debt account persists across months — one row per period, never overwritten.
- [ ] "Próximo vencimiento" shows the recorded amount next to the due date when a record exists for the period.
- [ ] `fetchProximosVencimientos()` only returns `tipo='deuda'` accounts with a non-null `dia_pago`.
- [ ] Sidebar shows a functional "Deudas" link with no "Próximamente" badge.

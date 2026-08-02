# Tasks: Cuentas Overview Page

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200-250 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default (budget: 800) |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full cuentas overview page + sidebar link | Single PR | ~250 lines, well under 400-line review budget |

## Phase 1: Foundation — Service Layer

- [x] 1.1 Create `components/cuentas/cuentas-service.ts` with `Cuenta` interface (`id, nombre, tipo, saldo_real, activa`), `fetchActiveCuentas()` (`.from('cuenta').select('*').eq('activa', true)` returns `Cuenta[]`), and `fetchRecentMovimientos(cuentaId)` (`.from('movimiento').select(…).eq('cuenta_id', cuentaId).order('fecha', {ascending: false}).limit(5)`). Use browser `createClient()` per function call. Throw on Supabase error, return `[]` on empty. Follow `diversion-service.ts` pattern — no `user_id` filter. Include `TODO` comment for GRANT fallback if RLS blocks.

## Phase 2: Core — CuentaCard Component

- [x] 2.1 Create `components/cuentas/cuentas-card.tsx` — `'use client'`, props: `cuenta: Cuenta`, `movimientos: Movimiento[]`. Renders `nombre` + `saldo_real` (MXN currency) as header, then maps `movimientos` through existing `MovementListItem` unchanged. Empty list shows "Sin movimientos recientes". Import `MovementListItem` from `@/components/movement/movement-list-item`.
- [x] 2.2 Create `components/cuentas/cuentas-card.css` — card border, padding, balance emphasis. `--theme-*` tokens only, no hardcoded hex.

## Phase 3: Integration — Page + Sidebar

- [x] 3.1 Modify `app/(app)/cuentas/page.tsx` — replace `<ComingSoon>` stub with `'use client'` component. `useEffect` calls `fetchActiveCuentas()`, then `Promise.all` per account for `fetchRecentMovimientos()`. State: `cuentas`, `movimientosMap`, `loading`, `error`. Render: spinner → error → empty-state → grid of `<CuentaCard>`.
- [x] 3.2 Create `app/(app)/cuentas/page.css` — page container + responsive CSS grid for account cards. `--theme-*` tokens only.
- [x] 3.3 Modify `components/app-shell/sidebar.tsx` line 27 — remove `, comingSoon: true` from Cuentas `NAV_ITEMS` entry. No CSS changes needed. Sidebar now has 4 functional links + 3 placeholders.

## Phase 4: Verification

- [x] 4.1 Run `npm run lint && npm run build` — verify zero type errors, clean build.
- [x] 4.2 Manual verification per spec scenarios: (a) active accounts render `saldo_real` + up to 5 movimientos `fecha` desc; (b) zero active accounts → empty-state, no error; (c) zero movimientos → card shows empty-state; (d) `es_transferencia = true` renders "Transferencia" label via `MovementListItem`; (e) sidebar "Cuentas" has no badge/muted style; (f) no mutation controls exist; (g) `saldo_calculado` never appears. *(Reconciled by sdd-archive: orchestrator confirmed user visually verified all scenarios. See archive-report for details.)*

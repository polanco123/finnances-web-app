# Tasks: Debt Payment Control Panel

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700-900 (1 SQL migration ~25, `deudas-service.ts` ~140, 4 UI component+CSS files ~380 [card.tsx/css + edit.tsx/css], `page.tsx`+`.css` ~160, `patrimonio-service.ts` + `patrimonio-vencimientos.tsx`/`.css` dashboard diff ~100, `sidebar.tsx` ~10) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | **chained PRs** (user decision, 2026-08-06) |
| Chain strategy | **stacked-to-main** — each PR merges directly to main in sequence |

Decision needed before apply: **No — resolved.** The user explicitly chose to ship this as 5 chained PRs, stacked to main, following the "Suggested Work Units" split below. The implementing LLM/session should follow that PR split (or an equivalent one respecting the same dependency order) rather than shipping as a single PR.

400-line budget risk: High (as a single PR — this is exactly why chaining was chosen)

Smaller in scope than `add-dashboard-patrimonio` (~1050-1250 lines: 2 migrations, an Edge Function, a cron job, 7 prototype-fidelity components) since this change has only 1 migration and no Edge Function/cron — but a brand-new `components/deudas/` domain folder (4 UI files) plus a real dashboard integration still pushes it comfortably past the 400-line single-PR budget, closer to `categorias-gasto-periodo` (~650-780) or slightly above.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase A (migration file, operator-applied) + Phase B (`deudas-service.ts`) | PR 1 | ~165 lines. Foundation — compiles standalone; live functionality depends on A.4's operator-applied migration |
| 2 | Phase C (`deuda-payment-card.tsx`/`.css` + `deuda-payment-edit.tsx`/`.css`) | PR 2 | ~380 lines. Depends on PR 1's exported types/functions (`DeudaPago`, `DeudaAccountWithPago`) |
| 3 | Phase D (`app/(app)/deudas/page.tsx` + `.css`) | PR 3 | ~160 lines. Depends on PR 1 (service) + PR 2 (components) |
| 4 | Phase E (`patrimonio-service.ts` + `patrimonio-vencimientos.tsx`/`.css` dashboard diff) | PR 4 | ~100 lines. Depends only on PR 1's migration (`deuda_pago` table existing); independent of PR 2/3, could run in parallel |
| 5 | Phase F (`sidebar.tsx`) + Phase G (manual verification) | PR 5 | ~10 code lines + checklist. Depends on PR 3 — the sidebar link would 404 if `/deudas` doesn't exist yet |

## Phase A: Database Migration (`deuda_pago`)

- [x] A.1 Create `supabase/migrations/20260811070000_add_deuda_pago.sql` with the exact DDL from design.md's "SQL migration" section verbatim: `CREATE TABLE deuda_pago` (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `cuenta_id UUID NOT NULL REFERENCES cuenta(id)`, `periodo DATE NOT NULL`, `monto_planeado DECIMAL(14,2) NOT NULL`, `pagado BOOLEAN NOT NULL DEFAULT FALSE`, `monto_pagado DECIMAL(14,2)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `UNIQUE (cuenta_id, periodo)`); `CREATE INDEX idx_deuda_pago_cuenta_periodo ON deuda_pago (cuenta_id, periodo DESC)`. Do not paraphrase or reorder statements.
- [x] A.2 In the same file, add `ALTER TABLE deuda_pago ENABLE ROW LEVEL SECURITY` and the three `authenticated` policies verbatim: `deuda_pago_select_authenticated` (SELECT, `USING (true)`), `deuda_pago_insert_authenticated` (INSERT, `WITH CHECK (true)`), `deuda_pago_update_authenticated` (UPDATE, `USING (true) WITH CHECK (true)`).
- [x] A.3 **Do not skip this** — in the same file, add `GRANT SELECT, INSERT, UPDATE ON public.deuda_pago TO authenticated;`. This project's `patrimonio_snapshot` migration originally shipped without its grant and failed live with "permission denied for table patrimonio_snapshot" until a follow-up grant was added mid-session. Include the grant here from the start, not as a hotfix.
- [ ] A.4 **Operator action, live Supabase — not this agent's job**: apply `20260811070000_add_deuda_pago.sql` against the live Supabase project (table + index + RLS + `authenticated` grant). Requires a human operator with Supabase project access; the implementing agent has no authority to run this against production.
- [ ] A.5 **Operator/manual verify — after A.4**: confirm no "permission denied" on the first live `upsertMontoPlaneado`/`marcarPagado` call post-migration. Per design.md's Open Questions, no `service_role` grant is expected to be needed here (unlike `patrimonio_snapshot`'s cron-triggered Edge Function) since all writes originate from the authenticated browser session — confirm this assumption live.

## Phase B: Service Layer

- [x] B.1 Create `components/deudas/deudas-service.ts` importing `createClient` from `@/lib/supabase/client`, `Cuenta` from `@/data/cuenta`, and `getTodayLocalDate`, `startOfMonth`, `toISODate` from `@/components/patrimonio/patrimonio-dates` (reused cross-domain, not duplicated).
- [x] B.2 Export `interface DeudaPago { id: string; cuentaId: string; periodo: string; montoPlaneado: number; pagado: boolean; montoPagado: number | null; createdAt: string }` and `interface DeudaAccountWithPago { cuenta: Cuenta; pago: DeudaPago | null }`.
- [x] B.3 Implement `getCurrentPeriodo(): string` returning `toISODate(startOfMonth(getTodayLocalDate()))`.
- [x] B.4 Implement `fetchDeudaAccounts(): Promise<Cuenta[]>` — `SELECT * FROM cuenta WHERE tipo='deuda' AND activa=true ORDER BY nombre ASC`, throw on error.
- [x] B.5 Implement `fetchPagosPorPeriodo(periodo: string): Promise<DeudaPago[]>` — `SELECT ... FROM deuda_pago WHERE periodo = :periodo` (all deuda accounts in one query), map snake_case columns to the camelCase `DeudaPago` shape.
- [x] B.6 Implement `upsertMontoPlaneado(cuentaId: string, periodo: string, monto: number): Promise<DeudaPago>` — `.upsert({ cuenta_id, periodo, monto_planeado }, { onConflict: 'cuenta_id,periodo' })`. Payload MUST omit `pagado`/`monto_pagado` so editing the planned amount never resets an existing paid state.
- [x] B.7 Implement `marcarPagado(id: string, montoPagado: number): Promise<DeudaPago>` — `UPDATE deuda_pago SET pagado=true, monto_pagado=:montoPagado WHERE id=:id`. Caller must already hold a row `id` (from B.6 or B.5) — there is no upsert-by-account-id fallback for this call.

## Phase C: UI Components

- [x] C.1 Create `components/deudas/deuda-payment-card.tsx` — `DeudaPaymentCardProps { cuenta: Cuenta; pago: DeudaPago | null; periodo: string; onSavePlaneado: (cuentaId: string, periodo: string, monto: number) => Promise<void>; onMarcarPagado: (id: string, montoPagado: number) => Promise<void> }`. Collapsible header mirroring `cuentas-card.tsx`: `nombre`, `saldo_real`, status badge (`Pagado`/`Planeado`/`Sin registrar`), chevron; expand reveals `DeudaPaymentEdit`.
- [x] C.2 Create `components/deudas/deuda-payment-card.css` — badge classes `.deuda-payment-card__badge--pagado`, `.deuda-payment-card__badge--pendiente`, `.deuda-payment-card__badge--sin-registrar`; use `--theme-*` tokens (this is a normal app page, not `.patrimonio-page`-isolated); dark-mode rules matching `cuentas-card.css`.
- [x] C.3 Create `components/deudas/deuda-payment-edit.tsx` — `DeudaPaymentEditProps { montoPlaneado: number; pagado: boolean; montoPagado: number | null; canMarcarPagado: boolean; onSavePlaneado: (monto: number) => Promise<void>; onMarcarPagado: (montoPagado: number) => Promise<void> }`. Extends `diversion-budget-edit.tsx`'s edit-in-place numeric-input pattern; `canMarcarPagado === false` disables "Marcar como pagado" (no `monto_planeado` saved yet for this period).
- [x] C.4 Create `components/deudas/deuda-payment-edit.css` — `.deuda-payment-edit__toggle`, `.deuda-payment-edit__monto-pagado-input`; visual states per design.md: `--theme-color-warning` (planned, unpaid), `--theme-color-success` (paid), `--theme-text-secondary` (no record — a neutral state, NOT `--theme-color-error`).

## Phase D: New Page

- [x] D.1 Create `app/(app)/deudas/page.tsx` — `'use client'`, `useEffect` on mount, `Promise.all([fetchDeudaAccounts(), fetchPagosPorPeriodo(getCurrentPeriodo())])` (mirrors `app/(app)/reportes/page.tsx`'s fetch pattern), merge accounts + pagos client-side via a `Map` keyed on `cuenta.id === pago.cuentaId` into `DeudaAccountWithPago[]`, render one `DeudaPaymentCard` per account, plus loading/error/empty states.
- [x] D.2 In `page.tsx`, wire `onSavePlaneado` to `upsertMontoPlaneado(...)` and `onMarcarPagado` to `marcarPagado(...)`; on success, patch the returned `DeudaPago` into local state in place — no refetch of the full list.
- [x] D.3 Create `app/(app)/deudas/page.css` — page layout using `--theme-*` tokens (this route is a normal app page, unlike `/reportes`), list spacing, empty-state styling.

## Phase C/D Amendment (2026-08-14): Per-account `periodo` rework

Real requirements change after user testing of PR 1-3 — see design.md's "Amendment (2026-08-14)" section for full rationale. `periodo` moved from a single page-wide "current month" value to a per-account value derived from each account's own `dia_pago` via `nextDueDate()`, and the single edit flow became a 3-state model (`bloqueado` / `sin-registrar` / `pendiente` / `pagado`). The original C.1-C.4/D.1-D.3 tasks above remain checked as historical record (those files were genuinely created as described at the time); this amendment reworked their content, it did not undo the phase.

- [x] CD.1 Rework `components/deudas/deudas-service.ts`: remove `getCurrentPeriodo`, `fetchPagosPorPeriodo`, `upsertMontoPlaneado`; add `computePeriodoParaCuenta(cuenta, today?)`, `fetchLatestPagosPorCuentas(cuentaIds)`, `crearRegistroPago(cuentaId, periodo, monto)`, `updateMontoPlaneado(id, monto)`, `updatePeriodo(id, periodo)`; keep `fetchDeudaAccounts`/`marcarPagado` unchanged.
- [x] CD.2 Rework `components/deudas/deuda-payment-card.tsx` — derive a 4-value state (`bloqueado`/`sin-registrar`/`pendiente`/`pagado`) from `(pago, cuenta.dia_pago)`, pass it to `DeudaPaymentEdit`; render a read-only `dia_corte`/`dia_pago` subtitle, omitted when both are null.
- [x] CD.3 Rework `components/deudas/deuda-payment-card.css` — add `.deuda-payment-card__name-group`, `.deuda-payment-card__dias`, `.deuda-payment-card__badge--bloqueado`.
- [x] CD.4 Rework `components/deudas/deuda-payment-edit.tsx` — branch on the new `state` prop instead of `canMarcarPagado`; add the "Registrar pago" create flow (editable date picker + monto), the editable-periodo control for the `pendiente` state, and the "Registrar próximo pago" confirm-then-create flow for the `pagado` state (editable date picker defaulting to the recalculated periodo, confirmation text, monto input).
- [x] CD.5 Rework `components/deudas/deuda-payment-edit.css` — add `.deuda-payment-edit__date-input`, `.deuda-payment-edit__blocked-message`, `.deuda-payment-edit__confirm-text` (+ dark-mode rules).
- [x] CD.6 Rework `app/(app)/deudas/page.tsx` — replace `fetchPagosPorPeriodo(getCurrentPeriodo())` with sequential `fetchDeudaAccounts()` → `fetchLatestPagosPorCuentas(cuentaIds)`; local state becomes `Map<cuentaId, DeudaPago>`; wire `onCrear`/`onSaveMonto`/`onSavePeriodo`/`onMarcarPagado`; `patchPago` sets by `cuentaId` (insert-or-replace), not by row `id`.
- [x] CD.7 Amend `openspec/changes/2026-08-06-deuda-payment-tracking/design.md` and `specs/deuda-payment-tracking/spec.md` to document the new periodo model, function changes, and 3-state UI (this task).
- [ ] CD.8 **PENDING, requires live Supabase + human**: any `deuda_pago` test rows already created under the old shared-periodo (first-of-month) semantics may now look inconsistent with the new per-account due-date semantics — consider deleting them via the Supabase Table Editor before further manual testing.

## Phase C/D Amendment (2026-08-14): Table/month-tabs UI redesign

Real UX rework requested by the user after live-testing the card-based `/deudas` panel — see design.md's "Amendment (2026-08-14): Table/month-tabs UI redesign" section for full rationale. The collapsible-card list (`DeudaPaymentCard`/`DeudaPaymentEdit`) is retired in favor of a 12-month-tab selector plus a data-grid table, one row per active account per selected month. The per-account `periodo` data model from the prior (2026-08-14, earlier) amendment is unchanged — this is presentation-only.

- [x] CD2.1 Create `supabase/migrations/20260812000000_add_deuda_pago_notas.sql` (`ALTER TABLE deuda_pago ADD COLUMN notas TEXT;`) — written to disk, **not yet applied live** (operator action, same pattern as the original migration's A.4 task).
- [x] CD2.2 Rework `components/deudas/deudas-service.ts`: add `notas: string | null` to `DeudaPago` (+ `mapDeudaPago`); add `computePeriodoParaMes(diaPago, year, month)` (reuses `clampDayToMonth`); add `fetchPagosDelAnio(year)` (bounded year-range query); add `updateNotas(id, notas)`. Keep `computePeriodoParaCuenta`, `fetchLatestPagosPorCuentas`, `crearRegistroPago`, `updateMontoPlaneado`, `updatePeriodo`, `marcarPagado`, `fetchDeudaAccounts` unchanged.
- [x] CD2.3 Delete `components/deudas/deuda-payment-card.tsx` + `.css` and `components/deudas/deuda-payment-edit.tsx` + `.css` (confirmed via grep: no remaining references anywhere in the codebase before deletion).
- [x] CD2.4 Create `components/deudas/deuda-month-tabs.tsx` + `.css` — 12-tab selector (Enero–Diciembre, current year only), default tab = current month, `role="tablist"`.
- [x] CD2.5 Create `components/deudas/deuda-payment-table.tsx` + `.css` — table/grid with columns Cuenta, Corte/Pago (read-only), Periodo (editable date picker only when `pendiente`), Monto planeado (editable when `sin-registrar`/`pendiente`), Monto pagado (read-only once `pagado`), Notas (editable text), Pagado (styled `DeudaPaidCheckbox` using `--theme-color-success` + `lucide-react` `Check`); includes a totals `<tfoot>` row (sum `monto_planeado` across rows with a record, sum `monto_pagado` across paid rows).
- [x] CD2.6 Rework `app/(app)/deudas/page.tsx` — `selectedMonth` state (0-indexed, defaults to current month), year fixed to current year; `Promise.all([fetchDeudaAccounts(), fetchPagosDelAnio(currentYear)])` on mount; build the account×month row matrix via `useMemo` (month-bucket the flat year list by ISO-string-sliced month, map every account to `{ cuenta, pago }`); wire `onCrear`/`onSaveMonto`/`onSavePeriodo`/`onSaveNotas`/`onMarcarPagado`; `patchPago` inserts-or-replaces by row `id` in the flat `DeudaPago[]` list. Compose `DeudaMonthTabs` + `DeudaPaymentTable`.
- [x] CD2.7 Update `app/(app)/deudas/page.css` — remove the retired card-list grid styles, widen `max-width` for the table layout.
- [x] CD2.8 Amend `openspec/changes/2026-08-06-deuda-payment-tracking/design.md`, `specs/deuda-payment-tracking/spec.md`, and this tasks.md (this task) to document the table/month-tabs redesign, the new `notas` column, the new service functions, and the account×month row model.
- [ ] CD2.9 **PENDING, requires live Supabase + human**: apply `20260812000000_add_deuda_pago_notas.sql` against the live Supabase project. Until applied, `notas` reads as `null` on every row and `updateNotas` will fail live. Reload `/deudas` after applying it.
- [ ] CD2.10 **PENDING, requires human + browser**: manually verify month-tab switching, per-month row states (`bloqueado`/`sin-registrar`/`pendiente`/`pagado`), inline edits (periodo/monto/notas), the styled checkbox's `marcarPagado` prompt flow, and the totals row's sums, across at least 2 different month tabs and both light/dark mode.

## Phase E: Dashboard Widget Integration (`/reportes`)

- [ ] E.1 Modify `components/patrimonio/patrimonio-service.ts`'s `VencimientoCuenta` interface — add `montoPlaneado?: number`, `montoPagado?: number`, `pagado?: boolean` (all optional; present only when a `deuda_pago` row exists for the current period).
- [ ] E.2 Modify `fetchProximosVencimientos()` in the same file — add `.eq('tipo', 'deuda')` to the existing `cuenta` query (alongside `activa=true` and `dia_pago IS NOT NULL`); return early (`return vencimientos`) when the vencimientos list is empty, skipping the second query entirely.
- [ ] E.3 In the same function, when vencimientos is non-empty: query `deuda_pago` for `periodo = toISODate(startOfMonth(today))` and `cuenta_id IN (vencimientos.map(v => v.id))` (reuse the already-imported `startOfMonth`/`toISODate` — no new import needed), merge into the result via a `Map` keyed by `cuenta_id`, populating `montoPlaneado`/`pagado`/`montoPagado` only for matched accounts.
- [ ] E.4 Modify `components/patrimonio/patrimonio-vencimientos.tsx` — add a `formatMonto` helper (`Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })`) and render a `patrimonio-vencimiento-strip__monto` span only when `v.montoPlaneado !== undefined`, showing `v.montoPagado` when `v.pagado && v.montoPagado !== undefined`, else `v.montoPlaneado`; wrap the monto span + existing `diasRestantes` label in a new `patrimonio-vencimiento-strip__right` container.
- [ ] E.5 Modify `components/patrimonio/patrimonio-vencimientos.css` — add `.patrimonio-vencimiento-strip__right` (flex row, `gap: 12px`), `.patrimonio-vencimiento-strip__monto` (`color: var(--ink-dim)`), `.patrimonio-vencimiento-strip__monto--pagado` (`color: var(--up)`). **These MUST use `.patrimonio-page`'s isolated tokens (`--ink-dim`/`--up` from `patrimonio-tokens.css`), NOT `--theme-*`** — this page is contractually theme-isolated (archived `add-dashboard-patrimonio` design's "Color system isolation" decision, still binding). Verify with a `theme-` grep against this file returning zero matches before considering Phase E done.

## Phase F: Sidebar

- [ ] F.1 Modify `components/app-shell/sidebar.tsx` — add `CreditCard` to the `lucide-react` import list, and insert `{ href: '/deudas', label: 'Deudas', icon: CreditCard }` into `NAV_ITEMS` immediately after the Patrimonio entry (`/reportes`) and before the `comingSoon: true` Configuración entry — Configuración must remain last.

## Phase G: Manual Verification (no automated test runner in this project)

Mirrors design.md's Testing Strategy table:

- [ ] G.1 **PENDING, requires live Supabase + human**: create a planned amount on `/deudas` for an account with no prior record — row created in `deuda_pago` (`pagado=false`, `monto_pagado=null`); badge shows "Planeado $X".
- [ ] G.2 **PENDING, requires live Supabase + human**: mark a card paid with a `monto_pagado` that differs from `monto_planeado` (both a partial and an extra-payment case) — both values persist independently in the row; badge switches to "Pagado $Y".
- [ ] G.3 **PENDING, requires live Supabase + human**: edit `monto_planeado` on an already-paid card — `pagado`/`monto_pagado` remain untouched (per B.6's upsert payload omission); badge stays "Pagado".
- [ ] G.4 **PENDING, requires live Supabase + human**: manually insert a second `deuda_pago` row for the same `cuenta_id` with a past `periodo` via the Supabase SQL editor, reload `/deudas` — current-period fetch only returns the current-period row; the past row is untouched, confirming `UNIQUE (cuenta_id, periodo)` allows multiple periods per account without collision.
- [ ] G.5 **PENDING, requires live Supabase + human**: zero `tipo='deuda'` accounts (or none `activa`) — `/deudas` renders an empty-state message, no crash.
- [ ] G.6 **PENDING, requires live Supabase + human**: on `/reportes`, compare a `tipo='deuda'` account with a current-period `deuda_pago` row vs. one without — monto renders next to the date only for the former; the latter is identical to pre-change date-only output.
- [ ] G.7 **PENDING, requires live Supabase + human**: spot-check live data for any account with `dia_pago` set but `tipo != 'deuda'` — confirm it no longer appears in "Próximo vencimiento" post-change (flagged in design.md as an apply-time verification, not a resolved design question).
- [ ] G.8 **PENDING, requires human + browser**: click "Deudas" in the sidebar — navigates to `/deudas`, link highlights active, no "Próximamente" badge.
- [ ] G.9 **PENDING, requires human + browser**: toggle `next-themes` light/dark on `/deudas` — card/badges/inputs respond via `--theme-*`; toggle on `/reportes` — widget colors stay unchanged (isolated tokens, per E.5).
- [ ] G.10 **PENDING**: run `npm run lint && npm run build` with zero errors.

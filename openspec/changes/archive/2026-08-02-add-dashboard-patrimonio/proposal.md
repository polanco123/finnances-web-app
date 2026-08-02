# Proposal: Dashboard de Patrimonio

## Why

The sidebar already reserves a "Reportes" placeholder route (`app/(app)/reportes/page.tsx`, currently a 5-line `<ComingSoon>` stub) with no functional page behind it. Today the user has no single-screen view of net worth, no history of how it's trending, no visibility into how much of it is actually available vs. locked in retirement accounts, no in-context view of the weekly diversión fund status, no reminder of upcoming credit-card due dates, and no signal for which spending categories are running hot this month. Each of these facts currently requires manually cross-referencing `/cuentas`, `/diversion`, and mental math. This change turns the placeholder into a real net-worth dashboard fed by live Supabase data, replicating a user-provided static HTML/CSS prototype exactly.

## What Changes

- Replace the `/reportes` `<ComingSoon>` stub with a functional dashboard page, and rename the sidebar entry from "Reportes" to "Patrimonio" (`comingSoon` flag removed), following the exact precedent already used when `/cuentas` graduated from placeholder (`2026-07-17-cuentas-overview`).
- Add `cuenta.es_fondo_retiro BOOLEAN NOT NULL DEFAULT FALSE`, seeded `TRUE` for the five known retirement-fund accounts (Afore, Fintual PPR, GBM, Prestadero inversión, Yo te presto). This is deliberately **separate** from the existing `cuenta.tipo = 'retiro'` value — they overlap today but are conceptually distinct (a future `tipo: 'retiro'` account is not automatically locked/unavailable). Design/apply MUST preserve this distinction, not collapse it into a `tipo` check.
- Compute `patrimonio_neto = SUM(cuenta.saldo_real)` (active accounts), `retiro = SUM(saldo_real) WHERE es_fondo_retiro = true`, `disponible = patrimonio_neto - retiro`. Uses `saldo_real` exclusively — never `saldo_calculado` — for consistency with `/cuentas` (`openspec/specs/cuentas-overview/spec.md`), so the dashboard's net-worth figure always reconciles with `/cuentas`.
- Add table `patrimonio_snapshot` (`id UUID PK`, `fecha DATE NOT NULL UNIQUE`, `patrimonio_neto`, `patrimonio_disponible`, `total_activos`, `total_deudas` all `DECIMAL(14,2) NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, index on `fecha DESC`), written once daily by a new Supabase Edge Function + `pg_cron` job (`INSERT ... ON CONFLICT (fecha) DO UPDATE`, idempotent same-day re-runs). This is the project's first Edge Function/cron job. Feeds the dashboard's 14-day sparkline and delta-since-N-days chip. Recomputed against `saldo_real`, not `saldo_calculado` as the source spec originally suggested — this is a deliberate deviation, applied consistently everywhere `patrimonio_snapshot` is written or read.
- "Próximo vencimiento" is computed from existing `cuenta.dia_corte`/`cuenta.dia_pago` columns (already used for credit-card accounts), **not** from a `pago_mensual` table — that table does not exist in this project (verified: zero repo hits) and is out of scope to invent here. Stack multiple due-date strips, most urgent first, for every card whose `dia_pago` falls within a 7-day alert window.
- Fondo diversión block reuses `components/diversion/diversion-service.ts`'s `fetchActiveWeek`/`fetchWeekMovements` as-is for raw data; new derivation logic computes day-pips, spent/budget, percentage (>100% gradient-to-red), "excedido por $X"/"restante $X", and average-per-day — none of this exists today (`app/(app)/diversion/page.tsx`'s `dailyAllowance`/`daysLeft` logic is close but not equivalent).
- Categorías del mes: `ratio = gasto_categoria_mes_actual / promedio_categoria_3_meses_anteriores`; `ratio > 1.5` = hot (red), `> 1.15` = warm (amber), else neutral. Categories render neutral when less than 1 month of prior history exists. Fully greenfield — no existing month-over-month category aggregation.
- Visual fidelity: this page replicates the prototype's own color/font system exactly (`--bg: #0B0E14` and the rest of its `:root` palette; JetBrains Mono for every monetary figure/date, Inter for labels/UI), scoped to this page's own component tree only — it does **not** use this app's `--theme-*` tokens and does not leak its palette into any other page. No light-mode variant; this page is always dark regardless of the global `next-themes` toggle. Fonts load via `next/font/google` scoped to this page's component (not added to `app/layout.tsx`, which stays on `Geist` for the rest of the app).
- Sparkline (14 bars) and day-pips (7 dots) are hand-rolled `<div>`s with inline height/color, matching the prototype exactly — **not** Recharts, even though Recharts is already installed from the admin-panel-shell-redesign change.

## Non-Goals

- General bill/commitment tracking beyond credit-card `dia_corte`/`dia_pago` — a `pago_mensual`-style table is future scope.
- A light-mode variant of this dashboard.
- Creating/editing `patrimonio_snapshot` from the UI — read-only; the cron job is the only writer.
- Backfilling historical snapshots — the sparkline starts sparse and fills in day by day from ship date forward.
- Any change to `/` (the existing mock dashboard-home).
- A general-purpose theming-exception mechanism — this is a one-off scoped to this page, not a new pattern for other pages to adopt.

## Assumptions to Validate

- `cuenta.dia_corte`/`dia_pago` nullability and semantics are known from `docs/PROJECT_DOCUMENTATION.md` and `data/cuenta.ts`, not the live schema — confirm before the design phase finalizes the due-date query.
- RLS/grants on the new `patrimonio_snapshot` table and the Edge Function's execution role are unverified; if a permissions error surfaces, apply the same `GRANT` pattern already used for `fondo_semanal` in `components/diversion/diversion-service.ts`.
- `pg_cron` extension availability on the project's Supabase instance is unconfirmed; verify during design/apply before committing to the cron approach over an alternative (e.g. external scheduler hitting the Edge Function).

## Capabilities

### New Capabilities

- `patrimonio-snapshot`: the `patrimonio_snapshot` table plus the daily Edge Function/`pg_cron` job that populates it. Pure data-layer capability, no UI.
- `dashboard-patrimonio-net-worth`: net worth total (`SUM(saldo_real)`), 14-day sparkline trend, and disponible/retiro split — one cohesive requirement set built on the same `saldo_real`/`es_fondo_retiro` query and `patrimonio_snapshot` history.
- `dashboard-patrimonio-fondo-diversion`: weekly diversión fund status block (day-pips, spent/budget %, excedido/restante, average-per-day).
- `dashboard-patrimonio-proximo-vencimiento`: next credit-card due-date strip(s), including the multi-card stacking rule.
- `dashboard-patrimonio-categorias`: monthly category spend with hot/warm/normal heat-ratio coloring.

### Modified Capabilities

- `app-shell-navigation`: the "Placeholder navigation entries for future phases" requirement currently lists Reportes as one of three non-functional placeholders. This change removes Reportes from that scope, renames the entry to "Patrimonio", and adds it to "Functional sidebar navigation links" — the same treatment already applied to Cuentas.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/reportes/page.tsx` | Modified | Replace `<ComingSoon>` stub with the live dashboard, composing all five new capabilities |
| `components/app-shell/sidebar.tsx` | Modified | NAV_ITEMS Reportes entry: label → "Patrimonio", `comingSoon` removed |
| `openspec/specs/app-shell-navigation/spec.md` | Modified (delta) | Reportes moves from placeholder to functional link |
| Supabase `cuenta` table | Modified | New `es_fondo_retiro BOOLEAN NOT NULL DEFAULT FALSE` column + seed migration for 5 known accounts |
| Supabase `patrimonio_snapshot` table | New | Schema per Why/What Changes; index on `fecha DESC` |
| Supabase Edge Function + `pg_cron` | New | First cron/Edge Function infra in this project; daily upsert into `patrimonio_snapshot` |
| `components/diversion/diversion-service.ts` | Reused as-is | `fetchActiveWeek`/`fetchWeekMovements` consumed unchanged; no modifications |
| New patrimonio-scoped derivation logic (path TBD) | New | Day-pips/excedido/promedio-diario calc; design decides placement (extend `diversion-service.ts` vs. new module) |
| Route-local component tree under `reportes/` | New | Own CSS (prototype's exact palette), own `next/font/google` JetBrains Mono + Inter, hand-rolled sparkline/day-pip components — none of it shared with `--theme-*` |

## Resolved Decisions

All ambiguities the source material (external HTML prototype + spec doc) raised against this actual codebase have been resolved by the user; these are final commitments for spec/design, not open questions:

1. Net worth = `SUM(saldo_real)`, not `saldo_calculado` — matches `/cuentas` precedent.
2. `disponible`/`retiro` split derived from the same `saldo_real` query via the new `es_fondo_retiro` flag, kept deliberately separate from `cuenta.tipo`.
3. `patrimonio_snapshot` recomputed on `saldo_real` (a deviation from the external spec's original `saldo_calculado`-based SQL) — apply consistently.
4. "Próximo vencimiento" scoped down to `dia_corte`/`dia_pago` only — no general bill tracker; multi-card stacking within a 7-day window preserved from the external spec.
5. Fondo diversión block reuses existing `diversion-service.ts` fetches; all threshold/percentage/excedido math is new.
6. Category heat thresholds (`>1.5` hot, `>1.15` warm) and the <1-month-history neutral fallback are exactly as the external spec defined.
7. Visual system is the prototype's own palette/fonts, isolated to this route, no light mode, no leakage into `--theme-*`.
8. Sparkline/day-pips stay hand-rolled `<div>`s, not Recharts.
9. Fonts scoped locally via `next/font/google`, not added to the global `app/layout.tsx`.

## Rollback Plan

Revert `app/(app)/reportes/page.tsx` to the `<ComingSoon>` stub and the sidebar entry to `comingSoon: true`/label "Reportes". Drop the Edge Function and `pg_cron` schedule. `cuenta.es_fondo_retiro` and `patrimonio_snapshot` can remain in the schema unused (additive, non-breaking) or be dropped via a follow-up migration if a clean revert is required — neither is read by any other existing page.

## Success Criteria

- [ ] `/reportes` renders net worth, 14-day trend, disponible/retiro split, fondo diversión status, next due-date strip(s), and category heat coloring from live Supabase data.
- [ ] The net-worth figure always equals the sum shown on `/cuentas`.
- [ ] The daily snapshot job runs without duplicating rows on same-day re-execution.
- [ ] No `--theme-*` token or global font is affected by this page's styling.
- [ ] Sidebar shows "Patrimonio" as a functional link, no "Próximamente" badge.

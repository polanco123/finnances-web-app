# Tasks: Dashboard de Patrimonio

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1050-1250 (2 SQL migrations ~60, Edge Function ~50, 3 service/util files ~200, tokens/fonts ~70, 7 component+CSS pairs ~800-900, page.tsx composition ~120, sidebar.tsx ~5) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (forecast only — overridden below) |
| Delivery strategy | **size:exception** (user decision, 2026-07-25) |
| Chain strategy | N/A — single PR |

Decision needed before apply: **No — resolved.** The user explicitly accepted `size:exception` and chose to ship this change as **one single PR** covering Phases A-F, rather than splitting into the chained PRs suggested by the forecast below. The implementing LLM/session should NOT re-split this into multiple PRs; proceed as one PR/commit series against a single branch.

The phase ordering below (A → B → C → D → E → F) still MUST be respected internally as the implementation/commit sequence within that single PR — Phase A's operator-applied migration and Phase B's ordered deploy-then-cron-migration sequence in particular must land in that exact order even though they're no longer separate PR boundaries. Note Phase A.3/A.4 and Phase B's deploy/env-var/verify steps are live-infrastructure operator actions against real Supabase — these cannot be "undone" by a PR revert the way app code can, so apply them carefully and in order regardless of PR structure.

### Reference: Forecast's Suggested Work Units (informational only — not used, see decision above)

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Phase A — both SQL migration files created; migration 1 (schema) applied | ~60 lines |
| 2 | Phase B — Edge Function created + deployed + env var set; migration 2 (cron) applied after deploy; cron manually verified | ~50 lines + ops steps. Needs `es_fondo_retiro`/`patrimonio_snapshot` to exist first |
| 3 | Phase C — `patrimonio-service.ts`, `patrimonio-dates.ts`, `patrimonio-format.ts` | ~200 lines |
| 4 | Phase D part 1 — `patrimonio-fonts.ts`, `patrimonio-tokens.css`, Hero/Sparkline/Split components | ~380-420 lines |
| 5 | Phase D part 2 + Phase E — Fondo Diversión/Day-pips/Vencimientos/Categorías components, page composition, sidebar rename, 480px breakpoint | ~450-550 lines |
| 6 | Phase F — manual verification pass | 0 code lines, checklist only |

## Phase A: Database Migration (`patrimonio_snapshot` + `es_fondo_retiro`)

- [x] A.1 Create `supabase/migrations/20260724060000_add_patrimonio_snapshot.sql` with the exact SQL from design.md's "SQL migration" section verbatim: `ALTER TABLE cuenta ADD COLUMN es_fondo_retiro BOOLEAN NOT NULL DEFAULT FALSE`; seed `UPDATE cuenta SET es_fondo_retiro = TRUE WHERE nombre IN (...)` for the 5 named accounts; `CREATE TABLE patrimonio_snapshot` (id, fecha UNIQUE, 4 DECIMAL(14,2) columns, created_at); `CREATE INDEX idx_patrimonio_snapshot_fecha ON patrimonio_snapshot (fecha DESC)`; `ENABLE ROW LEVEL SECURITY`; `CREATE POLICY patrimonio_snapshot_select_authenticated`; `GRANT SELECT ... TO authenticated`. Do not paraphrase or reorder statements.
- [x] A.2 Create `supabase/migrations/20260724060100_setup_patrimonio_snapshot_cron.sql` with the exact SQL from design.md's "Cron setup" section verbatim: `CREATE EXTENSION IF NOT EXISTS pg_cron`, `CREATE EXTENSION IF NOT EXISTS pg_net`, `cron.schedule('patrimonio-snapshot-daily', '0 6 * * *', ...)` calling `net.http_post` against the deployed function URL. Leave `<PROJECT_REF>` and the service-role secret reference as placeholders — do not apply this file yet (see B.4).
- [x] A.3 **Operator action, live Supabase — DONE** (2026-08-02): `20260724060000_add_patrimonio_snapshot.sql` applied against the live project (column, table, index, and `authenticated` grant confirmed to exist). A follow-up `GRANT INSERT, UPDATE, SELECT ON public.patrimonio_snapshot TO service_role` was required and has been added to the migration file (the original grant only covered `authenticated`, causing a "permission denied" error on the Edge Function's first upsert attempt).
- [x] A.4 **Operator action — DONE** (2026-08-02): `pg_cron` and `pg_net` extensions confirmed available and enabled under Database → Extensions on the live project.

## Phase B: Daily Snapshot Job

- [x] B.1 Create `supabase/functions/patrimonio-snapshot-daily/index.ts` with the exact Deno code from design.md's "Edge Function" section verbatim: `createClient` via `jsr:@supabase/supabase-js@2` using `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env vars; `SELECT saldo_real, es_fondo_retiro FROM cuenta WHERE activa = true`; compute `totalActivos`/`totalDeudas`/`patrimonioNeto`/`retiro`/`patrimonioDisponible`; `upsert` into `patrimonio_snapshot` with `onConflict: 'fecha'`; 500 responses on fetch/upsert error.
- [x] B.2 **Operator action — DONE** (2026-08-02): deployed via `supabase functions deploy patrimonio-snapshot-daily`. `SUPABASE_SERVICE_ROLE_KEY` confirmed present automatically as a platform-injected Default Secret (legacy/deprecated in favor of the newer `SUPABASE_SECRET_KEYS`/JWT Signing Keys system, but still functional — no action needed for this change).
- [x] B.3 **Operator action — DONE** (2026-08-02, with a deviation from the original plan): `20260724060100_setup_patrimonio_snapshot_cron.sql` was rewritten to use `vault.decrypted_secrets` instead of the originally-planned `current_setting('app.settings.<SERVICE_ROLE_KEY>')` — the service-role key is stored via `vault.create_secret(..., '<SERVICE_ROLE_SECRET_NAME>')` rather than a Postgres database setting. `<PROJECT_REF>` was filled in with the live project ref.
- [x] B.4 **Operator action, live Supabase — DONE** (2026-08-02): `20260724060100_setup_patrimonio_snapshot_cron.sql` (Vault-based version) applied against the live project.
- [x] B.5 **Manual verify — DONE** (2026-08-02): function invoked twice via direct HTTP (`curl.exe`/`Invoke-RestMethod` with the publishable key, since `supabase functions invoke` is not an actual CLI subcommand — corrected mid-session). First call returned `{"ok":true,"fecha":"2026-08-01"}`; second call confirmed no duplicate `patrimonio_snapshot` row for the same date (idempotent upsert verified).

## Phase C: Read Queries

- [x] C.1 Create `components/patrimonio/patrimonio-service.ts` exporting interfaces `PatrimonioSnapshot`, `VencimientoCuenta`, `CategoriaHeat` and functions `fetchNetWorth(): Promise<number>` (sum `saldo_real` where `activa = true`), `fetchRetiroTotal(): Promise<number>` (same + `es_fondo_retiro = true`), `fetchSnapshotHistory(days: number): Promise<PatrimonioSnapshot[]>` (`ORDER BY fecha DESC LIMIT days`, `.reverse()` to ascending), `fetchProximosVencimientos(windowDays?: number): Promise<VencimientoCuenta[]>` (default 7, filter `0<=diasRestantes<=windowDays`, sort ascending), `fetchCategoriasDelMes(): Promise<CategoriaHeat[]>` (bounded 4-month `movimiento` fetch, client-side bucket/ratio per design.md's Interfaces section) — all via `@/lib/supabase/client`, throw-on-error, no `user_id` filter.
- [x] C.2 Create `components/patrimonio/patrimonio-dates.ts` exporting `getTodayLocal`, `getTodayLocalDate`, `startOfMonth`, `monthsAgoStart`, `addMonths`, `toISODate`, `clampDayToMonth(year, month, day)` (month 0-indexed, `min(day, lastDayOfMonth)`), `nextDueDate(diaPago, today)`, `diasRestantes(diaPago, today)` — implement per design.md's "Due-date algorithm" pseudocode exactly (clamp before comparing, roll to next month with year rollover at month 11).
- [x] C.3 Create `components/patrimonio/patrimonio-format.ts` exporting `formatMoney(amount)` and `formatDeltaLabel(current, previous)` (drives the "desde hace N días" delta chip label per `dashboard-patrimonio-net-worth` spec's "Comparison snapshot is not necessarily yesterday" scenario).
- [ ] C.4 **Manual verify — PENDING, requires live Supabase data + human**: `fetchCategoriasDelMes` returns `heat: 'normal'`, `ratio: null` when `trailingTotal` is 0/absent — no division-by-zero (spec scenario: category has no data before the current month).

## Phase D: UI Components (prototype-faithful)

- [x] D.1 Create `components/patrimonio/patrimonio-fonts.ts` — `JetBrains_Mono`/`Inter` `next/font/google` objects exactly as design.md specifies (`--font-jetbrains-mono`, `--font-inter` variables, weights, `display: 'swap'`); do NOT add these to `app/layout.tsx`.
- [x] D.2 Create `components/patrimonio/patrimonio-tokens.css` scoped under `.patrimonio-page` with the exact hex values from design.md's "Color isolation" section (`--bg:#0B0E14; --bg-raised:#12161F; --line:#262B38; --line-soft:#1B2029; --ink:#F2F0EA; --ink-dim:#8B92A5; --ink-faint:#545B6B; --up:#3FB68B; --up-dim:#1E4A3C; --down:#D9534F; --down-dim:#4A2422; --amber:#E8A33D; --amber-dim:#4A3A1E`) — no `.dark`/`.light`/`var(--theme-*)` reference anywhere in this file or any `components/patrimonio/**/*.css` file (verify via a `theme-` grep returning zero matches before D.10).
- [x] D.3 Create `components/patrimonio/patrimonio-hero.tsx` + `.css` — `PatrimonioHeroProps{netWorth, history}`, hero net-worth figure in JetBrains Mono, delta chip using `formatDeltaLabel` with `--up`/`--down` styling, empty/neutral state when no prior snapshot exists; embeds `PatrimonioSparkline`.
- [x] D.4 Create `components/patrimonio/patrimonio-sparkline.tsx` + `.css` — `PatrimonioSparklineProps{history}`, 14 hand-rolled `<div>` bars (NOT Recharts), renders fewer bars when history is sparse, no fabricated zero-padding.
- [x] D.5 Create `components/patrimonio/patrimonio-split.tsx` + `.css` — `PatrimonioSplitProps{disponible, retiro}`, 2-column grid, `.patrimonio-split__value--negative` in `--down` when disponible < 0, retiro sub-label "N cuentas".
- [x] D.6 Create `components/patrimonio/patrimonio-fondo-diversion.tsx` + `.css` — `PatrimonioFondoDiversionProps{budget, spent, daysLeft, daysElapsed}`, receipt-card visual with `::before`/`::after` notches, `.patrimonio-fondo__pct` amber ≤100% / red-gradient >100% capped at 100% width, footer "excedido por $X"/"restante $X" + average-per-day; embeds `PatrimonioDayPips`.
- [x] D.7 Create `components/patrimonio/patrimonio-day-pips.tsx` + `.css` — `PatrimonioDayPipsProps{totalDays, daysElapsed}`, 7-dot row: past days dark-gray, today amber, future days gray.
- [x] D.8 Create `components/patrimonio/patrimonio-vencimientos.tsx` + `.css` — `PatrimonioVencimientosProps{vencimientos}` (pre-sorted), stacked `.patrimonio-vencimiento-strip` elements, empty state renders nothing (no error) when the list is empty.
- [x] D.9 Create `components/patrimonio/patrimonio-categorias.tsx` + `.css` — `PatrimonioCategoriasProps{categorias}` (sorted by `gastoMes` desc), `.patrimonio-categoria-bar--hot|--warm|--normal`, bar-fill width proportional to the highest-spending category in the list.
- [x] D.10 Modify `app/(app)/reportes/page.tsx` — replace the `<ComingSoon>` stub with a `'use client'` composition: `useEffect` on mount, `Promise.all` of `fetchNetWorth`/`fetchRetiroTotal`/`fetchSnapshotHistory(14)`/`fetchProximosVencimientos(7)`/`fetchCategoriasDelMes` plus `fetchActiveWeek`/`fetchWeekMovements` (reused unchanged from `components/diversion/diversion-service.ts`); root wrapper `className={`${jetbrainsMono.variable} ${inter.variable} patrimonio-page`}`. **Acceptance criterion — structural fidelity is not optional**: render order must exactly match the prototype top to bottom: masthead → hero+sparkline → disponible/retiro split → fondo-diversión receipt-card (with notches) → vencimiento strip(s) → categorías bar-list → footer. Do not reinterpret, reorder, merge, or omit any of these sections.
- [x] D.11 Modify `components/app-shell/sidebar.tsx` — `NAV_ITEMS` `/reportes` entry: `label: 'Reportes' → 'Patrimonio'`, remove `comingSoon: true`.

## Phase E: Responsive (480px breakpoint)

- [x] E.1 In `patrimonio-hero.css`, add `@media (max-width: 480px)` reducing the hero figure from 56px to 40px, matching the prototype's exact breakpoint value (not a Tailwind/framework default — hand-authored to mirror the attached HTML prototype's own media query).
- [x] E.2 In `patrimonio-split.css`, add `@media (max-width: 480px)` collapsing the disponible/retiro grid from 2 columns to 1 column, matching the prototype's exact breakpoint.
- [ ] E.3 **Manual verify — PENDING, requires human + browser**: resize viewport to ≤480px on `/reportes` — hero number visibly shrinks, split grid stacks to 1 column, no horizontal overflow/clipping elsewhere in `.patrimonio-page`.

## Phase F: Manual Verification (no automated test runner in this project)

- [ ] F.1 **PENDING, requires live Supabase + human**: Net worth reconciles: hero figure on `/reportes` equals the `saldo_real` sum shown on `/cuentas`.
- [ ] F.2 **PENDING, requires live Supabase + human**: Sparse sparkline (day 1): with only 1 `patrimonio_snapshot` row, sparkline renders 1 bar, delta chip shows neutral/empty state, no crash.
- [ ] F.3 **PENDING, requires live Supabase + human**: Delta chip color: rising `patrimonio_neto` across snapshot rows renders `--up`/green; falling renders `--down`/red.
- [ ] F.4 **PENDING, requires live Supabase + human**: Disponible negative: force `retiro > netWorth` in test data — `.patrimonio-split__value--negative` applies, renders `--down`.
- [ ] F.5 **PENDING, requires live Supabase + human**: Fondo diversión overflow: `spent > budget` shows "excedido por $X", bar caps visually at 100% width, no layout break past 999%.
- [ ] F.6 **PENDING, requires live Supabase + human**: Day-pips: `daysElapsed` 0-7 — exactly that many pips render `--filled`, rest unfilled.
- [ ] F.7 **PENDING, requires live Supabase + human**: Vencimiento stacking: ≥2 cards within the 7-day window render strips ordered by ascending `diasRestantes` (soonest first).
- [ ] F.8 **PENDING, requires human**: Month-boundary clamping: `dia_pago=30` on a Feb "today" clamps the due date to Feb 28/29 and `diasRestantes` computes against the clamped date.
- [ ] F.9 **PENDING, requires live Supabase + human**: Categorías heat boundaries: ratios 1.14/1.16/1.5/1.51 and `trailingTotal=0` classify as normal/warm/warm/hot/normal (`ratio:null`) respectively — verify strict `>` boundaries, not `>=`.
- [ ] F.10 **PENDING, requires human + browser**: Prototype fidelity vs. theme toggle: toggle the app-wide `ThemeSwitcher` light/dark while on `/reportes` — no `--theme-*` value visibly shifts anything under `.patrimonio-page`.
- [ ] F.11 **PENDING, requires live Supabase + human**: Cron fires (cross-check with B.5): confirm the daily job produces exactly one row per `fecha`, no duplicates on re-run.
- [ ] F.12 **PARTIAL — `npm run lint && npm run build` run by this apply pass (see result below); sidebar-navigation/badge visual check still requires human + browser**: Sidebar: "Patrimonio" link navigates to `/reportes`, no "Próximamente" badge; run `npm run lint && npm run build` with zero errors.

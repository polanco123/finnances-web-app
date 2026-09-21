# Tasks: Dashboard `/` con datos reales de Supabase

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280-360 reviewable surface (`components/dashboard/dashboard-service.ts` ~130 new; `app/(app)/page.tsx` net ≈ −90 pero ~320 de superficie: ~250 líneas de mock borradas + ~160 de carga/props nuevas; `app/(app)/page.css` ~−25; delta spec ya redactado) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | **single-pr** — cambio acotado a la ruta `/`, sin migración ni módulos nuevos salvo `dashboard-service.ts` |
| Pre-PR review lens | `review-reliability` (regresión de comportamiento en un hot path: la home) + `review-readability`. No aplica el 4R completo: sin `auth/**`, `payments/**`, `security/**` ni diff > 400 líneas |

Decision needed before apply: **No** — single PR, sin decisión de encadenamiento pendiente.

Calibración: es un cambio de *read path* sin esquema, comparable en tamaño a `2026-08-01-categorias-gasto-periodo` (un service nuevo + una página), bastante más chico que un dominio nuevo tipo `metas-ahorro`/`presupuestos`. El grueso del diff es **borrado** de datos mock.

## Phase A: Service Layer (`components/dashboard/dashboard-service.ts`)

*Módulo nuevo. Sin dependencia de esquema. Bloquea la Phase B.*

- [x] A.1 Create `components/dashboard/dashboard-service.ts`. Imports: `createClient` from `@/lib/supabase/client`; `CATEGORIAS` from `@/lib/catalogs/catalog-store`; `getTodayLocalDate`, `startOfMonth`, `addMonths`, `toISODate` from `@/components/patrimonio/patrimonio-dates`; types `CategoriaConGasto` from `@/components/categorias/categorias-service` and `Cuenta` from `@/components/cuentas/cuentas-service`. Do **not** create `dashboard-dates.ts` and do **not** import from `components/presupuestos/`.
- [x] A.2 Export the three interfaces verbatim from design.md's "Interfaces / Contracts": `ResumenMes { ingresos; gastos; neto }`, `PuntoTendencia { anio; mes; etiqueta; total }`, `ResumenCategorias { totalGastado; compromisos; discrecionales }`.
- [x] A.3 Implement `fetchResumenMes(anio: number, mes: number, cuentaId?: string): Promise<ResumenMes>` — `SELECT monto, es_transferencia FROM movimiento WHERE fecha >= :desde AND fecha <= :hasta [AND cuenta_id = :cuentaId]`, where `desde` = 1st of the month and `hasta` = last day of the month (`new Date(anio, mes, 0).getDate()` for month length; both ISO `YYYY-MM-DD`). Client-side: skip rows where `es_transferencia === true` (legacy rows may be `null` — only strict `true` is a transfer). `ingresos = Σ monto` for `monto > 0`; `gastos = Σ |monto|` for `monto < 0`; `neto = ingresos - gastos`. No rows ⇒ `{ 0, 0, 0 }`; only a Supabase error throws.
- [x] A.4 Implement `fetchGastoMensualTrailing(meses: number = 6): Promise<PuntoTendencia[]>` — one `SELECT monto, fecha, es_transferencia FROM movimiento WHERE fecha >= :rangeStart AND fecha < :rangeEndExclusive AND monto < 0`, where `rangeStart = toISODate(addMonths(startOfMonth(getTodayLocalDate()), -(meses - 1)))` and `rangeEndExclusive = toISODate(addMonths(startOfMonth(getTodayLocalDate()), 1))`. Exclude `es_transferencia === true` client-side (the trend sums raw `monto < 0` without a `tipo` filter, so transfers must be dropped explicitly — unlike `fetchCategoriasConGasto`). Aggregate `Σ |monto|` per `(anio, mes)` bucket; zero-fill every month in the window that has no gasto; return ascending by `(anio, mes)`. `etiqueta` via `new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' })` on the bucket's first day. Same bounded-fetch pattern as `patrimonio-service.ts`'s `fetchCategoriasDelMes`.
- [x] A.5 Implement `resumirMes(categorias: CategoriaConGasto[]): ResumenCategorias` — **pure, no Supabase**. For each entry find `CATEGORIAS.find(c => c.id === categoria.categoriaId)` to read `tipo`. `compromisos = Σ total` where `tipo ∈ { 'compromiso', 'trabajo', 'hogar' }`; `discrecionales = Σ total` where `tipo ∈ { 'discrecional', 'suscripcion' }`; `totalGastado = Σ total` over all entries (a category with no catalog match still counts in `totalGastado`, neither bucket).
- [x] A.6 Implement `fetchDashboardData(): Promise<{ netWorth; cuentas; categorias; resumenMes; tendencia }>` — `Promise.all` of `fetchNetWorth()` (patrimonio-service), `fetchActiveCuentas()` (cuentas-service), `fetchCategoriasConGasto(desde, hasta)` (categorias-service, current-month range as in A.3), `fetchGastoMensualTrailing(6)`. Then `resumenMes = resumirMes(categorias)`. **Do not** load the account-scoped slice here (resumen del mes + últimos movimientos) — the page loads that separately.
- [x] A.7 MANUAL: trace A.4's `rangeStart`/`rangeEndExclusive` for a run in January (year rollover into the previous year) and confirm the window is exactly `meses` buckets including the current month; trace A.3's `hasta` for a 28/29/30/31-day month. Confirm a two-leg transfer contributes 0 to both `fetchResumenMes` and `fetchGastoMensualTrailing`.

## Phase B: Page Rewrite (`app/(app)/page.tsx` + `app/(app)/page.css`)

*Depends on Phase A.*

- [x] B.1 In `app/(app)/page.tsx`, delete every mock artifact: interfaces `MockMovimiento` / `MockCategoria` / `MockCuenta`; `MESES`; `MOCK_CUENTAS`; `MOCK_MOVIMIENTOS`; `MOCK_CATEGORIAS_JUL/JUN/MAY/ABR`; `CATEGORIAS_MAP`; `ICON_MAP`; `getIcon`; `formatDate`; `getMonthLabel`. Keep `CHART_COLORS`, `currencyFormatter` / `formatCurrency`, and the `useTheme` + `mounted` chart-color logic.
- [x] B.2 Rewrite `DashboardContent` state to `{ globalData, scopedData, loading, error }` + `cuentaSeleccionada` (`useState('all')`). Compute `today = getTodayLocalDate()`, `desde` / `hasta` (current-month range, shared with A.3/A.6), `(anio, mes) = (today.getFullYear(), today.getMonth() + 1)`, and `mesLabel` via `new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })` on `startOfMonth(today)`.
- [x] B.3 `useEffect([])`: call `fetchDashboardData()`, set `globalData`, handle `loading` / `error` exactly like `app/(app)/reportes/page.tsx`.
- [x] B.4 `useEffect([cuentaSeleccionada])`: `Promise.all` of `fetchResumenMes(anio, mes, cuentaSeleccionada === 'all' ? undefined : cuentaSeleccionada)` and `recentMovimientos(cuentaSeleccionada)` (B.5). Compute `balance = cuentaSeleccionada === 'all' ? globalData.netWorth : globalData.cuentas.find(c => c.id === cuentaSeleccionada)?.saldo_calculado ?? 0`. Set `scopedData`. Guard against running before `globalData` is loaded.
- [x] B.5 Add a `recentMovimientos(cuentaId)` helper: if `cuentaId === 'all'` → `fetchMovimientosPage(null, 10)` then `groupMovimientos(rows)`. Else → `fetchRecentMovimientos(cuentaId, 10)` + `fetchTransferSiblings` for the distinct `transferencia_id`s, merge the paired legs into the list, sort by `fecha`+`hora` desc, then `groupMovimientos`. Replicate the merge logic from `app/(app)/cuentas/page.tsx:87-120` (do not re-invent it).
- [x] B.6 Remove the "Período" `<select>` card entirely. Keep the "Cuenta" `<select>` card, its `options` now `globalData.cuentas` (`c.id` / `c.nombre`), plus a leading "Todas las cuentas" option with value `'all'`.
- [x] B.7 `BalanceCard` — new props `{ balance, ingresos, gastos, neto, cuentaLabel, mesLabel }`. `cuentaLabel` = `'Todas las cuentas'` or the selected `cuenta.nombre`. Drop its internal `useMemo` over `MOCK_CUENTAS` and the `MOCK_MOVIMIENTOS` reductions.
- [x] B.8 `CategoryBars` — new props `{ categorias: CategoriaConGasto[], colors }`. `BarChart data={categorias}` (already sorted desc by `fetchCategoriasConGasto`), `YAxis dataKey="nombre"`, `Bar dataKey="total"`. Height stays `categorias.length * 40 + 20`. Empty `categorias` ⇒ render the card with an empty-state line, no crash.
- [x] B.9 `MonthlySummary` — new prop `{ resumen: ResumenCategorias }`. Render `resumen.totalGastado` / `resumen.compromisos` / `resumen.discrecionales` in the existing three `summary-stat` slots. Drop the `CATEGORIAS_MAP` lookup and the local `tipo` filtering.
- [x] B.10 `TrendChart` — new props `{ tendencia: PuntoTendencia[], colors }`. `AreaChart data={tendencia}`, `XAxis dataKey="etiqueta"`, `Area dataKey="total"`. Drop the `[...MESES].reverse().map(...)` mock derivation.
- [x] B.11 `MovementsList` — new prop `{ items: DisplayItem[] }`. Render `items.map(item => item.kind === 'merged-transfer' ? <MovementTransferCard .../> : <MovementListItem movimiento={item.data} />)`, mirroring `app/(app)/movimientos/page.tsx` / `cuentas-card.tsx`. Remove the `movement-row` markup and the `getIcon` / `formatDate` calls. Empty `items` ⇒ show a "Sin movimientos" line.
- [x] B.12 `AccountCards` — props stay `{ cuentas, cuentaId, onCuentaChange }` but `cuentas` is now `Cuenta[]` from `fetchActiveCuentas()`; pill balance from `c.saldo_calculado`, pill classes from its sign. Keep the toggle-to-`'all'` behavior.
- [x] B.13 `app/(app)/page.css` — remove the `.movement-row`, `.movement-row__*` rules now that `MovementListItem` brings its own CSS; keep the `.dashboard*`, `.dash-card*`, `.dash-chart`, `.balance-card*`, `.account-*`, `.summary-*` layout rules. **Before deleting**, grep the codebase for each `.movement-row*` selector to confirm no other card reuses it.
- [x] B.14 MANUAL: `npm run lint` — zero new errors vs. the pre-existing baseline (same scoping precedent as `2026-08-01-categorias-gasto-periodo`).
- [x] B.15 MANUAL: `npm run build` — zero errors; `/` still listed as a route. (Builds may intermittently fail on a transient `fonts.gstatic.com` fetch unrelated to this change — retry once.)

## Phase C: Spec Delta Confirmation

- [x] C.1 Confirm `openspec/changes/2026-09-06-dashboard-datos-reales/specs/dashboard-home/spec.md` merges cleanly into `openspec/specs/dashboard-home/spec.md` at archive time — checkpoint only, no authoring here. Check: the `## MODIFIED Requirements` block's `### Requirement: At least one Recharts chart` heading matches the main spec's heading verbatim (replace-in-place); the `## REMOVED Requirements` block's `### Requirement: KPI/summary data display (mock data)` matches the main spec heading to be dropped; the two `## ADDED Requirements` (`KPI/summary data display (live Supabase data)`, `Dashboard is scoped to the current calendar month`) do not collide with any existing heading.

## Phase D: Manual Verification (no automated test runner in this project)

Mirrors design.md's `Verificación` table — reference it directly, do not re-derive the scenario list here.

- [x] D.1 `grep -n "MOCK_\|CATEGORIAS_MAP\|MESES" app/(app)/page.tsx` returns nothing.
- [ ] D.2 Cross-check: dashboard "Balance general" (cuenta = Todas) equals `/reportes`' patrimonio and the sum of `/cuentas` account balances.
- [ ] D.3 Cross-check: dashboard "Top categorías — gasto" per-category amounts equal `/categorias` for the current month.
- [ ] D.4 Select a specific account: "Balance general" becomes that account's `saldo_calculado`; ingresos/gastos/neto come only from that account; "Últimos movimientos" switches to that account's 10 (transfers shown as one merged card); "Top categorías", "Resumen mensual", "Tendencia" do not change.
- [ ] D.5 A month with at least one inter-account transfer: ingresos, gastos, neto and every trend point are unaffected by that transfer.
- [ ] D.6 "Resumen mensual": Compromisos = Σ `compromiso`+`trabajo`+`hogar`; Discrecionales = Σ `discrecional`+`suscripcion`; total = Σ all gasto categories.
- [ ] D.7 "Tendencia mensual": 6 points (current month + 5 prior), each equal to that month's real gasto.
- [ ] D.8 No "Período" card in the grid; the "Cuenta" card lists real accounts.
- [ ] D.9 Empty month / freshly-seeded env: zeros and empty lists/charts, no thrown error.
- [ ] D.10 Rapidly toggle account pills: only balance + últimos movimientos reload; tendencia and account cards do not flicker.
- [ ] D.11 Toggle dark mode: all cards, text, chart axes and series use dark `--theme-*` / `CHART_COLORS.dark` — no regression vs. the current dashboard.
- [ ] D.12 Open `/` signed out → redirect to `/auth/login` (proxy, unchanged).

---

The Review Workload Forecast is at the top of this file. Single PR; reviewed with `review-reliability` + `review-readability` before merge.

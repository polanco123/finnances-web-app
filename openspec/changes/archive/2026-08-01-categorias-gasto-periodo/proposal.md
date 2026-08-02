## Why

`/categorias` is a 5-line `<ComingSoon>` stub (`app/(app)/categorias/page.tsx`); the sidebar entry still carries `comingSoon: true` (`components/app-shell/sidebar.tsx:28`). Today there is no in-app way to see "how much am I spending per category, over what timeframe" — the user has to reconstruct that manually from `/movimientos`. This change graduates Categorías into a real page: categories ranked by total gasto within a selectable period, each expandable to its movimientos.

While exploring the aggregation logic, a real numeric-divergence risk surfaced: `components/patrimonio/patrimonio-service.ts`'s `fetchCategoriasDelMes()` (dashboard `/reportes` → "Categorías del mes") has no `tipo` filter, so it can fold Transferencia's negative-origen leg and any `sistema`/`ingreso` rows into "category spend." The new `/categorias` page must exclude those by requirement, so left unreconciled, `/reportes` and `/categorias` would show different totals for the same month under the same label. This change fixes that in the same PR rather than shipping a known inconsistency.

## What Changes

- New `/categorias` route: categories (where `tipo` NOT IN `('ingreso','sistema')`) ranked by total gasto descending, each card showing name, movimiento count, total spent, and % of the sum of all listed categories' totals for the active period.
- 6 period filters, default **mensual**: día (today), semanal (Mon-Sun, current week), quincenal (day 1-15 or day 16–end-of-month, whichever half contains today), mensual (current calendar month), anual (current calendar year), por periodo (custom start+end date range). No prior/next period navigation — always the current period for the active filter.
- Cards collapsed by default; click expands to that category's movimientos for the period, rendered via the existing `MovementListItem`.
- Fix `fetchCategoriasDelMes()` to apply the same `tipo NOT IN ('ingreso','sistema')` filter, so `/reportes` and `/categorias` agree on "gasto in category X this month."

## Non-Goals

- Period navigation (previous/next) — deferred.
- Editing/creating/deleting categorías or movimientos from this page — read-only.
- Rendering `descripcion` in expanded movement rows — accepted `MovementListItem` limitation (see Resolved Decisions #6).
- A shared/consolidated date-utility library — each feature folder keeps its own date helpers, per established convention.
- Real-time/live-updating totals — refetch on load/filter-change is sufficient.
- Categories with zero gasto in the period — only categories with ≥1 qualifying movimiento appear.

## Capabilities

### New Capabilities
- `categorias-gasto-periodo`: the `/categorias` page — period-filtered, per-category gasto ranking with expandable movimiento drill-down.

### Modified Capabilities
- `app-shell-navigation`: Categorías sidebar entry moves from placeholder to functional link (mirrors the Cuentas/Patrimonio graduation precedent).
- `dashboard-patrimonio-categorias`: `fetchCategoriasDelMes()` gains the `tipo NOT IN ('ingreso','sistema')` filter — same requirement, corrected data.

## Resolved Decisions

Final — resolved via two question rounds with the user; not open for re-litigation, though corrections are welcome if something reads wrong:

1. **Category scope**: `tipo` IN `('compromiso','discrecional','suscripcion','trabajo','hogar')`. Excludes Transferencia/Ajuste (`tipo: sistema`) and all `tipo: ingreso` categories, per `data/categoria.ts`. Rationale: transferencia rows are matched positive/negative pairs (`components/movement/movement-grouping.ts`), so including that category sums to ~$0 and distorts "gasto por categoría"; ingreso isn't gasto by definition.
2. **Period definitions**: as listed in What Changes. Semanal reuses the Mon-Sun convention already established by `getCurrentWeekRange()` (`components/diversion/diversion-week-range.ts`). Quincenal and por-periodo are fully greenfield (confirmed via grep: zero prior quincena logic, zero date-range-picker precedent — only single `<input type="date">` fields exist today).
3. **No period navigation this phase** — future scope, not built now.
4. **Card sort/content**: sorted by total gasto descending; percentage is share of the sum of all *listed* (period-qualifying) categories' totals, so visible percentages sum to ~100%.
5. **Collapsible pattern**: mirror `components/cuentas/cuentas-card.tsx` exactly — `useState(false)` for `expanded`, `<button aria-expanded>` header, `ChevronDown` from `lucide-react` rotating via a CSS state class, `{expanded && (...)}` body. Freshest same-codebase precedent; do not introduce a different accordion approach.
6. **Expanded rows reuse `MovementListItem` as-is** (not a new component) — accepted tradeoff: it never renders `descripcion` (present in its prop type, absent from its JSX, `components/movement/movement-list-item.tsx` lines 46-92), so the informal "description + amount + date" expectation is not matched exactly. Chosen deliberately for consistency with `/movimientos` and `/cuentas` card styling over building a divergent one-off component.
7. **Dashboard consistency fix**: see Modified Capabilities above.
8. **No live `categoria` table query**: reuse the static `data/categoria.ts` / `lib/catalogs/categorias.js` catalog for id→tipo/nombre resolution client-side, same source already trusted by `movement-list-item.tsx`'s `resolveCatalogName`. No per-user category customization exists in this data model.
9. **New bulk date-range fetch required**: `fetchMovimientosPage()` (`components/movement/movement-service.ts`) is cursor-paginated for the infinite-scroll list and unsuitable here. A new function (e.g. `fetchMovimientosEnPeriodo(fechaInicio, fechaFinExclusiva)`) is needed: one bounded Supabase fetch + 100% client-side `Map`/`.reduce()` aggregation — same architectural pattern as `fetchCategoriasDelMes()` (no RPC, no server-side GROUP BY, this project's established convention) but parameterized by an arbitrary caller-supplied range instead of hardcoded to trailing 3 months.

**Accepted, not silently fixed**: `components/diversion/diversion-week-range.ts` and `components/patrimonio/patrimonio-dates.ts` each already hand-roll their own `getTodayLocal()`. This change's new `components/categorias/categorias-dates.ts` will be a third near-duplicate — consistent with this codebase's established per-domain-folder convention (small scoped duplication over shared `lib/` utils, e.g. each of diversion/movement/cuentas having its own `formatCurrency`). Not consolidated here; flagged as a separate, future proposal if consolidation is ever wanted.

## Dependencies / Process Note

- `openspec/specs/dashboard-patrimonio-categorias/spec.md` does not exist yet as a canonical main spec — `add-dashboard-patrimonio` (the change that introduces it) is code-complete but not yet archived; its delta currently lives at `openspec/changes/add-dashboard-patrimonio/specs/dashboard-patrimonio-categorias/spec.md`. The sdd-spec phase for this change should target that content as the current source of truth for the Modified Capability delta, not assume a merged main spec.
- `openspec/specs/app-shell-navigation/spec.md` is likewise stale versus current code: it still lists "Reportes" as a placeholder even though `sidebar.tsx` already shows it as functional ("Patrimonio", no `comingSoon`) — that graduation is pending in the same unarchived `add-dashboard-patrimonio` change. This change's `app-shell-navigation` delta must be authored against current `sidebar.tsx` reality (only Categorías and Configuración remain `comingSoon: true`), not against the stale main-spec text verbatim.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/categorias/page.tsx` | Modified | Stub → real client page composing period filter, category cards, movimiento fetch |
| `app/(app)/categorias/page.css` | New | Page-level layout styles |
| `components/app-shell/sidebar.tsx:28` | Modified | Remove `comingSoon: true` on the Categorías entry |
| `components/categorias/categorias-service.ts` | New | `fetchMovimientosEnPeriodo()` bulk fetch + client-side per-categoria aggregation, tipo-filtered |
| `components/categorias/categorias-dates.ts` | New | día/semanal/quincenal/mensual/anual/por-periodo range functions |
| `components/categorias/categorias-card.tsx` + `.css` | New | Collapsible per-category card, mirrors `cuentas-card.tsx` |
| `components/categorias/categorias-period-filter.tsx` + `.css` | New | 6-option period selector incl. custom date-range picker |
| `components/patrimonio/patrimonio-service.ts` | Modified | `fetchCategoriasDelMes()` gains `tipo NOT IN ('ingreso','sistema')` filter |
| `components/movement/movement-list-item.tsx` | None | Reused as-is (see Resolved Decisions #6) |
| `data/categoria.ts`, `lib/catalogs/categorias.js` | None | Reused as-is for tipo/nombre resolution |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `fetchCategoriasDelMes()` fix changes dashboard totals users may have already seen (transferencia legs previously included) | Low-Med | Expected and intentional per Resolved Decision #7; numbers become smaller/more correct, not a regression |
| Quincenal/por-periodo UI is fully greenfield, no local precedent | Med | Design phase specifies exact boundary/inclusivity math and picker component before apply |
| `MovementListItem` reuse doesn't show `descripcion` | Low | Explicitly accepted tradeoff (#6), not a defect to fix silently later without a decision |
| Stale main specs (`app-shell-navigation`, missing `dashboard-patrimonio-categorias`) could cause sdd-spec to target the wrong base | Med | Flagged explicitly in Dependencies/Process Note above |

## Rollback Plan

New files (`components/categorias/*`, `app/(app)/categorias/page.css`) can be deleted and `app/(app)/categorias/page.tsx` reverted to the `<ComingSoon>` stub; `sidebar.tsx:28` reverts `comingSoon: true`. The `fetchCategoriasDelMes()` tipo-filter fix is a single-function diff in `patrimonio-service.ts`, revertible independently of the rest of the page.

## Success Criteria

- [ ] `/categorias` shows only `tipo` IN `('compromiso','discrecional','suscripcion','trabajo','hogar')` categories with ≥1 gasto movimiento in the active period, sorted by total gasto descending, percentages summing to ~100%.
- [ ] All 6 period filters produce the correct, greenfield-verified date ranges (quincenal half-boundary and por-periodo custom range included).
- [ ] Card expand/collapse matches `cuentas-card.tsx`'s interaction pattern exactly.
- [ ] `/reportes`'s "Categorías del mes" and `/categorias`'s "mensual" filter report the same total for the same category in the same calendar month.
- [ ] Sidebar Categorías entry has no `comingSoon`/"Próximamente" badge.

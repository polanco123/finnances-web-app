# Delta for dashboard-home

## MODIFIED Requirements

### Requirement: At least one Recharts chart

The dashboard SHALL render at least one chart implemented with the Recharts library using live Supabase data for the current calendar month, rather than the prior mock category/trend data (and not the pre-redesign hand-rolled `category-bar__fill` bars).

(Previously: the chart was required to render with mock category or trend data. It now uses live data. The "Top categorías — gasto" `BarChart` is fed by `fetchCategoriasConGasto` for the current month; the "Tendencia mensual" `AreaChart` is fed by a trailing-months series aggregated client-side from a single bounded `movimiento` fetch.)

#### Scenario: A Recharts chart renders with live category data

- GIVEN an authenticated user views `/`
- WHEN the dashboard renders
- THEN at least one chart built with Recharts SHALL be present and visibly rendered with live category-spending data for the current calendar month

#### Scenario: The trend chart renders a real trailing series

- GIVEN an authenticated user views `/`
- WHEN the dashboard renders the monthly-trend chart
- THEN its series SHALL be the real total gasto per month across the trailing-months window, aggregated from `movimiento` rows

#### Scenario: Chart reflects the selected account where in scope

- GIVEN the dashboard's account filter selection is changed
- WHEN the dashboard re-renders
- THEN any chart whose section is account-scoped SHALL update accordingly, and account-global charts (category breakdown, trend) SHALL remain unchanged, consistent with the rest of the dashboard

## ADDED Requirements

### Requirement: KPI/summary data display (live Supabase data)

The dashboard SHALL display, using live Supabase data for the current calendar month, five sections keeping the shape of `BalanceCard`, `CategoryBars`, `MovementsList`, `AccountCards`, and `MonthlySummary` in `app/(app)/page.tsx`: an overall balance summary (balance, income, expenses, net), a category-spending breakdown, a recent-movements list, an account list, and a monthly summary (total spent, compromisos, discrecionales).

The data sources SHALL be:
- Balance summary balance — `fetchNetWorth()` when the account filter is "all", otherwise the selected account's `saldo_calculado`.
- Balance summary income / expenses / net — `movimiento` rows dated within the current calendar month, `es_transferencia = true` excluded, income = `monto > 0`, expenses = `monto < 0`; scoped by `cuenta_id` when a specific account is selected.
- Category-spending breakdown — `fetchCategoriasConGasto(desde, hasta)` for the current calendar month.
- Recent-movements list — the 10 most recent `movimiento` rows via `fetchMovimientosPage`, with `categoria_id` and `cuenta_id` resolved to name/icon from the cached catalog and the loaded accounts (fallback `Sin categoría` / raw id).
- Account list — `fetchActiveCuentas()`; per-account balance from `saldo_calculado`.
- Monthly summary — derived from the same category-spending data, bucketed by `categoria.tipo`.

The account filter SHALL affect only the balance summary and the recent-movements list; the category breakdown, monthly summary, and trend SHALL remain global aggregates. No section SHALL be backed by mock data.

#### Scenario: Dashboard shows all five KPI sections with live data

- GIVEN an authenticated user views `/`
- WHEN the dashboard renders
- THEN it SHALL display a balance summary section, a category-spending breakdown section, a recent-movements list section, an account list section, and a monthly summary section, all populated from live Supabase queries for the current calendar month

#### Scenario: Balance summary reconciles with the account list

- GIVEN an authenticated user views `/` with the account filter set to "all"
- WHEN the dashboard renders
- THEN the balance summary balance SHALL equal `fetchNetWorth()`
- AND it SHALL equal the sum of the `saldo_calculado` values shown in the account list

#### Scenario: Income and expense totals exclude transfers

- GIVEN `movimiento` rows exist in the current calendar month, some with `es_transferencia = true`
- WHEN the balance summary computes income, expenses, and net
- THEN rows with `es_transferencia = true` SHALL NOT contribute to any of the three totals

#### Scenario: A month with no movements renders without error

- GIVEN the current calendar month has no `movimiento` rows
- WHEN the dashboard renders
- THEN the balance summary SHALL show income, expenses, and net as zero
- AND the category breakdown, recent-movements list, and trend SHALL render empty
- AND no query SHALL throw

#### Scenario: Account filter scopes the balance and recent movements

- GIVEN an authenticated user selects a specific account in the dashboard's account filter
- WHEN the dashboard re-renders
- THEN the balance summary balance SHALL be that account's `saldo_calculado`
- AND its income / expense / net SHALL be computed only from that account's movements
- AND the category breakdown, monthly summary, and trend SHALL remain unchanged

### Requirement: Dashboard is scoped to the current calendar month

The dashboard SHALL always present the current calendar month and SHALL NOT expose a month selector or free date-range picker. The month is resolved client-side from the current date, inside the existing `Page → Suspense → Content` wrapper.

#### Scenario: No month selector is present

- GIVEN an authenticated user views `/`
- WHEN the dashboard renders
- THEN there SHALL be no month or period selector control
- AND all month-scoped sections SHALL reflect the current calendar month

#### Scenario: Account selector lists real accounts

- GIVEN an authenticated user views `/`
- WHEN the account selector renders
- THEN its options SHALL be the active accounts from `fetchActiveCuentas()`, not a hardcoded list

## REMOVED Requirements

### Requirement: KPI/summary data display (mock data)

**Reason**: Replaced by "KPI/summary data display (live Supabase data)" — the dashboard now reads live Supabase data for the current calendar month instead of mock data, and the "no live Supabase query SHALL back any of these sections" clause no longer applies.

**Migration**: None. The five section shapes (`BalanceCard`, `CategoryBars`, `MovementsList`, `AccountCards`, `MonthlySummary`) are unchanged; only their data source moves from module constants to Supabase queries.

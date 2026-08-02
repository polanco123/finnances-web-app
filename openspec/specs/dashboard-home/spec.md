# dashboard-home

## Purpose

The restyled dashboard (KPI cards, category breakdown, movements list, account cards, monthly summary, and at least one chart) becomes the authenticated home page at `/`, replacing the prior public starter-template landing page. Mock data only this change; correct light/dark mode rendering is required.

## ADDED Requirements

### Requirement: `/` requires authentication
The root route `/` SHALL require an authenticated session, consistent with other protected routes in this application (e.g. `/movimientos`, `/diversion`).

#### Scenario: Unauthenticated request to `/` redirects to login
- GIVEN a request to `/` with no authenticated Supabase session (no user)
- WHEN the request is processed by the proxy/middleware
- THEN the system SHALL redirect the request to `/auth/login`

#### Scenario: Authenticated request to `/` renders the dashboard
- GIVEN a request to `/` with an authenticated Supabase session
- WHEN the request is processed
- THEN the system SHALL render the dashboard content, not a redirect and not the prior starter template

### Requirement: `/` renders the dashboard, replacing the starter template
The root route `/` SHALL render the dashboard content (KPIs + charts) as its entire page content. The prior starter-template landing page content (Hero, DeployButton, tutorial steps) SHALL NOT be present anywhere in the rendered output of `/`.

#### Scenario: Starter template content is gone
- GIVEN an authenticated user requests `/`
- WHEN the page renders
- THEN none of the prior starter-template elements (Hero section, DeployButton, tutorial/"next steps" content) SHALL appear in the rendered page

### Requirement: KPI/summary data display (mock data)
The dashboard SHALL display, using mock data (not live Supabase data this change): an overall balance summary (balance, income, expenses, net), a category-spending breakdown, a recent-movements list, an account list, and a monthly summary (total spent, compromisos, discrecionales) — matching the existing scenario shape of `BalanceCard`, `CategoryBars`, `MovementsList`, `AccountCards`, and `MonthlySummary` in the current `app/dashboard/page.tsx`.

#### Scenario: Dashboard shows all five KPI sections
- GIVEN an authenticated user views `/`
- WHEN the dashboard renders
- THEN it SHALL display a balance summary section, a category-spending breakdown section, a recent-movements list section, an account list section, and a monthly summary section, all populated with mock data
- AND no live Supabase query SHALL back any of these sections this change

### Requirement: At least one Recharts chart
The dashboard SHALL render at least one chart implemented with the Recharts library, using mock category or trend data, rather than the prior hand-rolled div-width bar (`category-bar__fill`) implementation.

#### Scenario: A Recharts chart renders with mock data
- GIVEN an authenticated user views `/`
- WHEN the dashboard renders
- THEN at least one chart built with Recharts SHALL be present and visibly rendered with mock category/trend data

#### Scenario: Chart reacts to existing dashboard filters
- GIVEN the dashboard's existing month or account filter selection is changed
- WHEN the dashboard re-renders
- THEN the Recharts chart's displayed data SHALL update accordingly, consistent with how the rest of the dashboard already reacts to those filters

### Requirement: Correct light/dark mode rendering
The dashboard SHALL render correctly in both light and dark mode using `lib/theme.css`'s `--theme-*` tokens via the `.dark` class, fixing the prior dead dark-mode bug in which dashboard styles used a `[data-theme="dark"]` selector that `next-themes`' `attribute="class"` configuration never sets.

#### Scenario: Dark mode actually applies to the dashboard
- GIVEN the active theme is dark (the `.dark` class is applied to the document root)
- WHEN `/` renders the dashboard
- THEN all dashboard surfaces (cards, text, balances, category bars/chart, movement rows, account pills, summary stats) SHALL visually reflect dark-mode colors sourced from `--theme-*` tokens
- AND no dashboard element SHALL remain rendered in its light-mode colors

#### Scenario: Light mode renders correctly
- GIVEN the active theme is light (no `.dark` class on the document root)
- WHEN `/` renders the dashboard
- THEN all dashboard surfaces SHALL render using the light-mode values of the `--theme-*` tokens

# dashboard-patrimonio-fondo-diversion

## Purpose

Read-only weekly Fondo Diversión status block on the Patrimonio dashboard (`/reportes`), derived from the same active-week and movement data already used by `/diversion`. Does not add, modify, or duplicate any diversión write behavior.

## ADDED Requirements

### Requirement: Reuses existing diversion data-fetching, no new writes

The system SHALL fetch the active week via `fetchActiveWeek` and its movements via `fetchWeekMovements` (both from `components/diversion/diversion-service.ts`) unchanged, and MUST NOT modify `fondo_semanal` or `movimiento` rows from this dashboard block.

#### Scenario: No active week for today

- GIVEN `fetchActiveWeek` resolves to `null` for today
- WHEN the Fondo Diversión block renders
- THEN it SHALL render an empty/inactive state
- AND MUST NOT throw an unhandled error
- AND MUST NOT render any create/edit affordance for `fondo_semanal`

#### Scenario: No mutation performed by this block

- GIVEN the Fondo Diversión block is rendered and interacted with (viewed, scrolled)
- WHEN its underlying network calls are inspected
- THEN no INSERT/UPDATE/DELETE SHALL be issued against `fondo_semanal` or `movimiento` by this block

### Requirement: Spent/budget percentage and color state

The system SHALL compute `percentage = spent / monto_presupuestado * 100` and color it amber when `percentage <= 100`, and with a red gradient when `percentage > 100`.

#### Scenario: Under budget shows amber

- GIVEN spent is 800 and `monto_presupuestado` is 1500 (53%)
- WHEN the percentage renders
- THEN it SHALL use amber styling

#### Scenario: Over budget shows red gradient

- GIVEN spent is 1800 and `monto_presupuestado` is 1500 (120%)
- WHEN the percentage renders
- THEN it SHALL use the red-gradient over-budget styling, not amber

### Requirement: Progress bar visually caps at 100% width

The system SHALL render the fill bar's width proportional to `percentage`, but MUST cap the rendered width at 100% of the bar's container even when `percentage` exceeds 100.

#### Scenario: Bar does not overflow its container

- GIVEN `percentage` computes to 150%
- WHEN the fill bar renders
- THEN the fill's visual width SHALL be capped at the container's full width (100%)
- AND MUST NOT extend beyond the container's bounds

### Requirement: Day-pips reflect each day of the active week

The system SHALL render 7 day-pips, one per day of the active week's date range, colored gray (future day, not yet reached), dark-gray (past day, already elapsed), or amber (today).

#### Scenario: Pip states across the week

- GIVEN the active week runs Monday through Sunday and today is Thursday
- WHEN the day-pips render
- THEN Monday through Wednesday SHALL render dark-gray
- AND Thursday SHALL render amber
- AND Friday through Sunday SHALL render gray

### Requirement: Footer shows excedido/restante and average per day

The system SHALL show "excedido por $X" (where `X = spent - monto_presupuestado`) when spent exceeds the budget, or "restante $X" (where `X = monto_presupuestado - spent`) otherwise, plus the average amount spent per day so far, computed as `spent / days elapsed since fecha_inicio through today, inclusive`.

#### Scenario: Under budget shows restante

- GIVEN spent is 800 and `monto_presupuestado` is 1500
- WHEN the footer renders
- THEN it SHALL show "restante $700"

#### Scenario: Over budget shows excedido

- GIVEN spent is 1800 and `monto_presupuestado` is 1500
- WHEN the footer renders
- THEN it SHALL show "excedido por $300"

#### Scenario: Average per day so far

- GIVEN the active week started 3 days ago, today is the 3rd day inclusive, and spent totals 600
- WHEN the footer renders
- THEN it SHALL show an average of 200 per day (600 / 3)

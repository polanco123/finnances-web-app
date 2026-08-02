# diversion-weekly-view

## Purpose

Read-only view of the current week's (Monday-Sunday) Diversión personal movimientos, scoped to whichever `fondo_semanal` row is active for today's date, plus a spent-vs-`monto_presupuestado` progress indicator. Historical weeks and rollover computation are out of scope.

## Requirements

### Requirement: Active week resolution
The system SHALL resolve the active `fondo_semanal` row as the one whose date range contains today's date.

#### Scenario: Active row exists
- **GIVEN** a `fondo_semanal` row exists where today falls within `[fecha_inicio, fecha_fin]`
- **WHEN** the `/diversion` view loads
- **THEN** the system SHALL fetch and use that row as the active budget context

#### Scenario: No active row for today
- **GIVEN** no `fondo_semanal` row's date range contains today
- **WHEN** the `/diversion` view loads
- **THEN** the system SHALL treat the week as having no active budget

### Requirement: Empty state when no active week
The system SHALL show an empty state when no `fondo_semanal` row is active, and MUST block expense registration in that state.

#### Scenario: No active week found
- **GIVEN** no active `fondo_semanal` row for today
- **WHEN** the `/diversion` view renders
- **THEN** the system SHALL display an empty state informing the user no budget is configured for the current week
- **AND** the system MUST NOT render the expense registration form

### Requirement: Movimientos list scoped to active week
The system SHALL list only Diversión personal movimientos whose date falls within the active `fondo_semanal` row's `[fecha_inicio, fecha_fin]` range.

#### Scenario: Movements within range
- **GIVEN** an active `fondo_semanal` row with a given date range
- **WHEN** the view loads
- **THEN** the system SHALL display only Diversión personal movimientos dated within that range

#### Scenario: No movements yet this week
- **GIVEN** an active `fondo_semanal` row with zero matching movimientos
- **WHEN** the view loads
- **THEN** the system SHALL display the list as empty without error, and SHALL still show the progress indicator

### Requirement: Spent calculation is net of income and refunds
The system SHALL compute "spent" as the sum of gasto movimientos minus the sum of ingreso/reembolso movimientos, all scoped to the Diversión personal categoria and the active week's date range.

#### Scenario: Only gasto movements exist
- **GIVEN** the active week has gasto movimientos totaling 500 and no ingreso/reembolso movimientos
- **WHEN** spent is computed
- **THEN** the system SHALL report spent as 500

#### Scenario: Gasto offset by reembolso
- **GIVEN** the active week has gasto movimientos totaling 500 and a reembolso movimiento of 100
- **WHEN** spent is computed
- **THEN** the system SHALL report spent as 400

### Requirement: Progress indicator
The system SHALL display a plain spent-vs-`monto_presupuestado` progress bar with no threshold-based visual states.

#### Scenario: Spent within budget
- **GIVEN** spent is less than `monto_presupuestado`
- **WHEN** the progress indicator renders
- **THEN** the system SHALL display the ratio as a proportionally filled bar with no color-based warning state

#### Scenario: Spent exceeds budget
- **GIVEN** spent is greater than `monto_presupuestado`
- **WHEN** the progress indicator renders
- **THEN** the system SHALL still render the bar (capped or overflow-indicated) without a distinct alert state

### Requirement: Daily allowance remaining
The system SHALL display how much the user can spend per day for the rest of the active week, computed from the remaining budget and the number of days left (inclusive of today) until the active week's `fecha_fin`. This requirement applies only when an active `fondo_semanal` row exists for today (see "Active week resolution" and "Empty state when no active week"); it does not apply in the no-active-week empty state.

`remaining = monto_presupuestado - spent`. `daysLeft` is the count of days from today through `fecha_fin`, inclusive of both endpoints. `dailyAllowance = floor(remaining / daysLeft)`, always rounded down, never clamped.

#### Scenario: Daily allowance for the rest of the week
- **GIVEN** an active week with `monto_presupuestado` 1500 and spent 565, so remaining is 935
- **AND** today is Thursday and the active week's `fecha_fin` is the following Sunday, so `daysLeft` is 4
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as 233 (935 / 4 = 233.75, floored)

#### Scenario: Overspent week shows a negative daily allowance
- **GIVEN** an active week where `remaining` is -50 and `daysLeft` is 2
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as -25
- **AND** the system SHALL NOT clamp the value to 0

#### Scenario: Last day of the active week
- **GIVEN** an active week where today equals `fecha_fin`, so `daysLeft` is 1
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as exactly `remaining` (floored), with no division applied beyond the floor
</content>
</invoke>

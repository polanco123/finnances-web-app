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
</content>
</invoke>

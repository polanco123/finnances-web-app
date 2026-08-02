# fondo-semanal-budget-config

## Purpose

Allow editing `monto_presupuestado` on the currently active `fondo_semanal` row directly from the `/diversion` view. Does not cover creating new rows, editing `fecha_inicio`/`fecha_fin`, or any historical row.

## Requirements

### Requirement: Edit scoped to active row only
The system SHALL only allow editing `monto_presupuestado` on the `fondo_semanal` row currently active for today; it MUST NOT expose editing for any other row.

#### Scenario: Active row is editable
- **GIVEN** an active `fondo_semanal` row exists for today
- **WHEN** the `/diversion` view loads
- **THEN** the system SHALL allow the user to edit that row's `monto_presupuestado`

#### Scenario: No active row means no edit control
- **GIVEN** no active `fondo_semanal` row exists for today
- **WHEN** the `/diversion` view loads
- **THEN** the system MUST NOT render a `monto_presupuestado` edit control

### Requirement: Unrestricted positive value update
The system SHALL accept any positive numeric value for `monto_presupuestado`, with no validation against amount already spent.

#### Scenario: Update to a value below current spent
- **GIVEN** current spent is 800 and the user sets `monto_presupuestado` to 500
- **WHEN** the update is submitted
- **THEN** the system SHALL accept and persist the value without blocking or warning

#### Scenario: Update to a larger value
- **GIVEN** the user sets `monto_presupuestado` to a value greater than the current value
- **WHEN** the update is submitted
- **THEN** the system SHALL accept and persist the new value

#### Scenario: Reject non-positive values
- **GIVEN** the user enters zero, a negative number, or a non-numeric value
- **WHEN** the user attempts to submit
- **THEN** the system SHALL block submission and SHALL display a validation error

### Requirement: Immutable date range
The system MUST NOT allow editing `fecha_inicio` or `fecha_fin` from this capability.

#### Scenario: No date fields exposed
- **WHEN** the budget edit control renders
- **THEN** it SHALL only expose `monto_presupuestado` for editing, with `fecha_inicio` and `fecha_fin` displayed as read-only (if shown at all)

### Requirement: Progress indicator reflects updated budget
The system SHALL recompute the spent-vs-budget progress indicator immediately after a successful `monto_presupuestado` update.

#### Scenario: Progress bar updates after edit
- **GIVEN** a successful `monto_presupuestado` update
- **WHEN** the update completes
- **THEN** the progress indicator SHALL re-render using the new `monto_presupuestado` value against the existing spent total

### Requirement: Update failure handling
The system SHALL surface an error and MUST NOT change the displayed `monto_presupuestado` when the update fails.

#### Scenario: Supabase update error
- **GIVEN** the Supabase update call fails
- **WHEN** the user submits a `monto_presupuestado` change
- **THEN** the system SHALL display an error message
- **AND** the displayed `monto_presupuestado` SHALL remain the previous value
</content>
</invoke>

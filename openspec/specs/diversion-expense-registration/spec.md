# diversion-expense-registration

## Purpose

Register a new gasto movimiento for the Diversión personal categoria directly from the `/diversion` view, mirroring the `components/movement/` form+mapper+service split in TypeScript. Editing or deleting existing movimientos is out of scope.

## Requirements

### Requirement: Registration blocked without active week
The system MUST block gasto registration when no `fondo_semanal` row is active for today.

#### Scenario: No active week
- **GIVEN** no `fondo_semanal` row is active for today
- **WHEN** the `/diversion` view renders
- **THEN** the system MUST NOT render the expense registration form
- **AND** the empty state SHALL be shown instead

### Requirement: Gasto movimiento creation
The system SHALL allow creating a new movimiento with `tipo: gasto` and `categoria_id` fixed to Diversión personal (`af6b676c-04db-4fda-b9f7-349123d75e1a`) when an active week exists.

#### Scenario: Valid submission
- **GIVEN** an active `fondo_semanal` row and a valid monto and cuenta selected
- **WHEN** the user submits the diversion expense form
- **THEN** the system SHALL insert a new movimiento with `tipo: gasto`, the Diversión personal `categoria_id`, the entered monto, cuenta, and date within the active week

#### Scenario: Missing required field
- **GIVEN** the user omits monto or cuenta
- **WHEN** the user attempts to submit
- **THEN** the system SHALL block submission and SHALL display a validation error

### Requirement: Immediate list and progress refresh
The system SHALL refresh the movimientos list and the spent-vs-budget progress indicator immediately after a successful registration.

#### Scenario: Successful registration updates view
- **GIVEN** a successful movimiento insert
- **WHEN** the insert completes
- **THEN** the new movimiento SHALL appear in the list
- **AND** the progress indicator SHALL reflect the updated spent total

### Requirement: Registration failure handling
The system SHALL surface an error and MUST NOT add an entry to the displayed list when the insert fails.

#### Scenario: Supabase insert error
- **GIVEN** the Supabase insert call fails
- **WHEN** the user submits the form
- **THEN** the system SHALL display an error message
- **AND** the movimientos list SHALL remain unchanged

### Requirement: Date defaults within active week
The system SHALL default the registered movimiento's date to today when today falls within the active week's range.

#### Scenario: Default date on submit
- **GIVEN** the user does not manually change the date field
- **WHEN** the form is submitted
- **THEN** the system SHALL record today's date as the movimiento's date
</content>
</invoke>

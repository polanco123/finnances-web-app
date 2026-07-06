## ADDED Requirements

### Requirement: Transfer mode toggle
The system SHALL display a "Transferencia" option in the movement type selector that activates transfer mode.

#### Scenario: Activate transfer mode
- **WHEN** the user selects "Transferencia" from the type selector
- **THEN** the form SHALL display two account selectors ("Cuenta origen" and "Cuenta destino") and hide the category selector

#### Scenario: Deactivate transfer mode
- **WHEN** the user switches from "Transferencia" to "Gasto" or "Ingreso"
- **THEN** the form SHALL restore the single account selector and category selector

### Requirement: Origin and destination account selection
The system SHALL allow the user to select both an origin account and a destination account for transfers.

#### Scenario: Default accounts
- **WHEN** transfer mode is activated
- **THEN** the origin account SHALL default to the first account in the catalog and the destination account SHALL default to the second account

#### Scenario: Same account validation
- **WHEN** the user selects the same account for both origin and destination
- **THEN** the system SHALL display an error message and prevent submission

### Requirement: Dual movement creation
The system SHALL create two movements when a transfer is submitted: one negative from the origin account and one positive to the destination account.

#### Scenario: Successful transfer submission
- **WHEN** the user submits a transfer with origin account A, destination account B, and amount 500
- **THEN** the system SHALL create a movement with monto -500, cuenta_id A, and es_transferencia true
- **AND** the system SHALL create a movement with monto 500, cuenta_id B, and es_transferencia true

#### Scenario: Transfer category auto-assigned
- **WHEN** a transfer is submitted
- **THEN** both movements SHALL have categoria_id set to the "Transferencia" category

### Requirement: Transfer display in movement list
The system SHALL visually distinguish transfer movements in the movement list.

#### Scenario: Transfer movement badge
- **WHEN** a movement with es_transferencia true is displayed
- **THEN** the list item SHALL show a "Transferencia" badge or indicator

#### Scenario: Transfer display with account info
- **WHEN** a transfer movement is displayed
- **THEN** the list SHALL show the account name and a visual indicator (e.g., "Origen →")

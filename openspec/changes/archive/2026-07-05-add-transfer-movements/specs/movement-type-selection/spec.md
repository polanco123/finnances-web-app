## MODIFIED Requirements

### Requirement: Movement type selector
The system SHALL display a toggle switch to select between "Gasto", "Ingreso", and "Transferencia" movement types.

#### Scenario: Default to expense
- **WHEN** the form is loaded
- **THEN** the toggle SHALL be set to "Gasto" (expense) by default

#### Scenario: Toggle to income
- **WHEN** the user clicks the toggle switch
- **THEN** the toggle SHALL switch to "Ingreso" (income) and the label SHALL update accordingly

#### Scenario: Toggle to transfer
- **WHEN** the user clicks the toggle switch while in "Ingreso" mode
- **THEN** the toggle SHALL switch to "Transferencia" and the form SHALL display transfer-specific fields

#### Scenario: Toggle back to expense
- **WHEN** the user clicks the toggle switch while in "Transferencia" mode
- **THEN** the toggle SHALL switch back to "Gasto" (expense) and restore the standard form layout

### Requirement: Amount sign based on type
The system SHALL send the amount as negative when the movement type is "Gasto", positive when "Ingreso", and create paired movements when "Transferencia".

#### Scenario: Expense sends negative amount
- **WHEN** the form is submitted with type "Gasto" and amount 500
- **THEN** the system SHALL send -500 to the API

#### Scenario: Income sends positive amount
- **WHEN** the form is submitted with type "Ingreso" and amount 500
- **THEN** the system SHALL send 500 to the API

#### Scenario: Transfer creates paired amounts
- **WHEN** the form is submitted with type "Transferencia" and amount 500
- **THEN** the system SHALL create one movement with -500 (origin) and one with 500 (destination)

### Requirement: Visual feedback for type
The system SHALL display visual feedback to indicate the current movement type.

#### Scenario: Expense visual state
- **WHEN** the toggle is set to "Gasto"
- **THEN** the toggle SHALL display with a color indicating expense (e.g., red or error color)

#### Scenario: Income visual state
- **WHEN** the toggle is set to "Ingreso"
- **THEN** the toggle SHALL display with a color indicating income (e.g., green or success color)

#### Scenario: Transfer visual state
- **WHEN** the toggle is set to "Transferencia"
- **THEN** the toggle SHALL display with a color indicating transfer (e.g., blue or primary color)

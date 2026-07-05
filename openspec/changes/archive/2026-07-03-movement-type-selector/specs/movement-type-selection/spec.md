## ADDED Requirements

### Requirement: Movement type selector
The system SHALL display a toggle switch to select between "Gasto" and "Ingreso" movement types.

#### Scenario: Default to expense
- **WHEN** the form is loaded
- **THEN** the toggle SHALL be set to "Gasto" (expense) by default

#### Scenario: Toggle to income
- **WHEN** the user clicks the toggle switch
- **THEN** the toggle SHALL switch to "Ingreso" (income) and the label SHALL update accordingly

#### Scenario: Toggle back to expense
- **WHEN** the user clicks the toggle switch while in "Ingreso" mode
- **THEN** the toggle SHALL switch back to "Gasto" (expense) and the label SHALL update accordingly

### Requirement: Amount sign based on type
The system SHALL send the amount as negative when the movement type is "Gasto" and positive when "Ingreso".

#### Scenario: Expense sends negative amount
- **WHEN** the form is submitted with type "Gasto" and amount 500
- **THEN** the system SHALL send -500 to the API

#### Scenario: Income sends positive amount
- **WHEN** the form is submitted with type "Ingreso" and amount 500
- **THEN** the system SHALL send 500 to the API

### Requirement: Visual feedback for type
The system SHALL display visual feedback to indicate the current movement type.

#### Scenario: Expense visual state
- **WHEN** the toggle is set to "Gasto"
- **THEN** the toggle SHALL display with a color indicating expense (e.g., red or error color)

#### Scenario: Income visual state
- **WHEN** the toggle is set to "Ingreso"
- **THEN** the toggle SHALL display with a color indicating income (e.g., green or success color)

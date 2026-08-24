# Delta for cuentas-overview

## MODIFIED Requirements

### Requirement: Read-only page except icon assignment

The Cuentas page MUST NOT provide any UI for creating or deleting accounts, and MUST NOT expose editing of `nombre`, `tipo`, límites, `dia_pago`, or any account field other than `icono`. The sole permitted mutation is assigning or changing an account's `icono` via the inline icon picker on each account's card.
(Previously: "The Cuentas page MUST NOT provide any UI for creating, editing, or deleting accounts" — no exceptions of any kind.)

#### Scenario: No mutation affordances present for creation, deletion, or non-icon fields

- GIVEN the Cuentas page is rendered
- WHEN the page is inspected
- THEN no create or delete controls for accounts SHALL be present
- AND no edit controls for `nombre`, `tipo`, límites, `dia_pago`, or any field other than `icono` SHALL be present

#### Scenario: Icon assignment is the sole permitted mutation

- GIVEN the Cuentas page is rendered with an account card
- WHEN the user interacts with that card's icon picker
- THEN the system SHALL allow assigning or changing that account's `icono`
- AND no other field on the card SHALL become editable as a result

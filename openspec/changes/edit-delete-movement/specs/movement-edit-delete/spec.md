# movement-edit-delete Specification

## Purpose

Let users correct mistakes on `/movimientos` by editing a movement's amount and account(s) or deleting it, including both legs of a transfer.

## Requirements

### Requirement: Action popover on selection

Tapping a selectable movement item SHALL open a popover with "Editar" and "Eliminar" actions. Items with a non-null `msi_id` MUST NOT be selectable and MUST NOT open the popover.

#### Scenario: Tap opens actions
- GIVEN a regular movement without `msi_id` is listed
- WHEN the user taps it
- THEN a popover with "Editar" and "Eliminar" is shown

#### Scenario: MSI row is excluded
- GIVEN a movement has a non-null `msi_id`
- WHEN the user taps it
- THEN no popover opens and no edit/delete is possible

### Requirement: Restricted edit

"Editar" SHALL open a modal reusing the movement form in edit mode, prefilled, where ONLY `monto` and account(s) are editable (transfers: origen and destino). Category, date, time, description and transfer type MUST NOT be editable. The edited amount SHALL keep the original sign. The form type tab SHALL be derived from the row (`monto` sign, `es_transferencia`).

#### Scenario: Edit regular movement
- GIVEN an expense of -100 on account A
- WHEN the user changes the amount to 150 and account to B and saves
- THEN the row persists as -150 on account B, other fields unchanged
- AND both accounts' balances equal `SUM(monto)`

#### Scenario: Locked fields
- GIVEN the edit modal is open
- THEN category, date, time, description and type controls are absent or disabled

#### Scenario: Invalid amount
- GIVEN the edit modal is open
- WHEN the user saves with an empty, zero or non-numeric amount
- THEN the save is rejected with a validation message and nothing is written

### Requirement: Transfer edit is atomic

Editing a transfer SHALL update both legs (origen negative, destino positive, equal absolute amount) in a single atomic operation. Origen and destino MUST differ.

#### Scenario: Edit transfer amount and accounts
- GIVEN a transfer of 200 from A to B
- WHEN the user edits it to 300 from A to C
- THEN origen is -300 on A and destino +300 on C, or neither leg changes
- AND balances equal `SUM(monto)`

#### Scenario: Same origen and destino
- WHEN the user selects the same account for origen and destino
- THEN the save is rejected and nothing is written

### Requirement: Delete

"Eliminar" SHALL delete the movement immediately without a confirmation dialog. For a transfer, both legs MUST be deleted together atomically. Balances MUST equal `SUM(monto)` afterward.

#### Scenario: Delete regular movement
- GIVEN a regular movement is listed
- WHEN the user taps Eliminar
- THEN the row is removed and the account balance is adjusted

#### Scenario: Delete merged transfer
- GIVEN a merged transfer card
- WHEN the user taps Eliminar
- THEN both legs are deleted and the card disappears

### Requirement: Failure handling

If an edit or delete fails (including a missing migration), the system SHALL surface an error and MUST NOT change the visible list.

#### Scenario: Write fails
- GIVEN the backend rejects the operation
- WHEN the user saves an edit or deletes
- THEN an error is shown and the list is unchanged

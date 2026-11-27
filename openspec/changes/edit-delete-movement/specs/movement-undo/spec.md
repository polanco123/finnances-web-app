# movement-undo Specification

## Purpose

Offer a short-lived Undo after each edit or delete that restores the exact previous state.

## Requirements

### Requirement: Undo toast lifecycle

After a successful edit or delete, the system SHALL show a toast with an "Undo" action (`role="status"`) visible for at least 5 seconds (target ~6s), then remove it automatically. The timer SHOULD pause while the toast is hovered or focused.

#### Scenario: Toast appears and expires
- GIVEN the user deleted a movement
- WHEN the action succeeds
- THEN the toast is visible for >= 5s and then disappears without further action

#### Scenario: Timer pauses on hover
- GIVEN the toast is visible
- WHEN the user hovers or focuses it
- THEN it does not expire until hover/focus ends

### Requirement: Single active undo

Only one undo MAY be active. A new edit or delete MUST replace the current toast, making the earlier action no longer undoable.

#### Scenario: Second action replaces toast
- GIVEN an undo toast for action 1 is visible
- WHEN the user performs action 2
- THEN only the toast for action 2 is shown

### Requirement: Undo restores exact state

Undo of a delete SHALL re-create the removed row(s) with identical `id`, `created_at` and `transferencia_id` (both legs for transfers, atomically). Undo of an edit SHALL restore the previous `monto` and account(s) (both legs for transfers, atomically). Balances MUST equal `SUM(monto)` afterward.

#### Scenario: Undo delete
- GIVEN a movement was deleted and the toast is visible
- WHEN the user activates Undo
- THEN the row reappears at its original position with the same `id` and `created_at`

#### Scenario: Undo transfer delete
- GIVEN a transfer was deleted
- WHEN the user activates Undo
- THEN both legs are restored and the merged card reappears

#### Scenario: Undo edit
- GIVEN a movement was edited from -100/A to -150/B
- WHEN the user activates Undo
- THEN the row is -100 on A again

#### Scenario: Undo fails
- GIVEN the restore operation fails
- WHEN the user activates Undo
- THEN an error is shown and the list is unchanged

### Requirement: No undo after expiry

Once the toast has expired or been replaced, the change MUST be final.

#### Scenario: Expired toast
- GIVEN the toast has disappeared
- THEN no undo control is available for that action

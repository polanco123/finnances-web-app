# Delta for movement-display

## ADDED Requirements

### Requirement: Opt-in selectable items

`MovementListItem` and `MovementTransferCard` SHALL accept an optional `onSelect` handler. When provided, the item MUST be keyboard- and pointer-activatable (button semantics) and call `onSelect` with its movement (merged card: both legs). When omitted, rendering and behavior MUST be identical to today.

#### Scenario: Selectable item activates
- GIVEN an item rendered with `onSelect`
- WHEN the user clicks it or presses Enter/Space
- THEN `onSelect` is called with that movement

#### Scenario: Existing consumers unchanged
- GIVEN an item rendered without `onSelect`
- THEN it has no interactive role and renders as before

#### Scenario: MSI row not selectable
- GIVEN a movement with non-null `msi_id`
- WHEN rendered by the page
- THEN it is not passed `onSelect` and is not interactive

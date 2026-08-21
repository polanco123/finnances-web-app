# Delta for movement-display

## MODIFIED Requirements

### Requirement: Transfer movement glassmorphic accent

The system SHALL apply a glassmorphic accent styling to transfer movements in dark mode, for both the merged and unmerged rendering of a transfer.
(Previously: scenario only covered a single-account transfer row; now also covers the 2-account merged card.)

#### Scenario: Transfer movement in dark mode

- **WHEN** dark mode is active and a transfer movement (`es_transferencia: true`) is displayed, in either merged or unmerged form
- **THEN** the list item SHALL have a glassmorphic primary-colored left border accent

### Requirement: Merged transfer card rendering

When both halves of a transferencia (the origen row and the destino row sharing the same non-null `transferencia_id`) are present in the currently loaded movements, the system SHALL render them as a single merged card instead of two separate list items.

#### Scenario: Both legs loaded renders one merged card

- **GIVEN** an origen movimiento and a destino movimiento share the same non-null `transferencia_id`, and both are present in the loaded movements
- **WHEN** the list renders
- **THEN** the system SHALL display exactly one card for this pair, not two
- **AND** the card SHALL show both account names formatted as "Cuenta origen → Cuenta destino", resolved via the existing catalog resolution pattern
- **AND** the card SHALL show a single unsigned (no leading `-` or `+`) transferred amount, formatted as currency per the existing "Currency formatting" requirement (without the negative/red styling)
- **AND** the card SHALL show one date and time (the transferencia's date/time; both legs share the same value)
- **AND** the card SHALL show notas if present, per the "Merged card notas source" requirement below

#### Scenario: Merged card account name fallback

- **GIVEN** a merged transfer card where one of the two legs' `cuenta_id` does not exist in the account catalog
- **WHEN** the card renders
- **THEN** the missing side SHALL display "Sin cuenta" in place of that account's name, consistent with the existing "Handle missing catalog entry" scenario, while the other resolved account name SHALL still display normally

### Requirement: Unmerged transfer card rendering (fallback)

When only one half of a transferencia is currently available — either because its sibling has not yet loaded (pagination edge case) or because the row has no `transferencia_id` (historical/legacy row created before this change) — the system SHALL render that row exactly as an individual transfer movement, unchanged from current behavior: single account name, signed amount, and the existing "Transferencia" label/badge treatment.

#### Scenario: Only one leg currently loaded renders as an individual card

- **GIVEN** a movimiento has a non-null `transferencia_id` but its sibling row (same `transferencia_id`) is not present in the currently loaded movements
- **WHEN** the list renders
- **THEN** the system SHALL display this row as a single, individual transfer card showing only its own account name, its own signed amount (with the sign and color per "Currency formatting"), and the existing "Transferencia" label/badge
- **AND** the system SHALL NOT wait for or block rendering on the sibling row loading

#### Scenario: Legacy row with no transferencia_id renders unchanged

- **GIVEN** a movimiento has `es_transferencia: true` and `transferencia_id` is null (created before this change)
- **WHEN** the list renders
- **THEN** the system SHALL display this row exactly as it does today: a single individual card with one account name, one signed amount, and the "Transferencia" label/badge
- **AND** this SHALL NOT be treated as a regression — it is the intentional unmerged fallback for rows with no linkage data

### Requirement: Merged card notas source

Because `crearMovimientoTransferencia()` writes an identical `notas` value to both the origen and destino payloads at creation time, the two legs of a merged transferencia SHALL always carry the same `notas` value (or both null/absent). The merged card's notas field SHALL be read from either leg interchangeably; the system SHALL NOT attempt to merge, concatenate, or reconcile differing `notas` values between the two legs.

#### Scenario: Merged card displays notas from either leg

- **GIVEN** a merged transfer card whose origen and destino legs both carry the same non-null `notas` value
- **WHEN** the card renders
- **THEN** the system SHALL display that `notas` value once
- **AND** reading it from the origen leg or the destino leg SHALL produce an identical, correct result

#### Scenario: Merged card with no notas on either leg

- **GIVEN** a merged transfer card whose origen and destino legs both have null/absent `notas`
- **WHEN** the card renders
- **THEN** the system SHALL NOT display a notas field or an empty/null placeholder, consistent with the existing "Display movement without optional fields" scenario

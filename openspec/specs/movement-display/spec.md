# movement-display

## Purpose

Display financial movements in a structured list item format with proper currency formatting, responsive layout, and glassmorphic dark mode support.

## Requirements

### Requirement: Movement list item display
The system SHALL display movement information in a structured list item format with clear visual hierarchy. In dark mode, list items SHALL use glassmorphic styling.

#### Scenario: Display movement with all fields
- **WHEN** a movement object is passed to the MovementListItem component
- **THEN** the component SHALL display the monto formatted as currency, the category name, the account name, the date and time, and the notes if present

#### Scenario: Display movement without optional fields
- **WHEN** a movement object has null or undefined optional fields (descripcion, hora, notas)
- **THEN** the component SHALL display only the available fields without showing empty or null values

#### Scenario: List item dark mode display
- **WHEN** dark mode is active and a movement list item is rendered
- **THEN** the list item SHALL have a semi-transparent background, backdrop blur, and subtle glassmorphic border

### Requirement: Currency formatting
The system SHALL format the monto field as Mexican currency (MXN) with appropriate decimal places and currency symbol.

#### Scenario: Format positive amount
- **WHEN** the monto value is positive (e.g., 1500.50)
- **THEN** the component SHALL display it as "$1,500.50" with green color styling

#### Scenario: Format negative amount
- **WHEN** the monto value is negative (e.g., -500.00)
- **THEN** the component SHALL display it as "-$500.00" with red color styling

### Requirement: Catalog resolution
The system SHALL resolve cuenta_id and categoria_id to their corresponding names using the existing catalog data.

#### Scenario: Resolve valid IDs
- **WHEN** the movement has valid cuenta_id and categoria_id that exist in the catalogs
- **THEN** the component SHALL display the nombre of the account and category

#### Scenario: Handle missing catalog entry
- **WHEN** the movement has a cuenta_id or categoria_id that does not exist in the catalogs
- **THEN** the component SHALL display "Sin cuenta" or "Sin categoría" as fallback

### Requirement: Responsive layout
The system SHALL display the movement list item in a responsive layout that adapts to different screen sizes.

#### Scenario: Desktop display
- **WHEN** viewed on a desktop screen (width >= 768px)
- **THEN** the component SHALL display all fields in a horizontal layout with appropriate spacing

#### Scenario: Mobile display
- **WHEN** viewed on a mobile screen (width < 768px)
- **THEN** the component SHALL display fields in a vertical stacked layout

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

### Requirement: Catalog icon resolution in movement rows

Whenever `movement-list-item.tsx` or `movement-transfer-card.tsx` resolves and renders a cuenta or categoria name, the system MUST also resolve and render that catalog item's icon (or its type fallback when `icono` is `null`) alongside the name.

#### Scenario: Movement row renders account and category icons

- GIVEN a movimiento has `cuenta_id` and `categoria_id` that resolve to catalog items with non-null `icono` values
- WHEN `movement-list-item.tsx` renders the row
- THEN the resolved cuenta icon SHALL render alongside the account name
- AND the resolved categoria icon SHALL render alongside the category name

#### Scenario: Movement row falls back when icono is null

- GIVEN the resolved cuenta has `icono = null`
- WHEN the row renders
- THEN the `Wallet` fallback icon SHALL render in place of a curated icon

#### Scenario: Merged transfer card renders both accounts' icons independently

- GIVEN a merged transfer card resolves both the origen and destino cuenta
- WHEN the card renders
- THEN each account name SHALL be accompanied by its own resolved icon or `Wallet` fallback, independently per leg

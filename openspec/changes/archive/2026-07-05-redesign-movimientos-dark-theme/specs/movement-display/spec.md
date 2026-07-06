## MODIFIED Requirements

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
The system SHALL apply a glassmorphic accent styling to transfer movements in dark mode.

#### Scenario: Transfer movement in dark mode
- **WHEN** dark mode is active and a transfer movement (es_transferencia: true) is displayed
- **THEN** the list item SHALL have a glassmorphic primary-colored left border accent

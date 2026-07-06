## MODIFIED Requirements

### Requirement: Theme CSS variables
The system SHALL provide a CSS file with custom properties for theming that can be imported by any component. The theme SHALL support both light and dark modes via the `.dark` class.

#### Scenario: Theme file exists and is importable
- **WHEN** a component imports `@/lib/theme.css`
- **THEN** the component SHALL have access to all CSS custom properties defined in the theme

#### Scenario: Primary color variable
- **WHEN** the theme is loaded
- **THEN** the variable `--theme-color-primary` SHALL be defined with a valid hex color value

#### Scenario: Secondary color variable
- **WHEN** the theme is loaded
- **THEN** the variable `--theme-color-secondary` SHALL be defined with a valid hex color value

#### Scenario: Accent color variable
- **WHEN** the theme is loaded
- **THEN** the variable `--theme-color-accent` SHALL be defined with a valid hex color value

#### Scenario: Dark mode variables
- **WHEN** the `.dark` class is applied to the root element
- **THEN** all theme variables SHALL switch to dark mode values automatically

### Requirement: Theme color consistency
The system SHALL use the same color variables across all components to ensure visual consistency. Colors SHALL adapt to the current theme mode (light or dark).

#### Scenario: Components use theme colors
- **WHEN** a component needs to display a primary color
- **THEN** the component SHALL use `var(--theme-color-primary)` instead of hardcoded color values

#### Scenario: Theme colors are customizable
- **WHEN** the theme file is modified
- **THEN** all components importing the theme SHALL reflect the new color values without code changes

#### Scenario: Theme colors work in both modes
- **WHEN** the theme mode changes between light and dark
- **THEN** all components using theme variables SHALL update their colors accordingly

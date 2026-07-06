## ADDED Requirements

### Requirement: Dark mode theme variables
The system SHALL provide dark mode CSS variables in `lib/theme.css` that activate when the `.dark` class is present on the root element.

#### Scenario: Dark mode activates with .dark class
- **WHEN** the `.dark` class is applied to the `<html>` element
- **THEN** all `--theme-*` variables SHALL switch to their dark mode values (dark backgrounds, light text)

#### Scenario: Light mode remains default
- **WHEN** the `.dark` class is NOT applied to the `<html>` element
- **THEN** all `--theme-*` variables SHALL retain their existing light mode values

#### Scenario: Primary color in dark mode
- **WHEN** dark mode is active
- **THEN** `--theme-color-primary` SHALL be a lighter variant of the primary blue for visibility on dark backgrounds

#### Scenario: Text colors in dark mode
- **WHEN** dark mode is active
- **THEN** `--theme-text-primary` SHALL be a light color (near-white) and `--theme-text-secondary` SHALL be a muted light color

#### Scenario: Background colors in dark mode
- **WHEN** dark mode is active
- **THEN** `--theme-bg-background` SHALL be a dark color and `--theme-bg-surface` SHALL be a slightly lighter dark color

### Requirement: Glassmorphic design tokens
The system SHALL provide CSS variables for glassmorphic styling effects.

#### Scenario: Glass background token
- **WHEN** the theme is loaded
- **THEN** `--theme-glass-bg` SHALL be defined with a semi-transparent color value

#### Scenario: Glass blur token
- **WHEN** the theme is loaded
- **THEN** `--theme-glass-blur` SHALL be defined with a blur radius value (e.g., `10px`)

#### Scenario: Glass border token
- **WHEN** the theme is loaded
- **THEN** `--theme-glass-border` SHALL be defined with a semi-transparent border color

#### Scenario: Glassmorphic tokens in dark mode
- **WHEN** dark mode is active
- **THEN** glassmorphic tokens SHALL use semi-transparent white values for backgrounds and borders

### Requirement: Page-level dark background
The movimientos page SHALL display a dark background that fills the viewport.

#### Scenario: Dark page background
- **WHEN** dark mode is active and the user is on the movimientos page
- **THEN** the page background SHALL be the dark theme background color

#### Scenario: Centered content layout
- **WHEN** the movimientos page is rendered
- **THEN** the content SHALL be centered with a max-width constraint and appropriate padding

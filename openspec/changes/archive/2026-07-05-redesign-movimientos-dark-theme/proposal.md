## Why

The movimientos page currently has no dark mode support and uses basic flat styling. The `lib/theme.css` only defines light mode variables, and the movement components use plain white backgrounds with standard shadows. Users want a modern dark theme with glassmorphic effects (semi-transparent backgrounds, backdrop blur, subtle borders) for a more polished, contemporary look.

## What Changes

- Add dark mode CSS variables to `lib/theme.css` that respond to the `.dark` class (already wired via next-themes)
- Add glassmorphic style tokens: semi-transparent backgrounds, backdrop-filter blur, subtle border colors
- Redesign the movimientos page layout with a dark background, centered container, and proper spacing
- Update movement form styles for dark theme with glassmorphic card effect
- Update movement list item styles for dark theme with glassmorphic card effect
- Ensure all components use the existing theme color variables (primary, secondary, accent, semantic)

## Capabilities

### New Capabilities

- `dark-theme-glassmorphic`: Dark mode theme variables and glassmorphic design tokens for the entire application

### Modified Capabilities

- `material-theme`: Add dark mode variant (`:root.dark` or `.dark`) to theme.css with inverted colors, dark backgrounds, and glassmorphic tokens
- `material-form`: Update form container, inputs, buttons, and toggle to use glassmorphic styling in dark mode
- `movement-display`: Update list item cards to use glassmorphic styling in dark mode

## Impact

- `lib/theme.css` — Add `.dark` class overrides with dark color palette and glassmorphic tokens
- `components/movement/movement-form.css` — Update form container and inputs for dark theme with glassmorphic effects
- `components/movement/movement-list-item.css` — Update list item cards for dark theme with glassmorphic effects
- `app/movimientos/page.tsx` — Add page-level wrapper with dark background and layout styling
- `app/globals.css` — May need dark mode body background color update

## Context

The application uses two parallel design token systems: shadcn/ui HSL variables (with dark mode support) and custom hex variables in `lib/theme.css` (light mode only). The movement components (`movement-form.css`, `movement-list-item.css`) import only `theme.css` and use BEM naming with plain CSS. The movimientos page (`page.tsx`) has no page-level styling — no container, no background, no layout. The `next-themes` ThemeProvider is already configured in `app/layout.tsx` with `attribute="class"`, toggling `.dark` on `<html>`.

## Goals / Non-Goals

**Goals:**
- Add dark mode variants to `lib/theme.css` that activate with the `.dark` class
- Introduce glassmorphic design tokens: semi-transparent backgrounds, backdrop blur, subtle borders
- Redesign the movimientos page with a dark background, centered layout, and glassmorphic cards
- Maintain backward compatibility — light mode remains unchanged
- Use the existing theme color variables (primary, secondary, accent, semantic) in dark variants

**Non-Goals:**
- Migrating to a different CSS framework or component library
- Redesigning pages other than movimientos
- Changing the shadcn/ui token system in `globals.css`
- Adding a theme toggle UI (already handled by next-themes)

## Decisions

### Decision 1: Dark mode via `.dark` class on `:root`
**Choice**: Add `.dark` selector in `lib/theme.css` to override all `--theme-*` variables.

**Rationale**: The `next-themes` ThemeProvider already toggles `.dark` on `<html>`. Using `.dark` in `theme.css` means all components importing the theme automatically get dark mode — no component-level changes needed for basic dark support.

**Alternative considered**: Use `@media (prefers-color-scheme: dark)`. Rejected because the app already uses class-based toggling via next-themes, and media queries don't allow user override.

### Decision 2: Glassmorphic tokens as new CSS variables
**Choice**: Add new variables `--theme-glass-bg`, `--theme-glass-blur`, `--theme-glass-border` to `theme.css` for glassmorphic effects.

**Rationale**: Centralizing glassmorphic values as tokens makes them reusable across all components and easy to adjust. Components opt-in by using these variables.

**Alternative considered**: Hardcode `backdrop-filter: blur()` in each CSS file. Rejected because it's harder to maintain and adjust globally.

### Decision 3: Page-level layout via CSS module or inline styles
**Choice**: Add a `movimientos-page` class to the page wrapper and define layout styles in a new `app/movimientos/page.css` file.

**Rationale**: Keeps page-specific layout separate from component styles. Follows the existing pattern of co-located CSS files.

**Alternative considered**: Use Tailwind utility classes in JSX. Rejected because the movement components use plain CSS with BEM, and mixing approaches would be inconsistent.

### Decision 4: Semi-transparent backgrounds for glassmorphic cards
**Choice**: Use `rgba()` backgrounds with low opacity (e.g., `rgba(255, 255, 255, 0.05)` in dark mode) combined with `backdrop-filter: blur(10px)` and `border: 1px solid rgba(255, 255, 255, 0.1)`.

**Rationale**: This is the standard glassmorphic pattern. The semi-transparency lets the dark background show through, creating depth.

## Risks / Trade-offs

- **Performance**: `backdrop-filter` can cause rendering issues on some browsers/devices. Mitigation: Use `-webkit-backdrop-filter` prefix and test on target browsers.
- **Contrast**: Glassmorphic elements on dark backgrounds may have low contrast. Mitigation: Ensure text colors maintain WCAG AA contrast ratios against the semi-transparent backgrounds.
- **Browser support**: `backdrop-filter` is not supported in older browsers. Mitigation: Provide fallback solid background color.

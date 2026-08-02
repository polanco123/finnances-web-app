# admin-panel-theming

## Purpose

Design-token contract governing all new and restyled UI introduced by this change (sidebar, topbar, dashboard, placeholder stubs): exclusive use of `lib/theme.css`'s `--theme-*` tokens for color, removal of the dashboard's legacy self-contained token system, and a qualitative bar for visual consistency where existing System-A-styled primitives are reused inside the new shell.

## ADDED Requirements

### Requirement: New components use only `--theme-*` tokens for color
All new components introduced by this change (sidebar, topbar, and any new placeholder stub elements) SHALL source all color values exclusively from `lib/theme.css`'s `--theme-*` custom properties. These components MUST NOT introduce new hardcoded hex/rgb/hsl color literals, and MUST NOT rely on the shadcn/Tailwind HSL variable system defined in `app/globals.css` for color decisions.

#### Scenario: No hardcoded colors in new shell components
- GIVEN the CSS/styles authored for the sidebar and topbar components
- WHEN those styles are inspected
- THEN every color-related declaration (background, text, border, fill, etc.) SHALL reference a `--theme-*` custom property
- AND no new hex, rgb, or hsl color literal SHALL be present

#### Scenario: New components do not depend on the globals.css HSL system for color
- GIVEN the CSS/styles authored for the sidebar and topbar components
- WHEN those styles are inspected
- THEN they SHALL NOT reference `app/globals.css`'s shadcn/Tailwind HSL variables (e.g. `--background`, `--foreground`, `--primary` as defined there) for color

### Requirement: Dashboard fully migrated off its legacy token system
`app/dashboard/page.tsx` and `page.css` SHALL be migrated so the dashboard exclusively uses `--theme-*` tokens for color. The prior self-contained variable system (`--primary-900`, `--accent-500`, `--surface-bg`, `--text-primary`, `--text-secondary`, `--positive`, `--positive-bg`, `--negative`, `--negative-bg`, `--neutral`, `--neutral-bg`, etc.) and its associated `[data-theme="dark"]` override block SHALL be removed entirely.

#### Scenario: No leftover references to the old variable system
- GIVEN `app/dashboard/page.css` after migration
- WHEN the file is inspected
- THEN it SHALL NOT define or reference any of the legacy variable names (`--primary-900`, `--accent-500`, `--surface-bg`, `--text-secondary`, `--negative`, `--negative-bg`, etc.)
- AND it SHALL NOT contain a `[data-theme="dark"]` selector block

#### Scenario: Dashboard colors resolve through `--theme-*` tokens post-migration
- GIVEN `app/dashboard/page.css` after migration
- WHEN a color-related declaration is inspected (e.g. the balance amount, negative/positive stat colors, card backgrounds)
- THEN it SHALL resolve through a `--theme-*` custom property (directly or via a value derived from one), consistent with the rest of the new shell

### Requirement: Visual consistency when reusing System-A-styled primitives
Where this change reuses an existing System-A-styled component (e.g. `components/ui/button.tsx`, `components/logout-button.tsx`) inside the new `--theme-*`-styled shell, the combined visual result SHOULD NOT look jarringly inconsistent (e.g. clashing color families, mismatched corner radii or spacing scale) next to the surrounding `--theme-*`-styled surfaces.

This requirement is qualitative and verified by design/visual review, not by an automated check. The exact reconciliation mechanism (re-theming the reused primitive, wrapping it, overriding specific tokens, etc.) is a design-phase decision, not specified here.

#### Scenario: Reused primitives read as part of the same design system on visual review
- GIVEN the shell renders with a reused System-A-styled primitive (e.g. the logout button) alongside new `--theme-*`-styled surfaces (e.g. the topbar)
- WHEN a reviewer visually inspects the rendered topbar in both light and dark mode
- THEN the reused primitive SHOULD appear visually coherent with its surroundings (comparable color intensity, corner radius, and spacing) rather than looking like an unstyled or mismatched foreign element

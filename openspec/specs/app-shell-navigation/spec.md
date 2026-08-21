# app-shell-navigation

## Purpose

Authenticated application shell (sidebar + topbar) providing shared, consistent navigation and utility controls across all authenticated routes (`/`, `/movimientos`, `/diversion`, `/cuentas`, `/reportes`), replacing per-page chrome duplication.

## ADDED Requirements

### Requirement: Functional sidebar navigation links
The sidebar SHALL render seven functional navigation links — Dashboard (`/`), Movimientos (`/movimientos`), Diversión (`/diversion`), Cuentas (`/cuentas`), Patrimonio (`/reportes`), Deudas (`/deudas`), Metas (`/metas`) — that navigate the application to the corresponding route when activated.
(Previously: six functional links — Dashboard, Movimientos, Diversión, Cuentas, Patrimonio, Deudas; "Metas" did not exist as an entry, functional or placeholder.)

#### Scenario: Activating a functional sidebar link navigates to its route
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Movimientos" sidebar link
- THEN the application SHALL navigate to `/movimientos`
- AND the shell (sidebar + topbar) SHALL remain rendered around the new route's content

#### Scenario: All seven functional links are present
- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN it SHALL contain exactly seven functional links labeled for Dashboard, Movimientos, Diversión, Cuentas, Patrimonio, Deudas, and Metas, targeting `/`, `/movimientos`, `/diversion`, `/cuentas`, `/reportes`, `/deudas`, and `/metas` respectively

#### Scenario: Activating the Cuentas link navigates to the live overview page
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Cuentas" sidebar link
- THEN the application SHALL navigate to `/cuentas`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

#### Scenario: Activating the Patrimonio link navigates to the live dashboard
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Patrimonio" sidebar link
- THEN the application SHALL navigate to `/reportes`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

#### Scenario: Activating the Deudas link navigates to the debt payment panel

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Deudas" sidebar link
- THEN the application SHALL navigate to `/deudas`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

#### Scenario: Activating the Metas link navigates to the savings goals panel

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Metas" sidebar link
- THEN the application SHALL navigate to `/metas`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling
- AND the link SHALL appear positioned after "Deudas" and before "Categorías" in the sidebar

### Requirement: Placeholder navigation entries for future phases
The sidebar SHALL also render two placeholder entries — Categorías, Configuración — for capabilities not implemented this change. Activating a placeholder entry MUST NOT produce a broken/404 experience or an unhandled error. The exact placeholder treatment (disabled control, inert stub link, "próximamente" page, etc.) is a design-phase decision, not specified here.
(Previously: three placeholder entries — Categorías, Reportes, Configuración. Reportes is removed from this requirement's scope, renamed to "Patrimonio", and moves to "Functional sidebar navigation links".)

#### Scenario: Activating a placeholder entry does not break the app
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Categorías" placeholder entry
- THEN the application SHALL NOT navigate to a 404/not-found page
- AND the application SHALL NOT throw an unhandled client error
- AND the user SHALL remain on a valid, rendered screen within the shell

#### Scenario: Placeholder entries are visually distinguishable from functional links
- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN the two placeholder entries (Categorías, Configuración) SHALL be present
- AND they SHALL be visually distinguishable from the five functional links (e.g. a disabled/muted visual treatment), so the user can tell they are not yet available

#### Scenario: Reportes/Patrimonio no longer appears among placeholders
- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN neither "Reportes" nor "Patrimonio" SHALL appear among the placeholder entries or carry the `comingSoon` muted styling/badge

### Requirement: Sidebar show/hide toggle
The sidebar SHALL be fully hideable and showable via a toggle button located in the topbar. This is a full show/hide, not an icon-rail collapse — when hidden, no reduced form of the sidebar SHALL remain visible.

#### Scenario: Hiding the sidebar
- GIVEN the sidebar is currently visible
- WHEN the user activates the topbar toggle button
- THEN the sidebar SHALL become fully hidden (not reduced to an icon rail)

#### Scenario: Showing the sidebar
- GIVEN the sidebar is currently hidden
- WHEN the user activates the topbar toggle button
- THEN the sidebar SHALL become fully visible again in its previous expanded form

#### Scenario: Main content reflows when the sidebar is hidden
- GIVEN the sidebar is visible and the main content area occupies the remaining viewport width
- WHEN the user hides the sidebar via the topbar toggle
- THEN the main content area SHALL expand to occupy the width previously occupied by the sidebar

### Requirement: Active route indication in sidebar (INFERRED)
> Note: not explicitly requested in the proposal; inferred as standard admin-panel/sidebar-navigation behavior implied by having a "menu." Flagged for the implementer/design reviewer to confirm or reject rather than presented as user-stated.

The sidebar SHALL visually indicate which functional link corresponds to the currently active route.

#### Scenario: Active route is indicated
- GIVEN the current route is `/movimientos`
- WHEN the sidebar is rendered
- THEN the "Movimientos" link SHALL display a distinct visual state (e.g. highlighted background, accent border, or bold text) that the other links do not have
- AND when the user navigates to `/diversion`, the "Diversión" link SHALL take on that distinct visual state instead, and "Movimientos" SHALL lose it

### Requirement: Topbar notifications button (non-functional)
The topbar SHALL contain a notifications button. Activating it SHALL NOT produce any functional behavior, error, or navigation this change.

#### Scenario: Activating the notifications button is inert
- GIVEN the shell is rendered
- WHEN the user activates the topbar notifications button
- THEN the application SHALL NOT navigate away from the current route
- AND the application SHALL NOT throw an unhandled client error
- AND no notification content SHALL be displayed

### Requirement: Topbar theme toggle
The topbar SHALL contain a theme toggle control that switches the active theme between light and dark, persisted via the existing `next-themes` mechanism (`attribute="class"`).

#### Scenario: Switching from light to dark
- GIVEN the active theme is light
- WHEN the user activates the topbar theme toggle to select dark
- THEN the `.dark` class SHALL be applied to the document root
- AND the shell and all its rendered routes SHALL visually switch to dark-mode styling
- AND the choice SHALL persist across a page reload

#### Scenario: Switching from dark to light
- GIVEN the active theme is dark
- WHEN the user activates the topbar theme toggle to select light
- THEN the `.dark` class SHALL be removed from the document root
- AND the shell and all its rendered routes SHALL visually switch to light-mode styling

### Requirement: Topbar logout button
The topbar SHALL contain a logout button that reuses the existing `components/logout-button.tsx` behavior: it SHALL sign the current user out of Supabase and redirect to `/auth/login`.

#### Scenario: Logging out from the topbar
- GIVEN an authenticated user viewing any shell-wrapped route
- WHEN the user activates the topbar logout button
- THEN the system SHALL sign the user out of their Supabase session
- AND the application SHALL redirect the user to `/auth/login`

### Requirement: Single shared shell instance across authenticated routes
All authenticated routes covered by this change (`/`, `/movimientos`, `/diversion`) SHALL render inside one shared shell instance (sidebar + topbar rendered once at the layout level), not duplicated per page.

#### Scenario: Navigating between shell routes does not re-mount the shell
- GIVEN the user is on `/` with the sidebar hidden via the toggle
- WHEN the user navigates to `/movimientos` using a functional sidebar link
- THEN the sidebar SHALL remain hidden, demonstrating the shell is a single shared instance and not re-created per page

#### Scenario: Every covered route renders within the shell
- GIVEN a request for `/`, `/movimientos`, or `/diversion`
- WHEN the page renders
- THEN the sidebar and topbar SHALL be present around the page's content in all three cases

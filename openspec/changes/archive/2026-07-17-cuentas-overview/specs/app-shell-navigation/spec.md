# Delta for app-shell-navigation

## MODIFIED Requirements

### Requirement: Functional sidebar navigation links

The sidebar SHALL render four functional navigation links — Dashboard (`/`), Movimientos (`/movimientos`), Diversión (`/diversion`), Cuentas (`/cuentas`) — that navigate the application to the corresponding route when activated.
(Previously: three functional links — Dashboard, Movimientos, Diversión; Cuentas was a placeholder.)

#### Scenario: Activating a functional sidebar link navigates to its route

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Movimientos" sidebar link
- THEN the application SHALL navigate to `/movimientos`
- AND the shell (sidebar + topbar) SHALL remain rendered around the new route's content

#### Scenario: All four functional links are present

- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN it SHALL contain exactly four functional links labeled for Dashboard, Movimientos, Diversión, and Cuentas, targeting `/`, `/movimientos`, `/diversion`, and `/cuentas` respectively

#### Scenario: Activating the Cuentas link navigates to the live overview page

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Cuentas" sidebar link
- THEN the application SHALL navigate to `/cuentas`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

### Requirement: Placeholder navigation entries for future phases

The sidebar SHALL also render three placeholder entries — Categorías, Reportes, Configuración — for capabilities not implemented this change. Activating a placeholder entry MUST NOT produce a broken/404 experience or an unhandled error. The exact placeholder treatment (disabled control, inert stub link, "próximamente" page, etc.) is a design-phase decision, not specified here.
(Previously: four placeholder entries — Cuentas, Categorías, Reportes, Configuración. Cuentas is removed from this requirement's scope and moves to "Functional sidebar navigation links".)

#### Scenario: Activating a placeholder entry does not break the app

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Categorías" placeholder entry
- THEN the application SHALL NOT navigate to a 404/not-found page
- AND the application SHALL NOT throw an unhandled client error
- AND the user SHALL remain on a valid, rendered screen within the shell

#### Scenario: Placeholder entries are visually distinguishable from functional links

- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN the three placeholder entries (Categorías, Reportes, Configuración) SHALL be present
- AND they SHALL be visually distinguishable from the four functional links (e.g. a disabled/muted visual treatment), so the user can tell they are not yet available

#### Scenario: Cuentas no longer appears among placeholders

- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN "Cuentas" SHALL NOT appear among the placeholder entries or carry the `comingSoon` muted styling/badge

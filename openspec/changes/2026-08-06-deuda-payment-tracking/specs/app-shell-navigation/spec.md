# Delta for app-shell-navigation

## MODIFIED Requirements

### Requirement: Functional sidebar navigation links

The sidebar SHALL render six functional navigation links — Dashboard (`/`), Movimientos (`/movimientos`), Diversión (`/diversion`), Cuentas (`/cuentas`), Patrimonio (`/reportes`), Deudas (`/deudas`) — that navigate the application to the corresponding route when activated.
(Previously: five functional links — Dashboard, Movimientos, Diversión, Cuentas, Patrimonio; "Deudas" did not exist as an entry, functional or placeholder.)

#### Scenario: Activating a functional sidebar link navigates to its route

- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Movimientos" sidebar link
- THEN the application SHALL navigate to `/movimientos`
- AND the shell (sidebar + topbar) SHALL remain rendered around the new route's content

#### Scenario: All six functional links are present

- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN it SHALL contain exactly six functional links labeled for Dashboard, Movimientos, Diversión, Cuentas, Patrimonio, and Deudas, targeting `/`, `/movimientos`, `/diversion`, `/cuentas`, `/reportes`, and `/deudas` respectively

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
- AND the link SHALL appear in the sidebar alongside Dashboard, Movimientos, Diversión, Cuentas, and Patrimonio

# Delta for app-shell-navigation

## MODIFIED Requirements

### Requirement: Functional sidebar navigation links

The sidebar SHALL render nine functional navigation links — Dashboard (`/`), Movimientos (`/movimientos`), Diversión (`/diversion`), Cuentas (`/cuentas`), Deudas (`/deudas`), Metas (`/metas`), Categorías (`/categorias`), Presupuestos (`/presupuestos`), Reportes (`/reportes`) — that navigate the application to the corresponding route when activated.

(Previously: the main spec described eight functional links and still listed "Categorías" as a placeholder entry. Two corrections are folded in here, both verified against `components/app-shell/sidebar.tsx`: (1) "Categorías" is already functional — it carries no `comingSoon` flag — so the placeholder wording was stale drift predating this change; (2) the `/reportes` entry is labeled "Reportes" in `NAV_ITEMS`, not "Patrimonio" as the main spec worded it. "Presupuestos" is the only genuinely new entry this change adds; it did not previously exist as a functional or placeholder item. `Configuración` (`/configuracion`) remains the sole `comingSoon` entry and is not counted among the functional links.)

#### Scenario: Activating a functional sidebar link navigates to its route
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Movimientos" sidebar link
- THEN the application SHALL navigate to `/movimientos`
- AND the shell (sidebar + topbar) SHALL remain rendered around the new route's content

#### Scenario: All nine functional links are present
- GIVEN the shell is rendered
- WHEN the sidebar is inspected
- THEN it SHALL contain exactly nine functional links labeled Dashboard, Movimientos, Diversión, Cuentas, Deudas, Metas, Categorías, Presupuestos, and Reportes, targeting `/`, `/movimientos`, `/diversion`, `/cuentas`, `/deudas`, `/metas`, `/categorias`, `/presupuestos`, and `/reportes` respectively
- AND "Configuración" (`/configuracion`) SHALL remain the only entry displaying the "Próximamente" badge

#### Scenario: Activating the Cuentas link navigates to the live overview page
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Cuentas" sidebar link
- THEN the application SHALL navigate to `/cuentas`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

#### Scenario: Activating the Reportes link navigates to the live dashboard
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Reportes" sidebar link
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

#### Scenario: Activating the Categorías link navigates to the category spending panel
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Categorías" sidebar link
- THEN the application SHALL navigate to `/categorias`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

#### Scenario: Activating the Presupuestos link navigates to the monthly budgets panel
- GIVEN the shell is rendered with the sidebar visible
- WHEN the user activates the "Presupuestos" sidebar link
- THEN the application SHALL navigate to `/presupuestos`
- AND the link SHALL NOT display the "Próximamente" badge or muted styling

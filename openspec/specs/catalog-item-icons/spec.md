# catalog-item-icons

## Purpose

Per-item visual identity for `cuenta` and `categoria` rows via a nullable `icono` field resolved against a curated `lucide-react` icon set, an inline picker for assigning/changing icons from the existing `/cuentas` and `/categorias` card views, and distinct fallback rendering when `icono` is unset. This capability owns icon storage, the curated allow-list constraint, the picker UI, and rendering at every catalog render site not already covered by `movement-display`.

## Requirements

### Requirement: Curated icon allow-list constrains storage and selection

The system MUST resolve `icono` values only against a curated `lucide-react` icon subset, and the icon picker MUST offer only icons from that curated set — never the full `lucide-react` catalog.

#### Scenario: Picker only lists curated icons

- GIVEN the user opens the icon picker for a cuenta or categoria
- WHEN the picker renders
- THEN only icons present in the curated allow-list SHALL be shown as selectable options
- AND no icon outside the curated set SHALL be selectable, presentable, or reachable through the picker

### Requirement: Assigning an icon for the first time

The system MUST allow assigning an `icono` to a cuenta (from `/cuentas`) or categoria (from `/categorias`) whose `icono` is currently `null`, via the inline picker on that item's existing card.

#### Scenario: Assigning an icon to a cuenta with no icon

- GIVEN a cuenta's card renders with `icono = null` (showing the `Wallet` fallback)
- WHEN the user opens the icon picker and selects a curated icon
- THEN the cuenta's `icono` SHALL be persisted with the selected value
- AND the card SHALL immediately render the newly selected icon in place of the fallback

#### Scenario: Assigning an icon to a categoria with no icon

- GIVEN a categoria's card renders with `icono = null` (showing the `Tag` fallback)
- WHEN the user opens the icon picker and selects a curated icon
- THEN the categoria's `icono` SHALL be persisted with the selected value
- AND the card SHALL immediately render the newly selected icon in place of the fallback

### Requirement: Changing an already-assigned icon

The system MUST allow replacing a cuenta's or categoria's existing (non-null) `icono` with a different curated icon via the same inline picker.

#### Scenario: Changing a cuenta's existing icon

- GIVEN a cuenta's `icono` is already set to a curated value
- WHEN the user opens the icon picker and selects a different curated icon
- THEN the cuenta's `icono` SHALL be updated to the newly selected value
- AND the card SHALL render the new icon, not the previous one

#### Scenario: Changing a categoria's existing icon

- GIVEN a categoria's `icono` is already set to a curated value
- WHEN the user opens the icon picker and selects a different curated icon
- THEN the categoria's `icono` SHALL be updated to the newly selected value
- AND the card SHALL render the new icon, not the previous one

### Requirement: Distinct fallback icons per catalog type

When `icono` is `null`, the system MUST render the `Wallet` icon as the fallback for a cuenta and the `Tag` icon as the fallback for a categoria. These fallbacks MUST NOT be interchangeable or replaced by a shared generic icon.

#### Scenario: Cuenta with null icono renders Wallet fallback

- GIVEN a cuenta row has `icono = null`
- WHEN any render site displays that cuenta
- THEN the `Wallet` icon SHALL render in place of a curated icon

#### Scenario: Categoria with null icono renders Tag fallback

- GIVEN a categoria row has `icono = null`
- WHEN any render site displays that categoria
- THEN the `Tag` icon SHALL render in place of a curated icon

### Requirement: Icon assignment exposes no other editable field

The inline icon picker MUST NOT expose editing of `nombre`, `tipo`, límites, `dia_pago`, or any field other than `icono`.

#### Scenario: Icon picker interaction leaves other fields unexposed

- GIVEN the user opens the icon picker on a cuenta or categoria card
- WHEN the picker is inspected
- THEN no control for editing `nombre`, `tipo`, límites, or any other field SHALL be present

### Requirement: Icon renders at catalog render sites outside movement rows

Wherever a cuenta or categoria name renders today outside `movement-list-item.tsx`/`movement-transfer-card.tsx` (covered by `movement-display`) — including `cuentas-card.tsx`, `categorias-card.tsx`, the account/category autocomplete picker in the movement form, `deuda-payment-table.tsx`, and patrimonio's próximo-vencimiento and categorías-del-mes displays — the system MUST render the resolved icon (or its type fallback) alongside the name.

#### Scenario: List card renders resolved icon

- GIVEN a cuenta with a non-null `icono` renders on `/cuentas` via `cuentas-card.tsx`
- WHEN the card renders
- THEN the resolved curated icon SHALL render alongside the cuenta's name

#### Scenario: Autocomplete picker renders resolved icon

- GIVEN the movement form's account/category autocomplete lists a categoria with a non-null `icono`
- WHEN the option renders
- THEN the resolved curated icon SHALL render alongside the categoria's name

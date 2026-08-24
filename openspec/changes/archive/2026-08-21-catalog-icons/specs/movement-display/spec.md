# Delta for movement-display

## ADDED Requirements

### Requirement: Catalog icon resolution in movement rows

Whenever `movement-list-item.tsx` or `movement-transfer-card.tsx` resolves and renders a cuenta or categoria name, the system MUST also resolve and render that catalog item's icon (or its type fallback when `icono` is `null`) alongside the name.

#### Scenario: Movement row renders account and category icons

- GIVEN a movimiento has `cuenta_id` and `categoria_id` that resolve to catalog items with non-null `icono` values
- WHEN `movement-list-item.tsx` renders the row
- THEN the resolved cuenta icon SHALL render alongside the account name
- AND the resolved categoria icon SHALL render alongside the category name

#### Scenario: Movement row falls back when icono is null

- GIVEN the resolved cuenta has `icono = null`
- WHEN the row renders
- THEN the `Wallet` fallback icon SHALL render in place of a curated icon

#### Scenario: Merged transfer card renders both accounts' icons independently

- GIVEN a merged transfer card resolves both the origen and destino cuenta
- WHEN the card renders
- THEN each account name SHALL be accompanied by its own resolved icon or `Wallet` fallback, independently per leg

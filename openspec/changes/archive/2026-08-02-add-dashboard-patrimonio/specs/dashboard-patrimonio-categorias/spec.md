# dashboard-patrimonio-categorias

## Purpose

Monthly per-category spend on the Patrimonio dashboard (`/reportes`), with hot/warm/normal heat coloring comparing the current calendar month's spend against the prior 3 months' average.

## ADDED Requirements

### Requirement: Current-month spend aggregation per category

The system SHALL compute `gasto_mes_actual = SUM(movimiento.monto) GROUP BY categoria_id`, scoped to movimientos dated within the current calendar month.

#### Scenario: Aggregation scoped to current month

- GIVEN `movimiento` rows for a category spanning the current month and previous months
- WHEN the category's monthly spend is computed
- THEN only movimientos dated within the current calendar month SHALL be summed

### Requirement: Heat ratio classification

The system SHALL compute `ratio = gasto_mes_actual / promedio_3_meses_anteriores` per category and classify it hot (red) when `ratio > 1.5`, warm (amber) when `ratio > 1.15` and not hot, and neutral otherwise. Both comparisons SHALL use strict greater-than (`>`), not `>=`.

#### Scenario: Ratio clearly above the hot threshold

- GIVEN a category's ratio is 1.6
- WHEN classification runs
- THEN the category SHALL render hot (red)

#### Scenario: Ratio exactly at the hot boundary (1.5)

- GIVEN a category's ratio is exactly 1.5
- WHEN classification runs
- THEN the category SHALL NOT render hot, because 1.5 is not `> 1.5`
- AND SHALL render warm, because 1.5 is `> 1.15`

#### Scenario: Ratio between the warm and hot thresholds

- GIVEN a category's ratio is 1.3
- WHEN classification runs
- THEN the category SHALL render warm (amber)

#### Scenario: Ratio exactly at the warm boundary (1.15)

- GIVEN a category's ratio is exactly 1.15
- WHEN classification runs
- THEN the category SHALL NOT render warm, because 1.15 is not `> 1.15`
- AND SHALL render neutral

#### Scenario: Ratio at or below the warm boundary

- GIVEN a category's ratio is 1.0
- WHEN classification runs
- THEN the category SHALL render neutral (no heat coloring)

### Requirement: Insufficient history forces neutral

When fewer than 1 full prior month of `movimiento` history exists for a category (i.e. `promedio_3_meses_anteriores` cannot be reliably computed), the system SHALL render that category neutral regardless of its computed or computable ratio.

#### Scenario: Category has no data before the current month

- GIVEN a category has `movimiento` rows only in the current month, none in prior months
- WHEN classification runs
- THEN the category SHALL render neutral
- AND the system MUST NOT divide by zero or throw an error

### Requirement: Bar-fill width scales proportionally within the list

The system SHALL render each category's bar-fill width proportional to its `gasto_mes_actual` relative to the highest-spending category in the current list, so the highest-spending category's bar appears fullest.

#### Scenario: Relative bar widths

- GIVEN three categories with `gasto_mes_actual` of 1000, 800, and 400, where 1000 is the highest
- WHEN the category list renders
- THEN the 1000 category's bar SHALL render at, or near, full width
- AND the 800 and 400 categories' bars SHALL render visibly narrower, proportional to their share of 1000

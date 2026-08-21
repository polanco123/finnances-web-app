# metas-ahorro

## Purpose

`/metas` panel for manually declaring savings goals ("fondo de emergencia", "viaje", "regalo") and tracking progress via a dated contribution/withdrawal log (`meta_abono`), with a progress-over-time chart. Phase 1 only: excludes linking a real `movimiento` to a `meta` (Phase 2, future hook only), excludes any auto-sync with a `cuenta` balance, and is verified via `npm run lint` + `npm run build` + manual browser testing, not automated tests.

## Requirements

### Requirement: Goal creation with optional non-zero initial amount and target date

The system MUST allow creating a `meta` with `nombre`, `monto_objetivo`, an optional `monto_inicial` (may be non-zero, defaults to 0), and an optional nullable `fecha_objetivo`.

#### Scenario: Creating a goal with a non-zero starting amount and a target date

- GIVEN the user opens the goal creation form
- WHEN they submit `nombre="Viaje"`, `monto_objetivo=20000`, `monto_inicial=5000`, `fecha_objetivo=2027-01-01`
- THEN a `meta` row SHALL be created with those values and `activa=true`

#### Scenario: Creating a goal without a target date

- GIVEN the user opens the goal creation form for "Fondo de emergencia"
- WHEN they submit `monto_objetivo` and leave `fecha_objetivo` empty
- THEN the `meta` row SHALL be created with `fecha_objetivo=NULL`
- AND the goal SHALL render without error

### Requirement: Goal editing

The system MUST allow editing `nombre`, `monto_objetivo`, `monto_inicial`, and `fecha_objetivo` of an existing active goal without altering its `meta_abono` history.

#### Scenario: Editing a goal's target amount preserves its abono history

- GIVEN a goal has 3 `meta_abono` entries
- WHEN the user edits `monto_objetivo` to a new value
- THEN the goal SHALL persist the new `monto_objetivo`
- AND all 3 `meta_abono` entries SHALL remain unchanged

### Requirement: Archiving a goal is a soft-delete; no hard delete exists

The system MUST archive a goal by setting `activa=false` and MUST NOT provide any action that hard-deletes a `meta` row or its `meta_abono` rows.

#### Scenario: Archiving a goal sets activa=false and preserves its abonos

- GIVEN an active goal has 4 `meta_abono` entries
- WHEN the user archives the goal
- THEN the `meta` row SHALL have `activa=false`
- AND all 4 `meta_abono` rows SHALL remain in the database, unmodified

### Requirement: Default goal list excludes archived goals

The default `/metas` list MUST render only `activa=true` goals; `activa=false` goals MUST NOT appear in it, though their data remains intact and retrievable elsewhere in the panel.

#### Scenario: Archived goal is hidden from the default list

- GIVEN one goal has `activa=true` and another has `activa=false`
- WHEN `/metas` loads its default view
- THEN only the `activa=true` goal SHALL render in the list
- AND the `activa=false` goal SHALL NOT appear

### Requirement: Abono log entries are individually created, edited, and deleted

The system MUST allow adding, editing, and deleting individual `meta_abono` rows, each with a signed `monto` (positive = contribution, negative = withdrawal), a required `fecha`, and an optional `nota`. Editing or deleting one entry MUST NOT affect any other entry.

#### Scenario: Adding a positive contribution

- GIVEN a goal exists
- WHEN the user adds a `meta_abono` with `monto=500`, `fecha=2026-08-20`
- THEN a new `meta_abono` row SHALL be created linked to that goal

#### Scenario: Adding a negative withdrawal

- GIVEN a goal exists
- WHEN the user adds a `meta_abono` with `monto=-200`, `fecha=2026-08-21`
- THEN a new `meta_abono` row SHALL be created with the negative amount, distinct from a contribution

#### Scenario: Editing one abono leaves other entries untouched

- GIVEN a goal has 3 `meta_abono` entries
- WHEN the user edits the `monto` of one entry
- THEN only that entry SHALL change
- AND the other 2 entries SHALL remain unchanged

#### Scenario: Deleting one abono leaves other entries untouched

- GIVEN a goal has 3 `meta_abono` entries
- WHEN the user deletes one entry
- THEN that entry SHALL no longer exist
- AND the remaining 2 entries SHALL be unaffected

### Requirement: Progress is computed client-side from monto_inicial and the abono sum

The system MUST compute `monto_actual = monto_inicial + SUM(meta_abono.monto)` client-side (no Postgres RPC), and MUST compute the completion percentage as `monto_actual / monto_objetivo`.

#### Scenario: A goal with zero abonos shows progress equal to its initial amount

- GIVEN a goal has `monto_inicial=1000` and zero `meta_abono` rows
- WHEN its progress is computed
- THEN `monto_actual` SHALL equal `1000`

#### Scenario: A negative abono can bring progress below the initial amount

- GIVEN a goal has `monto_inicial=1000` and one `meta_abono` of `monto=-300`
- WHEN its progress is computed
- THEN `monto_actual` SHALL equal `700`, below `monto_inicial`

### Requirement: "Cumplida" is a derived display state and never auto-archives the goal

The system MUST treat "cumplida" (`monto_actual >= monto_objetivo`) as a computed display state only, never a stored column, and reaching or exceeding `monto_objetivo` MUST NOT change `activa` or block further `meta_abono` entries.

#### Scenario: Reaching the target does not archive the goal

- GIVEN a goal has `monto_objetivo=1000` and `monto_actual=1000` after its latest abono
- WHEN the panel renders the goal
- THEN it SHALL display a "cumplida" indicator
- AND the goal SHALL remain `activa=true`
- AND the user SHALL still be able to add further `meta_abono` entries

#### Scenario: Exceeding the target still does not archive the goal

- GIVEN a goal has `monto_objetivo=1000` and `monto_actual=1200`
- WHEN the panel renders the goal
- THEN it SHALL display "cumplida"
- AND the goal SHALL NOT be automatically archived

### Requirement: Progress-over-time chart from abono history

The system MUST render a chart plotting cumulative `monto_actual` ordered by `meta_abono.fecha`, without using Recharts.

#### Scenario: Chart reflects the ordered abono history

- GIVEN a goal has `meta_abono` entries dated out of insertion order
- WHEN the chart renders
- THEN points SHALL be plotted in ascending `fecha` order
- AND each point SHALL reflect the cumulative `monto_actual` at that date

### Requirement: No movimiento linking or cuenta auto-sync in Phase 1

The system MUST NOT provide any UI or data path linking a `meta` to a `movimiento` row, and MUST NOT auto-sync a goal's progress from any `cuenta` balance.

#### Scenario: No account or movement selector appears on goal or abono forms

- GIVEN the user opens the goal creation form or the abono entry form
- WHEN the form is inspected
- THEN no `cuenta` or `movimiento` selection field SHALL be present

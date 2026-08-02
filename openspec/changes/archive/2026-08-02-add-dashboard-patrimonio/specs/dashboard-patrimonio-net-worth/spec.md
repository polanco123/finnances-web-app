# dashboard-patrimonio-net-worth

## Purpose

Hero net-worth figure, trend, and disponible/retiro split on the Patrimonio dashboard (`/reportes`), computed live from `cuenta.saldo_real` for the current state and from `patrimonio_snapshot` history for trend/comparison.

## ADDED Requirements

### Requirement: Net worth hero figure

The system SHALL display `patrimonio_neto = SUM(saldo_real)` across `activa = true` `cuenta` rows as the dashboard's hero number, computed live (not read from `patrimonio_snapshot`) so it always reconciles with `/cuentas`.

#### Scenario: Hero figure reconciles with /cuentas

- GIVEN the same set of active accounts and `saldo_real` values shown on `/cuentas`
- WHEN the Patrimonio dashboard's hero number renders
- THEN it SHALL equal the sum of `saldo_real` shown on `/cuentas`

### Requirement: Delta chip against most recent prior snapshot

The system SHALL show a delta chip comparing today's live `patrimonio_neto` against the most recent `patrimonio_snapshot` row dated strictly before today, labeled "desde hace N días" where N is the actual number of calendar days between that snapshot's `fecha` and today — not hardcoded to 1/"ayer".

#### Scenario: Comparison snapshot is not necessarily yesterday

- GIVEN the most recent `patrimonio_snapshot` row prior to today is dated 2 days ago (e.g. the job did not run yesterday)
- WHEN the delta chip renders
- THEN it SHALL read "desde hace 2 días"
- AND the delta amount SHALL compare against that 2-days-ago row's `patrimonio_neto`, not an assumed "yesterday" value

#### Scenario: Net worth increased since the compared snapshot

- GIVEN today's live `patrimonio_neto` is greater than the compared prior snapshot's `patrimonio_neto`
- WHEN the delta chip renders
- THEN it SHALL show a positive delta with "up" (green) styling

#### Scenario: Net worth decreased since the compared snapshot

- GIVEN today's live `patrimonio_neto` is less than the compared prior snapshot's `patrimonio_neto`
- WHEN the delta chip renders
- THEN it SHALL show a negative delta with "down" (red) styling

#### Scenario: No prior snapshot exists

- GIVEN `patrimonio_snapshot` has zero rows dated before today
- WHEN the dashboard renders
- THEN the delta chip SHALL render in a neutral/empty state instead of a computed comparison
- AND MUST NOT throw an unhandled error

### Requirement: 14-day sparkline

The system SHALL render a sparkline of up to the last 14 `patrimonio_snapshot` rows ordered by `fecha` ascending, one bar per row.

#### Scenario: Full 14-day history available

- GIVEN 14 or more `patrimonio_snapshot` rows exist
- WHEN the sparkline renders
- THEN it SHALL show exactly the 14 most recent rows, oldest to newest, left to right

#### Scenario: Sparse history renders fewer bars

- GIVEN only 1 `patrimonio_snapshot` row exists (e.g. day 1 after this feature ships)
- WHEN the sparkline renders
- THEN it SHALL render only that 1 bar
- AND MUST NOT pad the remaining slots with fabricated zero-value bars
- AND MUST NOT throw an unhandled error

### Requirement: Disponible / Retiro split

The system SHALL display `disponible = patrimonio_neto - retiro` and `retiro = SUM(saldo_real) WHERE es_fondo_retiro = true`, computed live over active accounts, with a "N cuentas" sub-label on the retiro cell counting active accounts flagged `es_fondo_retiro = true`.

#### Scenario: Disponible is positive

- GIVEN `patrimonio_neto` is 10000 and `retiro` is 3000
- WHEN the split renders
- THEN disponible SHALL show 7000 in normal (non-alert) styling

#### Scenario: Disponible is negative

- GIVEN `retiro` exceeds `patrimonio_neto` (e.g. neto 2000, retiro 3000)
- WHEN the split renders
- THEN disponible SHALL show -1000
- AND SHALL use the same red/"down" styling used for a negative delta

#### Scenario: Retiro cell shows the account count

- GIVEN 5 active accounts flagged `es_fondo_retiro = true`
- WHEN the retiro cell renders
- THEN it SHALL show a sub-label reading "5 cuentas"

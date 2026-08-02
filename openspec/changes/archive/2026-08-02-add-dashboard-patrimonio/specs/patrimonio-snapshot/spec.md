# patrimonio-snapshot

## Purpose

Data-layer capability: the `patrimonio_snapshot` table and the daily job that populates it. Feeds the Patrimonio dashboard's 14-day sparkline and delta-since-N-days chip. No UI or read-facing behavior lives in this capability — it is writes plus the underlying computation contract only.

## ADDED Requirements

### Requirement: patrimonio_snapshot table schema and uniqueness

The system SHALL persist one row per calendar date in a `patrimonio_snapshot` table with `fecha` UNIQUE, and `patrimonio_neto`, `patrimonio_disponible`, `total_activos`, `total_deudas` all typed `DECIMAL(14,2) NOT NULL`.

#### Scenario: One row per date enforced by schema

- GIVEN the `patrimonio_snapshot` table
- WHEN a row already exists for a given `fecha`
- THEN the schema's unique constraint on `fecha` SHALL prevent a second distinct row for that same `fecha`

#### Scenario: Monetary columns computed from saldo_real, not saldo_calculado

- GIVEN active `cuenta` rows with both `saldo_real` and `saldo_calculado` populated and differing
- WHEN `patrimonio_neto`, `total_activos`, and `total_deudas` are computed for the snapshot
- THEN the computation SHALL use `SUM(cuenta.saldo_real)` exclusively
- AND `saldo_calculado` SHALL NOT be read for this computation

### Requirement: Snapshot values derived from active accounts

The system SHALL compute, scoped to `activa = true` accounts: `patrimonio_neto = SUM(saldo_real)`; `patrimonio_disponible = patrimonio_neto - SUM(saldo_real WHERE es_fondo_retiro = true)`; `total_activos = SUM(saldo_real) WHERE saldo_real > 0`; `total_deudas = SUM(saldo_real) WHERE saldo_real < 0`, stored as its positive magnitude.

#### Scenario: Standard computation

- GIVEN active accounts with saldo_real values 1000, 500, and -200, where the 500 account is flagged `es_fondo_retiro = true`
- WHEN the daily snapshot computes
- THEN `patrimonio_neto` SHALL be 1300, `patrimonio_disponible` SHALL be 800, `total_activos` SHALL be 1500, and `total_deudas` SHALL be 200

#### Scenario: Inactive accounts excluded

- GIVEN an `activa = false` account with a nonzero `saldo_real`
- WHEN the daily snapshot computes
- THEN that account's `saldo_real` SHALL NOT contribute to any of the four snapshot columns

### Requirement: Daily upsert is idempotent per date

A daily job (Supabase Edge Function triggered by `pg_cron`) SHALL upsert the current date's row via `INSERT ... ON CONFLICT (fecha) DO UPDATE`, so re-running the job on the same date overwrites rather than duplicates.

#### Scenario: First run of the day inserts a new row

- GIVEN no `patrimonio_snapshot` row exists yet for today's `fecha`
- WHEN the job runs
- THEN a new row SHALL be inserted for today's `fecha`

#### Scenario: Same-day re-run overwrites, does not duplicate

- GIVEN a `patrimonio_snapshot` row already exists for today's `fecha` (e.g. from an earlier run or a manual retry)
- WHEN the job runs again on the same calendar date with updated account balances
- THEN the existing row for that `fecha` SHALL be updated in place
- AND the table SHALL still contain exactly one row for that `fecha` after the run

#### Scenario: A new day creates a new row, not an update

- GIVEN a `patrimonio_snapshot` row exists for yesterday's `fecha`
- WHEN the job runs today
- THEN a new row SHALL be inserted for today's `fecha`
- AND yesterday's row SHALL remain unchanged

# cuentas-overview

## Purpose

Read-only overview page listing the user's active bank/credit accounts with their current balance and recent activity, replacing the "Cuentas" sidebar placeholder stub.

## Requirements

### Requirement: Live account listing scoped to active accounts

The system MUST fetch accounts from the live `cuenta` table via Supabase (not the static `data/cuenta.ts` catalog) and MUST render only rows where `activa = true`.

#### Scenario: Only active accounts are rendered

- GIVEN the `cuenta` table has both `activa = true` and `activa = false` rows
- WHEN the Cuentas page loads
- THEN the page SHALL render one card/section per `activa = true` account
- AND accounts with `activa = false` SHALL NOT appear

#### Scenario: No active accounts exist

- GIVEN the `cuenta` table has zero rows with `activa = true`
- WHEN the Cuentas page loads
- THEN the page SHALL render without throwing an unhandled error
- AND SHALL show no account cards

### Requirement: Balance display uses saldo_real exclusively

Each account card MUST display `saldo_real` as the current balance. The system MUST NOT display `saldo_calculado` anywhere on this page.

#### Scenario: Account card shows saldo_real

- GIVEN an active account with `saldo_real = 1500.00` and a different `saldo_calculado` value
- WHEN its card renders
- THEN the displayed balance SHALL equal `saldo_real`
- AND `saldo_calculado` SHALL NOT appear on the card

### Requirement: Per-account recent activity

For each rendered account, the system MUST query the 5 most recent `movimiento` rows scoped by `cuenta_id`, ordered by `fecha` descending, and MUST render them using the existing `components/movement/movement-list-item.tsx` component unchanged, including its existing `es_transferencia` special-case label.

#### Scenario: Account with more than 5 movements shows only the 5 most recent

- GIVEN an account has 12 `movimiento` rows with varying `fecha` values
- WHEN its card renders
- THEN exactly 5 rows SHALL be shown
- AND they SHALL be the 5 rows with the most recent `fecha`, in descending order

#### Scenario: Account with fewer than 5 movements shows all of them

- GIVEN an account has 2 `movimiento` rows
- WHEN its card renders
- THEN both rows SHALL be shown
- AND no error or placeholder SHALL indicate a expected count of 5

#### Scenario: Account with zero movements

- GIVEN an account has no `movimiento` rows
- WHEN its card renders
- THEN the card SHALL render its balance
- AND SHALL show an empty-state for activity, not an error

#### Scenario: Transfer movements retain existing label

- GIVEN one of the 5 most recent rows has `es_transferencia = true`
- WHEN it renders via `movement-list-item.tsx`
- THEN it SHALL display the component's existing "Transferencia" label
- AND SHALL NOT attempt to show the paired account of the transfer

### Requirement: No user-scoping on cuenta/movimiento queries

Because neither `cuenta` nor `movimiento` has a `user_id` column, queries against these tables MUST NOT filter by `user_id`.

#### Scenario: Query omits user_id filter

- GIVEN the Cuentas page issues its Supabase queries for `cuenta` and `movimiento`
- WHEN the queries are inspected
- THEN neither SHALL include an `.eq('user_id', ...)` filter

### Requirement: Read-only page

The Cuentas page MUST NOT provide any UI for creating, editing, or deleting accounts.

#### Scenario: No mutation affordances present

- GIVEN the Cuentas page is rendered
- WHEN the page is inspected
- THEN no create/edit/delete controls for accounts SHALL be present

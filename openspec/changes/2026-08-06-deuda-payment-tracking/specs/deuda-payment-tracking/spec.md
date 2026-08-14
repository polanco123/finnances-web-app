# deuda-payment-tracking

## Purpose

`/deudas` panel for recording and tracking payment status of `cuenta.tipo = 'deuda'` accounts (credit cards, loans) on a per-period basis: the amount planned/due, whether it was paid, and the actual amount paid — independent of and never overwriting prior periods' records.

## Requirements

### Requirement: Scope restricted to deuda-typed accounts

The `/deudas` panel MUST list only accounts where `cuenta.tipo = 'deuda'`. Accounts of any other `tipo` MUST NOT appear on this panel.

#### Scenario: Only deuda-typed accounts are listed

- GIVEN the `cuenta` table has accounts with `tipo = 'deuda'` and accounts with other `tipo` values
- WHEN the `/deudas` panel loads
- THEN it SHALL render one row/card per `tipo = 'deuda'` account
- AND accounts with a different `tipo` SHALL NOT appear

### Requirement: Period-scoped historical payment records

The system MUST persist payment data as one record per `(cuenta, periodo)` pair. Writing a record for a given account and period MUST NOT overwrite or delete any existing record for that same account in a different period — each period's record is preserved independently and permanently.

#### Scenario: A new month's record does not erase a prior month's record

- GIVEN an account has an existing record for a prior period with `monto_planeado = 500` and `pagado = true`
- WHEN the user creates a record for that same account for the current (different) period
- THEN the prior period's record SHALL remain unchanged and retrievable
- AND the new record SHALL exist as a separate row, not a modification of the prior one

### Requirement: Planned amount is recorded per account and period

The system MUST allow the user to create or edit `monto_planeado` (the amount due) for the current period, per deuda account. `monto_planeado` is required for a record to be considered to have a planned amount.

#### Scenario: Recording a planned amount for the current period

- GIVEN a deuda account has no record yet for the current period
- WHEN the user enters a planned amount of `1200` for that account
- THEN a record for `(cuenta, periodo=current)` SHALL be created or updated with `monto_planeado = 1200`
- AND `pagado` SHALL remain `false` (or its existing value) — setting a planned amount SHALL NOT itself mark the period as paid

### Requirement: Paid status and actual paid amount are recorded independently of the planned amount

The system MUST allow the user to toggle `pagado` and record `monto_pagado` for the current period's record, independently of `monto_planeado`. `monto_pagado` is nullable and is only meaningful once `pagado = true`. `monto_pagado` MAY differ from `monto_planeado` (partial or extra payment); both values MUST be preserved independently, never merged or overwritten into a single field.

#### Scenario: Marking a period paid with an amount that differs from the planned amount

- GIVEN a record exists for the current period with `monto_planeado = 1200` and `pagado = false`
- WHEN the user marks the period as paid and records `monto_pagado = 1000` (a partial payment)
- THEN the record SHALL have `pagado = true`, `monto_planeado = 1200` (unchanged), and `monto_pagado = 1000`
- AND neither value SHALL overwrite the other

#### Scenario: Marking a period paid with an amount exceeding the planned amount

- GIVEN a record exists for the current period with `monto_planeado = 1200` and `pagado = false`
- WHEN the user marks the period as paid and records `monto_pagado = 1300` (an extra payment)
- THEN the record SHALL have `pagado = true`, `monto_planeado = 1200` (unchanged), and `monto_pagado = 1300`

### Requirement: Setting the planned amount and marking paid are independent operations

The user MUST be able to perform either action without the other: setting `monto_planeado` MUST NOT require `pagado`/`monto_pagado` to be set in the same action, and marking `pagado`/`monto_pagado` at a later time MUST NOT require re-entering `monto_planeado`.

#### Scenario: Setting a planned amount without marking paid

- GIVEN a deuda account has no record for the current period
- WHEN the user sets `monto_planeado = 800` and takes no other action
- THEN the record SHALL exist with `monto_planeado = 800` and `pagado = false`
- AND no `monto_pagado` value SHALL be required or implied

#### Scenario: Marking paid later without re-entering the planned amount

- GIVEN a record exists for the current period with `monto_planeado = 800` and `pagado = false`
- WHEN the user, at a later time, marks the record as paid with `monto_pagado = 800` without re-entering `monto_planeado`
- THEN the record SHALL have `pagado = true`, `monto_pagado = 800`, and `monto_planeado` SHALL remain `800` unchanged from the earlier entry

### Requirement: Empty state when no deuda accounts exist

The system MUST render the `/deudas` panel without error when zero accounts with `tipo = 'deuda'` exist.

#### Scenario: No deuda accounts exist

- GIVEN the `cuenta` table has zero rows with `tipo = 'deuda'`
- WHEN the `/deudas` panel loads
- THEN the page SHALL render without throwing an unhandled error
- AND SHALL show an empty-state message instead of any account row

### Requirement: Periodo is computed per account from its own payment day

The system MUST compute each account's `periodo` from that account's own `dia_pago`, not from a value shared across every deuda account on the panel. When an account has no `dia_pago` configured, the system MUST NOT create a payment record for that account and MUST NOT fall back to any default day of the month.

#### Scenario: Two accounts with different payment days get different periodos

- GIVEN a deuda account A has `dia_pago = 5` and a deuda account B has `dia_pago = 28`
- WHEN a new payment record is created for each account on the same day
- THEN account A's record's `periodo` SHALL reflect its own next occurrence of day 5
- AND account B's record's `periodo` SHALL reflect its own next occurrence of day 28
- AND the two `periodo` values SHALL NOT be forced to match each other

#### Scenario: Creating a record is blocked when no payment day is configured

- GIVEN a deuda account has `dia_pago = null`
- WHEN the user views that account's card on the `/deudas` panel
- THEN the panel SHALL NOT allow creating a payment record for that account
- AND SHALL present an explanatory message instead of a blank/default periodo

### Requirement: Payment day and cutoff day are displayed per account

The `/deudas` panel MUST display each account's own `dia_corte` and `dia_pago` values, read-only. When both are absent, the panel MUST omit this display rather than show an empty or placeholder value.

#### Scenario: Both cutoff and payment day are configured

- GIVEN a deuda account has `dia_corte = 5` and `dia_pago = 30`
- WHEN the `/deudas` panel renders that account's card
- THEN the card SHALL display both values (e.g. "Corte: día 5 · Pago: día 30")

#### Scenario: Neither cutoff nor payment day is configured

- GIVEN a deuda account has `dia_corte = null` and `dia_pago = null`
- WHEN the `/deudas` panel renders that account's card
- THEN the card SHALL omit the cutoff/payment-day display entirely, without an empty placeholder

### Requirement: A paid record becomes read-only history; the next record is a separate, confirmed action

Once an account's latest payment record is marked paid, the system MUST treat that record as read-only (no further edits to its planned amount, paid amount, or periodo). Creating that account's next payment record MUST be a distinct, explicitly confirmed action, and MUST NOT silently reuse or mutate the paid record.

#### Scenario: A paid record cannot be edited further

- GIVEN an account's latest payment record has `pagado = true`
- WHEN the user views that account's card
- THEN the panel SHALL show the record's final values without an edit control for `monto_planeado`, `monto_pagado`, or `periodo`

#### Scenario: Registering the next payment requires explicit confirmation

- GIVEN an account's latest payment record has `pagado = true`
- WHEN the user initiates registering the account's next payment
- THEN the system SHALL compute and display the proposed next `periodo` before any record is created
- AND SHALL require the user to explicitly confirm before creating the new record
- AND the newly created record SHALL be a separate row from the prior paid record, per the existing period-scoped historical record requirement

### Requirement: No historical backfill — sparse history is expected, not an error

The system MUST NOT backfill payment records for periods before this feature ships. History accumulates going forward only, starting from the current period.

#### Scenario: Fresh deploy shows only the current period

- GIVEN this feature has just shipped and no payment records exist for any past period
- WHEN the `/deudas` panel loads for a deuda account
- THEN it SHALL show the current period with no planned amount or payment recorded yet (not an error state)
- AND any per-account history view SHALL show zero or few entries without this being treated as broken or incomplete data

## Amendment (2026-08-14): Table/month-tabs redesign

**Do not read this as replacing the requirements above** — every data-level requirement above (period-scoped records, independent planned/paid amounts, per-account `periodo` computation, no historical backfill) still applies unchanged. This amendment covers ONLY the presentation layer: the collapsible-card list is replaced with a 12-tab month selector plus a data-grid table (one row per account per selected month). Where earlier scenarios describe "the card" as the rendering surface, the equivalent rendering surface is now "the account's row in the selected month's table" — the underlying behavior (what data is shown, what actions are allowed in which state) is unchanged, only the DOM shape changed from an expandable card to a table row.

### Requirement: Month-tab navigation restricted to the current calendar year

The `/deudas` panel MUST offer a 12-tab month selector (Enero–Diciembre) scoped to the current calendar year. A year switcher is explicitly out of scope for this amendment. The tab matching today's month MUST be selected by default on page load. Selecting a different tab MUST re-filter the table to that month without a full page reload.

#### Scenario: Default tab matches today's month

- GIVEN today's date falls within a given calendar month
- WHEN the `/deudas` panel first loads
- THEN the month tab matching today's month SHALL be selected
- AND the table SHALL show that month's rows

#### Scenario: Selecting a different month tab re-filters the table

- GIVEN the `/deudas` panel is showing one month's rows
- WHEN the user clicks a different month tab
- THEN the table SHALL re-render showing only that month's account rows
- AND no other month tab's data SHALL be shown simultaneously

### Requirement: Every active deuda account has a row for every month tab, with or without a record

For a given month tab, the table MUST show one row per active `tipo='deuda'` account, regardless of whether that account has an actual `deuda_pago` record whose `periodo` falls within that month. When no such record exists, the row MUST render in a "sin registrar" state for that account+month rather than being omitted.

#### Scenario: An account with no record for the selected month still gets a row

- GIVEN a deuda account has a payment record only for March, and the user selects the April tab
- WHEN the table renders for April
- THEN the account SHALL still appear as a row
- AND that row SHALL show a "sin registrar" state, not be omitted from the table

#### Scenario: An account's record for the selected month is shown when it exists

- GIVEN a deuda account has a payment record whose `periodo` falls within the selected month
- WHEN the table renders for that month
- THEN the row SHALL show that record's real `periodo`, `monto_planeado`, `monto_pagado`, `notas`, and paid state

### Requirement: Creating a record for a non-current month defaults its periodo to that month, not to "next occurrence from today"

When the user creates a "sin registrar" row's first record from a month tab other than the current month, the suggested `periodo` MUST default to a date clamped within THAT selected month/year (using the account's `dia_pago`), not to the next chronological occurrence of `dia_pago` from today's date.

#### Scenario: Creating a record from a future month tab defaults to that month

- GIVEN the user has selected a month tab for a future month (not the current month)
- AND selects a "sin registrar" account row to create a record
- WHEN the create form opens
- THEN the suggested `periodo` SHALL be a date within the selected future month, clamped to the account's `dia_pago`
- AND SHALL NOT be a date in the current month

### Requirement: Notes may be recorded per payment record

Each `deuda_pago` record MAY have an optional free-text `notas` field, editable independently of `monto_planeado`, `periodo`, and `pagado`. `notas` is nullable and has no effect on the record's computed state (`sin-registrar`/`pendiente`/`pagado`).

#### Scenario: Adding a note to an existing record

- GIVEN a payment record exists for an account in the selected month
- WHEN the user enters free text into that row's notes field
- THEN the record's `notas` SHALL be updated to that text
- AND no other field on the record SHALL change as a result

### Requirement: The table shows per-month totals for planned and paid amounts

The table MUST display a totals row for the currently selected month: the sum of `monto_planeado` across all rows that have a record in that month (regardless of paid status), and the sum of `monto_pagado` across all rows that are paid in that month. Rows with no record MUST contribute zero to both sums.

#### Scenario: Totals reflect only rows with records

- GIVEN the selected month has 3 accounts with records (`monto_planeado` 100, 200, 300; the 300 one is also paid with `monto_pagado = 300`) and 2 accounts with no record
- WHEN the table renders the totals row
- THEN the planned total SHALL be 600 (100 + 200 + 300)
- AND the paid total SHALL be 300 (only the paid record's `monto_pagado`)
- AND the 2 accounts with no record SHALL contribute 0 to both totals

# Delta for dashboard-patrimonio-proximo-vencimiento

## MODIFIED Requirements

### Requirement: Next occurrence of dia_pago resolves to a concrete date

For each active account with `tipo = 'deuda'` and a non-null `dia_pago`, the system SHALL resolve the next occurrence date as: if today's day-of-month is less than or equal to the effective `dia_pago` for the current month, the occurrence is in the current month; otherwise it is in the next month. The "effective dia_pago" for a given month is `dia_pago` clamped down to that month's last day when `dia_pago` exceeds the number of days in that month. Accounts with a non-null `dia_pago` whose `tipo` is not `'deuda'` MUST be excluded from resolution entirely.
(Previously: scoped to "active credit-card account with a non-null `dia_pago`" without an explicit `tipo = 'deuda'` restriction, relying only on `dia_pago IS NOT NULL` to proxy "credit card".)

#### Scenario: Due date later this month

- GIVEN today is the 10th and an account has `dia_pago = 27`
- WHEN the next occurrence is resolved
- THEN it SHALL be the 27th of the current month

#### Scenario: Due date already passed this month

- GIVEN today is the 28th and an account has `dia_pago = 15`
- WHEN the next occurrence is resolved
- THEN it SHALL be the 15th of next month, not a past date in the current month

#### Scenario: Month-boundary clamp in February (non-leap year)

- GIVEN the current month is February of a non-leap year (28 days) and an account has `dia_pago = 30`
- WHEN the next occurrence is resolved for February
- THEN the effective `dia_pago` for February SHALL clamp to the 28th

#### Scenario: Month-boundary clamp in February (leap year)

- GIVEN the current month is February of a leap year (29 days) and an account has `dia_pago = 30`
- WHEN the next occurrence is resolved for February
- THEN the effective `dia_pago` for February SHALL clamp to the 29th

#### Scenario: Non-deuda account with dia_pago set is excluded

- GIVEN an account has `tipo` other than `'deuda'`, `activa = true`, and a non-null `dia_pago` (a data-modeling inconsistency, since `dia_pago` is documented as a `deuda`/credit-card-only field)
- WHEN `fetchProximosVencimientos()` runs
- THEN that account SHALL NOT appear in its results
- AND it SHALL NOT be resolved to a next-occurrence date or produce a due-date strip, regardless of how close `dia_pago` is to today

## ADDED Requirements

### Requirement: Recorded payment amount displayed alongside the due date

When a `deuda-payment-tracking` record exists for the current period for an account shown in the "Próximo vencimiento" widget, the due-date strip SHALL display the recorded amount next to the date: `monto_planeado` when `pagado = false`, or `monto_pagado` when `pagado = true`. When no such record exists for the current period, the strip SHALL show only the date, exactly as before this change — this is a graceful fallback, not an error or incomplete state.

#### Scenario: Record exists and is unpaid — planned amount is shown

- GIVEN a `deuda-payment-tracking` record exists for the current period for an account with `monto_planeado = 1200` and `pagado = false`
- WHEN that account's due-date strip renders
- THEN the strip SHALL display `1200` alongside the due date

#### Scenario: Record exists and is paid — paid amount is shown

- GIVEN a `deuda-payment-tracking` record exists for the current period for an account with `monto_planeado = 1200`, `pagado = true`, and `monto_pagado = 1000`
- WHEN that account's due-date strip renders
- THEN the strip SHALL display `1000` (the recorded `monto_pagado`), not `1200`, alongside the due date

#### Scenario: No record exists for the current period — date-only fallback

- GIVEN no `deuda-payment-tracking` record exists for the current period for an account shown in the widget
- WHEN that account's due-date strip renders
- THEN the strip SHALL display only the due date, with no amount shown
- AND this SHALL NOT be treated as an error or broken state

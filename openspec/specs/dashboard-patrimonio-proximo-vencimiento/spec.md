# dashboard-patrimonio-proximo-vencimiento

## Purpose

Upcoming credit-card due-date strip(s) on the Patrimonio dashboard (`/reportes`), derived from `cuenta.dia_pago`, alerting within a 7-day window. Scoped strictly to `dia_corte`/`dia_pago`-driven credit-card due dates — no general bill/commitment tracking (no `pago_mensual`-style table).

## ADDED Requirements

### Requirement: Next occurrence of dia_pago resolves to a concrete date

For each active credit-card account with a non-null `dia_pago`, the system SHALL resolve the next occurrence date as: if today's day-of-month is less than or equal to the effective `dia_pago` for the current month, the occurrence is in the current month; otherwise it is in the next month. The "effective dia_pago" for a given month is `dia_pago` clamped down to that month's last day when `dia_pago` exceeds the number of days in that month.

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

### Requirement: 7-day alert window

The system SHALL render a due-date strip only for accounts whose resolved next-occurrence date falls within 7 days of today, inclusive.

#### Scenario: Within the window

- GIVEN an account's next occurrence is 3 days from today
- WHEN the dashboard renders
- THEN a due-date strip SHALL be shown for that account, indicating it is due in 3 days

#### Scenario: Outside the window

- GIVEN an account's next occurrence is 10 days from today
- WHEN the dashboard renders
- THEN no due-date strip SHALL be shown for that account

### Requirement: Multiple strips stack, most urgent first

When more than one account's next occurrence falls within the 7-day window, the system SHALL render one strip per account, ordered by ascending days remaining (soonest due date first).

#### Scenario: Two cards within the window

- GIVEN account A is due in 5 days and account B is due in 2 days
- WHEN the dashboard renders
- THEN both strips SHALL be shown
- AND account B's strip SHALL appear before account A's strip

### Requirement: Empty state when no cards fall within the window

The system SHALL render no due-date strips, and MUST NOT show an error or broken state, when zero accounts fall within the 7-day window.

#### Scenario: No cards due soon

- GIVEN no active credit-card account's next occurrence falls within 7 days
- WHEN the dashboard renders
- THEN the "Próximo vencimiento" section SHALL render without any strip
- AND MUST NOT display an error state

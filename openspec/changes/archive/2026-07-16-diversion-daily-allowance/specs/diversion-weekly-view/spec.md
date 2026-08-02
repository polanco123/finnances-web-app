# diversion-weekly-view

## ADDED Requirements

### Requirement: Daily allowance remaining
The system SHALL display how much the user can spend per day for the rest of the active week, computed from the remaining budget and the number of days left (inclusive of today) until the active week's `fecha_fin`. This requirement applies only when an active `fondo_semanal` row exists for today (see "Active week resolution" and "Empty state when no active week"); it does not apply in the no-active-week empty state.

`remaining = monto_presupuestado - spent`. `daysLeft` is the count of days from today through `fecha_fin`, inclusive of both endpoints. `dailyAllowance = floor(remaining / daysLeft)`, always rounded down, never clamped.

#### Scenario: Daily allowance for the rest of the week
- **GIVEN** an active week with `monto_presupuestado` 1500 and spent 565, so remaining is 935
- **AND** today is Thursday and the active week's `fecha_fin` is the following Sunday, so `daysLeft` is 4
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as 233 (935 / 4 = 233.75, floored)

#### Scenario: Overspent week shows a negative daily allowance
- **GIVEN** an active week where `remaining` is -50 and `daysLeft` is 2
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as -25
- **AND** the system SHALL NOT clamp the value to 0

#### Scenario: Last day of the active week
- **GIVEN** an active week where today equals `fecha_fin`, so `daysLeft` is 1
- **WHEN** the daily allowance is computed
- **THEN** the system SHALL report `dailyAllowance` as exactly `remaining` (floored), with no division applied beyond the floor
</content>

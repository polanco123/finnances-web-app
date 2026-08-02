# Tasks: Diversion Daily Allowance

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~75 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default (budget: 800 lines) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Date utility + component + integration + verify | PR 1 | Single PR; additive only, no refactoring |

## Phase 1: Foundation — Date Utility

- [x] 1.1 Add `getDaysRemainingInclusive(fechaFin: string, today: string): number` export to `components/diversion/diversion-week-range.ts`. Compute millisecond diff via `new Date(fechaFin).getTime() - new Date(today).getTime()`, divide by 86400000 with `Math.round`, add 1 for inclusive count, guard with `Math.max(1, …)`.
- [x] 1.2 Manually verify `getDaysRemainingInclusive` edge cases: today == fechaFin → 1; 4 days apart → 4; past fechaFin → 1 (guard floor).

## Phase 2: Core Component — Daily Allowance Display

- [x] 2.1 Create `components/diversion/diversion-daily-allowance.tsx` with `'use client'` directive. Define `DiversionDailyAllowanceProps { amount: number }`. Copy `formatCurrency` locally (Intl.NumberFormat `es-MX`, MXN, 2 fraction digits). Render `{formatCurrency(amount)}/día`.
- [x] 2.2 Create `components/diversion/diversion-daily-allowance.css`. Mirror `diversion-progress.css` tokens: `--theme-bg-surface`, `--theme-radius-lg`, `--theme-shadow-2`, `--theme-spacing-4`, `--theme-font-family`, `--theme-font-size-sm`, `--theme-text-primary`. Include `.dark` block with glass-bg pattern.

## Phase 3: Integration — Wire into Page

- [x] 3.1 In `app/diversion/page.tsx`: import `getDaysRemainingInclusive` (add to existing import from `diversion-week-range`). Import `DiversionDailyAllowance` from `components/diversion/diversion-daily-allowance`.
- [x] 3.2 After the `spent` derivation (~line 97), add: `const remaining = activeWeek.monto_presupuestado - spent`, `const daysLeft = getDaysRemainingInclusive(activeWeek.fecha_fin, today)`, `const dailyAllowance = Math.floor(remaining / daysLeft)`.
- [x] 3.3 After `<DiversionProgress>` in the JSX return (~line 147), render `<DiversionDailyAllowance amount={dailyAllowance} />`.

## Phase 4: Verification

- [x] 4.1 Verify normal case: budget $1,500, spent $565, 4 days → renders "$233.00/día". Load `/diversion` with matching data.
- [x] 4.2 Verify overspend case: spent > budget → renders negative (e.g. "-$25.00/día") via `Intl.NumberFormat`, unclamped, no crash.
- [x] 4.3 Verify last-day case: today == fecha_fin, daysLeft=1 → dailyAllowance equals full remaining.
- [x] 4.4 Run `npm run lint` and `npm run build` — both must pass with zero errors.

# Design: Diversion Daily Allowance

## Technical Approach

Add a derived `dailyAllowance` figure to the existing `/diversion` view, computed entirely from data already in scope (`spent`, `activeWeek.monto_presupuestado`, `activeWeek.fecha_fin`, `today`). No new fetch, no new Supabase call. The day-count math is added as a second pure export in the already-established `diversion-week-range.ts` domain-utility file (the same file that hosts `getCurrentWeekRange`), and the allowance itself is a `const` derived in `app/diversion/page.tsx` alongside the existing `spent` derivation. Rendering is a new sibling component, `DiversionDailyAllowance`, following the project's single-responsibility split (mirrors why `DiversionBudgetEdit` was pulled out of `DiversionProgress` rather than merged in).

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| UI placement | New sibling component `components/diversion/diversion-daily-allowance.tsx` + `.css` | Extend `DiversionProgress` props to `{spent, budget, dailyAllowance}` | Progress bar answers "how much of my budget is gone" (spent-vs-budget, a ratio); the allowance answers "how much can I spend today" (a spend-rate projection). Different facts, different inputs (one needs `fecha_fin`/`today`, the other doesn't) and different failure modes (division by budget vs. division by days). Matches the repo's established pattern of one component per concern (`DiversionBudgetEdit` was already split out for the same reason, not folded into `DiversionProgress`). Extending `DiversionProgress` would couple date math into a component whose current job is purely a ratio bar. |
| Day-count math location | Exported pure function `getDaysRemainingInclusive(fechaFin: string, today: string): number` in `components/diversion/diversion-week-range.ts` | Inline `const` in `page.tsx` | `diversion-week-range.ts` already exists as the domain's date-utility file (`getCurrentWeekRange`); colocating keeps all Mon-Sun/date-range math for this feature in one place, matches the precedent set in the prior design (colocated over shared `lib/date/`), and is independently testable as a pure function without touching component state. |
| Allowance derivation location | `const dailyAllowance` in `page.tsx`, immediately after the existing `spent` derivation (~line 97) | Compute inside `DiversionDailyAllowance` from raw props | `page.tsx` already computes `spent` as a derived value from state in scope; `remaining`/`daysLeft`/`dailyAllowance` are one more derivation step at the same layer, keeping `DiversionDailyAllowance` a pure display component (props in, JSX out), consistent with `DiversionProgress`. |
| Date arithmetic | Millisecond diff via plain `Date`, `Math.round` (not `Math.floor`/`ceil`) on the day-count division | `date-fns`/`dayjs` `differenceInCalendarDays` | No date library in `package.json`; `Math.round` (not floor) on `diffMs / 86400000` guards against a day being computed as 0.958 or 1.042 across a DST transition, which `floor` would silently miscount by a day. |
| Negative currency display | `formatCurrency` reused as-is from `diversion-progress.tsx`, no special-casing | Manually prefix `-` and format `Math.abs(amount)` | `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })` renders negative input as `-$233.00` (minus sign before currency symbol) per ICU CLDR es-MX negative pattern — already the desired unclamped warning format from the proposal. No manual sign handling needed. |
| Guard against daysLeft <= 0 | `Math.max(1, diffDays + 1)` inside `getDaysRemainingInclusive` | Let it return 0/negative, division produces `Infinity`/`NaN` | Active-week filtering (`fecha_inicio<=today<=fecha_fin`) means `daysLeft` should never be `<=0` in practice, but a defensive floor at 1 avoids `Infinity`/`NaN` rendering if the invariant is ever violated (e.g. stale client state after a slow refetch). |

## Data Flow

    DiversionContent (existing state: activeWeek, movements)
         │
         ▼
    spent = Math.max(0, -SUM(movements.monto))        [existing, unchanged]
         │
         ▼
    remaining = activeWeek.monto_presupuestado - spent           [new]
    daysLeft  = getDaysRemainingInclusive(activeWeek.fecha_fin, today)  [new, from diversion-week-range.ts]
    dailyAllowance = Math.floor(remaining / daysLeft)             [new]
         │
         ▼
    <DiversionProgress spent budget />              [unchanged]
    <DiversionDailyAllowance amount={dailyAllowance} />   [new]

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `components/diversion/diversion-week-range.ts` | Modify | Add second export `getDaysRemainingInclusive(fechaFin: string, today: string): number` |
| `app/diversion/page.tsx` | Modify | Add `remaining`/`daysLeft`/`dailyAllowance` derived `const`s after the existing `spent` derivation; render `<DiversionDailyAllowance>` |
| `components/diversion/diversion-daily-allowance.tsx` | Create | Pure display component; formats and renders the "$X/día" figure |
| `components/diversion/diversion-daily-allowance.css` | Create | Styling, mirrors `diversion-progress.css` token usage (`--theme-*` vars, dark-mode block) |

## Interfaces / Contracts

```ts
// diversion-week-range.ts
export function getDaysRemainingInclusive(fechaFin: string, today: string): number

// diversion-daily-allowance.tsx
interface DiversionDailyAllowanceProps {
  amount: number // dailyAllowance; may be negative, unclamped
}
export default function DiversionDailyAllowance(props: DiversionDailyAllowanceProps): JSX.Element
```

`page.tsx` derivation, colocated with existing `spent` const:

```ts
const remaining = activeWeek.monto_presupuestado - spent
const daysLeft = getDaysRemainingInclusive(activeWeek.fecha_fin, today)
const dailyAllowance = Math.floor(remaining / daysLeft)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getDaysRemainingInclusive` day-count math | Pure function test (no test runner configured in repo — documented as manual verification per project precedent) |
| Manual/behavioral | Normal case: budget $1,500, spent $565, 4 days left → $233/día | Load `/diversion` mid-week with known movements; visually confirm `formatCurrency(233)` |
| Manual/behavioral | Boundary: today == `fecha_fin` (last day, daysLeft=1) | `dailyAllowance` must equal full `remaining`, not divide by 0 or a stale multi-day count |
| Manual/behavioral | Overspend: `spent > monto_presupuestado` | `remaining` negative → `dailyAllowance` renders as `-$X/día` via `Intl.NumberFormat`, unclamped, no crash |

## Migration / Rollout

No migration required. Purely additive derived UI on existing, already-fetched data; no schema or Supabase query change.

## Open Questions

None — formula, overspend handling, and timezone deferral were resolved in the proposal; component placement and calculation location are resolved above.

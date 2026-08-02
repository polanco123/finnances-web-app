## Why

The `/diversion` view (shipped in `2026-07-16-diversion-weekly-budget`) already shows spent-vs-budget for the current week, but it doesn't answer the question the user actually needs in the moment: "how much can I spend today without blowing the rest of the week?" Today the user has to do that division mentally from the progress bar. A small derived "$X/día" figure closes that gap using data the view already has in scope.

## What Changes

- On `/diversion`, compute and display a daily allowance for the rest of the current week:
  - `remaining = monto_presupuestado - spent` (using the existing, already-floored-at-0 `spent` value from `app/diversion/page.tsx`).
  - `daysLeft = days from today to the active week's fecha_fin, inclusive of today` (e.g. today Thursday, fecha_fin Sunday → 4 days).
  - `dailyAllowance = floor(remaining / daysLeft)`.
- Overspend case: if `remaining` is negative, display the negative value as-is (e.g. "-$50/día") — a deliberate warning signal, not clamped to $0.
- Worked example: budget $1,500, spent $565 → remaining $935; 4 days left → 935/4 = 233.75 → shown as **$233/día**.

## Non-Goals

- No fix for the existing `toISOString()` UTC-vs-local "today" mismatch already present in `page.tsx` — this feature reuses that same `today` value and inherits its known, deliberately deprioritized limitation. A separate app-wide timezone feature is planned; not touched here.
- No decision locked yet on where this renders in the component tree (extending `DiversionProgress`'s props vs. a new sibling component) — left open for the design phase.
- No change to the existing `spent = Math.max(0, ...)` clamping convention in `page.tsx` — this proposal only consumes that value, it does not revisit how it's computed.

## Assumptions to Validate

- None new. This feature reads fields (`spent`, `monto_presupuestado`, active week's `fecha_fin`) that are already fetched and validated by the existing, shipped `diversion-weekly-view` capability. No new data source, schema, or Supabase call is introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `diversion-weekly-view`: add a "daily allowance remaining" derived display (remaining budget divided across remaining days of the active week, including the overspent/negative case) alongside the existing spent-vs-budget progress indicator.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/diversion/page.tsx` | Modified | Add `remaining`/`daysLeft`/`dailyAllowance` derivation right after the existing `spent` derivation (~line 97), where `today` and `activeWeek.fecha_fin` are already in scope |
| `components/diversion/diversion-progress.tsx` (or a new sibling component, TBD) | Modified or New | Render the "$X/día" figure; design phase decides whether this extends `DiversionProgress`'s props or lives in a new `diversion-daily-allowance.tsx` |

## Resolved Decisions

Confirmed by the user on 2026-07-16 — final, not open questions:

1. **Formula**: `remaining = monto_presupuestado - spent`; `daysLeft` counts today through `fecha_fin` inclusive; `dailyAllowance = floor(remaining / daysLeft)`.
2. **Overspend handling**: negative `remaining` is shown as a negative "$X/día" figure, unclamped — an intentional warning signal.
3. **Timezone edge case**: the existing `toISOString()` UTC-vs-local mismatch in how "today" is computed is explicitly deferred to a future app-wide timezone feature; this change inherits it rather than fixing it in isolation.

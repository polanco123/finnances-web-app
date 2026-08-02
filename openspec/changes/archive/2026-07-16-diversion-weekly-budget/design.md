# Design: Diversion Weekly Budget

## Technical Approach

Mirror the `components/movement/` form+mapper+service split into a new `components/diversion/` domain, in TypeScript, plus a flat `/diversion` route. No proxy/middleware change: `proxy.ts` already gates all authenticated paths. The route is a client component with a `Suspense` boundary, following the exact structure of `app/movimientos/page.tsx`.

Key wrinkle: `movimiento` has **no `tipo` column**. `movement-mapper.js` encodes gasto/ingreso via **sign of `monto`** (gasto → negative, see `movement-form.jsx:145`). The spec's "spent = gasto minus ingreso/reembolso" maps directly onto this: `spent = -SUM(monto)` over Diversión personal rows in range. No extra type field needed — a positive row already offsets a negative one.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Active week resolution | Filter `fondo_semanal` by `fecha_inicio <= today <= fecha_fin` only | Filter by `activo = true` (alone or combined) | Spec defines active as date-containment. `activo` semantics are unconfirmed (proposal Assumptions); trusting an unverified flag as primary predicate risks hiding a valid week. `activo` is displayed, not filtered on. |
| Spent calculation | `spent = -SUM(monto)` over Diversión personal rows in range | Separate gasto/ingreso queries, subtract | Existing sign convention already encodes the net; one query, one reduce, matches all spec scenarios. |
| Progress bar | Reuse hand-rolled `category-bar__fill` width-% CSS from `app/dashboard/page.tsx` | Add shadcn `Progress` component | No shadcn `progress` installed; hand-rolled pattern is established in-repo and avoids a new dependency for a plain bar with no threshold states. |
| Week-range helper location | New `components/diversion/diversion-week-range.ts`, colocated | `lib/date/week-range.ts` shared utility, `diversion-date.ts` (too generic) | Monday-Sunday math is only needed by this domain; no date library exists in the repo. Avoids a speculative shared module before a second consumer exists. Named `week-range` — precise about what it does. |
| Gasto monto sign | `diversion-mapper.ts` forces `monto = -Math.abs(Number(monto))` before insert | Store positive monto with implicit `tipo: gasto` | Matches `movement-mapper.js` precedent; required for the net-spent formula to hold. |
| AutocompleteInput in diversion-form | Extract `AutocompleteInput` to `components/ui/autocomplete-input.tsx` as a reusable shared component | Duplicate inline code in diversion-form | Extraction avoids ~50 lines of duplication and enables future reuse; scoped change, not a refactor spiral. |
| Overlapping fondo_semanal tiebreaker | `fetchActiveWeek` uses `ORDER BY fecha_inicio DESC LIMIT 1` | Return first match without ordering | Deterministic: the most recent row whose range contains today wins. No spec-based reason to prefer one over the other, but arbitrary is worse than explicit. |
| Budget edit componentization | Separate `DiversionBudgetEdit` component | Inline edit in `DiversionContent` or `DiversionForm` | Budget edit mutates `fondo_semanal`, not `movimiento`; separate component keeps concerns isolated and matches single-responsibility. |
| Progress bar: negative spent guard | `spent = Math.max(0, -SUM(monto))` | Floor at 0 inside the progress component | Prevents negative width when only reembolsos exist; displayed as zero spent. |
| Progress bar: division-by-zero guard | If `monto_presupuestado <= 0`, render zero-width bar with "Sin presupuesto" label | Compute `(spent / budget) * 100` unconditionally | Prevents Infinity/NaN from DB rows with zero or null budget. |
| Progress bar: overflow | Cap bar width at `min(100, (spent / budget) * 100)%` | Unbounded width | Prevents layout breakage when spent > budget. |
| fetchActiveWeek: error vs empty | `fetchActiveWeek` distinguishes: Supabase error → throw (caught by caller) → `error` state in `DiversionContent`; empty result set → return `null` → `DiversionEmptyState` | Null coalesces both cases | User needs to know whether to retry (error) or configure a budget (empty). |

## Data Flow

    DiversionPage ('use client', Suspense)
         │
         ▼
    DiversionContent (state: activeWeek, movimientos, loading, error)
         │
         ├──▶ diversion-service.fetchActiveWeek(today)
         │         │
         │         ▼
         │    fondo_semanal WHERE fecha_inicio<=today<=fecha_fin
         │
         ├──▶ diversion-service.fetchWeekMovements(fecha_inicio, fecha_fin)
         │         │
         │         ▼
         │    movimiento WHERE categoria_id=DIVERSION_ID
         │                AND fecha BETWEEN range
         │
         ▼
    activeWeek == null?
         │                          │
        YES                        NO
         │                          │
         ▼                          ▼
    DiversionEmptyState      DiversionProgress (spent = -SUM(monto), total = monto_presupuestado)
    (no form rendered)       DiversionForm ──▶ diversion-mapper ──▶ insertDiversionMovimiento ──▶ refetch
                             Budget edit ──▶ updateBudget ──▶ refetch active week
                             movimientos.map(DiversionListItem)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/diversion/page.tsx` | Create | Client route, Suspense wrapper, orchestrates fetch + empty/main state switch |
| `components/diversion/diversion-week-range.ts` | Create | `getCurrentWeekRange(): { fecha_inicio: string; fecha_fin: string }` — Monday-Sunday, hand-rolled `Date` |
| `components/diversion/diversion-mapper.ts` | Create | `crearGastoDiversion(...)` — hardcodes `categoria_id`, forces negative monto |
| `components/diversion/diversion-service.ts` | Create | `fetchActiveWeek`, `fetchWeekMovements`, `insertDiversionMovimiento`, `updateBudget` |
| `components/diversion/diversion-form.tsx` | Create | Gasto-only form; cuenta autocomplete (mirrors `AutocompleteInput`); no categoria selector |
| `components/diversion/diversion-list-item.tsx` | Create | Simplified `MovementListItem`; no transfer styling |
| `components/diversion/diversion-progress.tsx` | Create | Spent-vs-budget bar using `category-bar__fill` CSS pattern |
| `components/diversion/diversion-empty-state.tsx` | Create | No-active-week message, form/edit control withheld |
| `data/categoria.ts` | None | `Diversión personal` id already present |

## Interfaces / Contracts

```ts
interface FondoSemanal {
  id: string
  fecha_inicio: string   // YYYY-MM-DD
  fecha_fin: string
  monto_presupuestado: number
  activo: boolean        // read-only display, not used as filter predicate
}

const DIVERSION_CATEGORIA_ID = 'af6b676c-04db-4fda-b9f7-349123d75e1a'

function fetchActiveWeek(): Promise<FondoSemanal | null>
function fetchWeekMovements(fecha_inicio: string, fecha_fin: string): Promise<Movimiento[]>
function insertDiversionMovimiento(payload: MovimientoInsert): Promise<Movimiento[]>
function updateBudget(fondoSemanalId: string, monto_presupuestado: number): Promise<FondoSemanal[]>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `diversion-mapper` sign flip, `diversion-date` Mon-Sun math (incl. week boundaries) | Pure function tests, no Supabase |
| Unit | Spent calc (`-SUM(monto)`) against spec scenarios (gasto-only, gasto+reembolso) | Pure reducer test |
| Integration | Empty-state gating (no form/edit control rendered without active week) | Component test mocking `fetchActiveWeek` → null |
| Integration | Insert failure leaves list unchanged; update failure leaves budget unchanged | Component test mocking service rejection |

## Migration / Rollout

No migration required — `fondo_semanal` already exists live. **Pre-implementation step**: run a `select *` (or Supabase dashboard inspection) against `fondo_semanal` to confirm column names/types/nullability before `diversion-service.ts` is finalized, per proposal's Assumption #5. This is a `sdd-apply` task, not a schema change.

## Spec Alignment Note

The spec `diversion-expense-registration/spec.md` references "tipo: gasto" as if a `tipo` column exists on `movimiento` (lines 19, 24). The actual data model has no `tipo` column — gasto/ingreso is encoded via the sign of `monto`. The design resolves this correctly (sign-based approach). Task implementation should interpret "tipo: gasto" as "negative monto" per existing `movement-mapper` convention.

## Resolved Open Questions (from design review)

The following questions from the initial draft were resolved by fresh-context design review and are now binding:

- **AutocompleteInput origin**: Extract to `components/ui/autocomplete-input.tsx` as a prerequisite.
- **Overlapping rows**: `fetchActiveWeek` uses `ORDER BY fecha_inicio DESC LIMIT 1`.
- **Budget edit component**: Separate `DiversionBudgetEdit` component.
- **Negative spent guard**: `Math.max(0, -SUM(monto))`.
- **Division-by-zero guard**: `monto_presupuestado <= 0` → zero-width bar + "Sin presupuesto" label.
- **Progress bar overflow cap**: `min(100, (spent / budget) * 100)%`.
- **Error vs empty**: `fetchActiveWeek` throws on Supabase error → caller error state; returns `null` → empty state.
- **Week-range file name**: `diversion-week-range.ts` (not `diversion-date.ts`).

## Open Questions

- [ ] Confirm `fondo_semanal` actual column types/nullability against live Supabase (blocks finalizing `diversion-service.ts` types).
- [ ] Confirm no `user_id`/RLS scoping column exists on `fondo_semanal` that the query must filter by (single-user assumption per proxy.ts model).
- [ ] Confirm whether any existing `movimiento` rows for Diversión personal already exist with a literal `tipo` field the spec's "tipo: gasto" wording might be referencing — if so, sign-based approach needs revisiting.

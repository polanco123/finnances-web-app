# Tasks: Diversion Weekly Budget

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750-900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes (resolved — user chose chained PRs)
Chained PRs recommended: Yes
400-line budget risk: High

### Chained PR Plan (stacked-to-main)

| PR | Branch | Scope | Est. lines | Description |
|----|--------|-------|------------|-------------|
| 1 | `diversion/pr-1-infra` | Phase 1 + Phase 2 | ~250-350 | AutocompleteInput extraction + data layer (week-range, mapper, service, schema verification). No UI changes — safe to merge to main independently. |
| 2 | `diversion/pr-2-ui` | Phase 3 + Phase 4 + Phase 5 | ~450-550 | All diversion UI components, route, CSS, wiring, and verification. |

Each PR merges directly to main in order (stacked-to-main). PR 2 depends on PR 1's infrastructure being on main first.

## Phase 1: Prerequisite — Extract AutocompleteInput

- [x] 1.1 Create `components/ui/autocomplete-input.tsx` — extract `AutocompleteInput` from `movement-form.jsx:13-104` as reusable TSX component
- [x] 1.2 Create `components/ui/autocomplete-input.css` — extract autocomplete-related styles from `movement-form.css`
- [x] 1.3 Update `components/movement/movement-form.jsx` — remove inline `AutocompleteInput`, import from `@/components/ui/autocomplete-input`
- [x] 1.4 Verify `/movimientos` page loads and form autocomplete still works after extraction

## Phase 2: Data Layer

- [x] 2.1 Create `components/diversion/diversion-week-range.ts` — `getCurrentWeekRange()` returning Mon-Sun `{fecha_inicio, fecha_fin}` via hand-rolled `Date`
- [x] 2.2 Create `components/diversion/diversion-mapper.ts` — `crearGastoDiversion(cuenta_id, monto, fecha)` hardcodes `categoria_id`, forces `monto = -Math.abs(Number(monto))`
- [x] 2.3 Verify `fondo_semanal` schema against live Supabase — confirm column names/types/nullability before finalizing service types
- [x] 2.4 Create `components/diversion/diversion-service.ts` — `fetchActiveWeek(today)`, `fetchWeekMovements(inicio, fin)`, `insertDiversionMovimiento(payload)`, `updateBudget(id, monto)`

## Phase 3: UI Components

- [x] 3.1 Create `components/diversion/diversion-empty-state.tsx` — message when no active week; no form or budget controls rendered
- [x] 3.2 Create `components/diversion/diversion-progress.tsx` — spent-vs-budget bar: `Math.max(0, -SUM)`, div-by-zero guard (`<=0` → "Sin presupuesto"), cap at `min(100, %)`, reuse `category-bar__fill` pattern
- [x] 3.3 Create `components/diversion/diversion-list-item.tsx` — simplified list item; no transfer styling; shows monto, cuenta, fecha
- [x] 3.4 Create `components/diversion/diversion-budget-edit.tsx` — mutate `monto_presupuestado` on active `fondo_semanal` row; reject non-positive input
- [x] 3.5 Create `components/diversion/diversion-form.tsx` — gasto-only form; cuenta autocomplete via `AutocompleteInput`; no categoria selector; default date = today

## Phase 4: Route & Integration

- [x] 4.1 Create `app/diversion/page.tsx` — `'use client'`, `Suspense` boundary, `DiversionContent`: fetch active week → render `DiversionEmptyState` (null) or `DiversionProgress` + `DiversionForm` + `DiversionBudgetEdit` + mapped `DiversionListItem`s
- [x] 4.2 Create diversion CSS files — `diversion-progress.css`, `diversion-form.css`, `diversion-list-item.css`, `diversion-page.css`
- [x] 4.3 Wire refetch: `insertDiversionMovimiento` success → refetch movements + recompute spent; `updateBudget` success → refetch active week

## Phase 5: Verification

- [x] 5.1 Verify active week fetch: `fecha_inicio <= today <= fecha_fin`, `ORDER BY fecha_inicio DESC LIMIT 1`
- [x] 5.2 Verify empty state gating: no form, no budget edit, no progress bar when `fetchActiveWeek` → null
- [x] 5.3 Verify progress bar guards: zero/nil budget → "Sin presupuesto", spent > budget → capped bar, reembolso-only → zero width
- [x] 5.4 Verify form validation: missing monto/cuenta blocks submit; non-positive monto blocked
- [x] 5.5 Run `npm run lint && npm run build` — zero errors

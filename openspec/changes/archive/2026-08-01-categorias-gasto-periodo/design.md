# Design: Categorías — Gasto por Periodo

## Technical Approach

New `components/categorias/` domain, mirroring the `{domain}-service.ts` + `.tsx` + `.css` split already used by `cuentas/`, `diversion/`, `patrimonio/`. One bounded Supabase fetch per period (`gte('fecha', desde).lte('fecha', hasta).lt('monto', 0)`), then 100% client-side filtering (against the static `data/categoria.ts` catalog) and `Map`-based aggregation — same no-RPC architecture as `fetchCategoriasDelMes()`. All movimientos for the period are fetched once and held in state; expand/collapse is pure UI, no per-card fetch. `categorias-dates.ts` gets its own hand-rolled `getTodayLocal()` (third near-duplicate, per proposal's explicit non-consolidation decision) and reuses `getCurrentWeekRange()` from `diversion-week-range.ts` via import for "semanal" (function-level reuse, not a new date-utils module — consistent with existing cross-domain component reuse like `cuentas-card.tsx` importing `MovementListItem`). The dashboard's `fetchCategoriasDelMes()` gets a one-condition fix so `/reportes` and `/categorias` agree numerically.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Gasto-category allowlist location | `GASTO_TIPOS` constant + `esCategoriaDeGasto(tipo)` helper exported from `data/categoria.ts` | `lib/catalogs/categorias.js` (thin re-export) | `patrimonio-service.ts` already imports `CATEGORIAS` directly from `@/data/categoria` (not from the shim); `categorias-service.ts` imports from the same path so both literally share one reference — no risk of the two allowlists drifting apart. Also re-exported from `lib/catalogs/categorias.js` for parity with other consumers (1-line addition). |
| Why consolidate this but not date helpers | Shared `GASTO_TIPOS`/`esCategoriaDeGasto`, but still 3 separate `getTodayLocal()` | Duplicate both, or consolidate both | Different risk class: the tipo-allowlist is business data (5 hand-typed strings) that could silently drift if edited in only one of two places, causing `/reportes` and `/categorias` to disagree — the exact bug this change fixes. `getTodayLocal()` is trivial pure math (today's date); duplicated implementations cannot diverge in output. Consolidate only where disagreement is possible. |
| Bulk range fetch | `fetchMovimientosEnPeriodo(desde, hasta)` using `.gte('fecha', desde).lte('fecha', hasta)` (inclusive both ends) | Exclusive upper bound (`fechaFinExclusiva`, mirroring `fetchCategoriasDelMes()`) | All 6 range functions naturally produce an inclusive last day (day 15, day 31, Dec 31, user's own "hasta"); inclusive `.lte()` avoids a +1-day translation step in every range function. `fetchCategoriasDelMes()` keeps its own independent exclusive-bound convention — the two functions never call each other, so this is not an inconsistency. |
| Percentage rounding | `Math.round((total / sumaTotal) * 100)` per category, no correction | Largest-remainder adjustment so percentages sum to exactly 100 | Rounded percentages summing to 99 or 101 is an accepted, known cosmetic property of independent per-item rounding — not worth a remainder-distribution algorithm at this scale. |
| Custom range validation | Clamp: picking `desde` > current `hasta` pushes `hasta` up to match (and vice versa); native `min`/`max` on the date inputs as a first line of defense | Reject with inline error message | Clamping guarantees `desde <= hasta` is never violated in state, with zero extra UI/copy; simplest correct thing per two native `<input type="date">`, matching existing single-date-input convention (no new library). |
| Period filter UI | 6-button segmented group (`role="group"`, `aria-pressed`), custom range inputs render inline beneath when "Por periodo" is active | `<select>` dropdown (dashboard's `filter-select` pattern) | The dashboard's `<select>` is a supplementary filter in a space-constrained dash-card. Here the period selector is the page's primary control — a button group shows all 6 options at a glance and has room to host the nested date-range UI beneath it, which a native `<select>`'s `<option>` list cannot do. |
| Custom date-range picker component | Inline sub-section of `categorias-period-filter.tsx` (no separate file) | Standalone `categorias-date-range-picker.tsx` | Proposal's Impact table lists only `categorias-period-filter.tsx` + `.css`; the range picker has no reuse case elsewhere, so a second file adds indirection without benefit. |
| Local `Movimiento` type in `categorias-service.ts` | Own local interface (mirrors `movement-service.ts` fields + `id`) | Import `Movimiento` from `@/components/movement/movement-service` | Matches `cuentas-service.ts`'s existing precedent (its own local `Movimiento`, not imported) — per-domain-folder service types stay self-contained; component reuse (`MovementListItem`) is a separate, already-established pattern. |
| Zero-gasto category exclusion | Structural: a category only ever enters the aggregation `Map` when a qualifying row exists | Explicit post-filter `.filter(c => c.total > 0)` | Unlike `fetchCategoriasDelMes()` (which unions two buckets, current + trailing, so needs an explicit filter), this aggregation has one bucket set — no category can appear with `total === 0`. |

## Dashboard Consistency Fix (exact diff)

`components/patrimonio/patrimonio-service.ts`:

```ts
// import line:
import { CATEGORIAS, esCategoriaDeGasto } from '@/data/categoria'   // add esCategoriaDeGasto

// inside fetchCategoriasDelMes()'s aggregation loop:
for (const row of data ?? []) {
  const categoriaId = row.categoria_id as string
  const categoria = CATEGORIAS.find((c) => c.id === categoriaId)
  if (!categoria || !esCategoriaDeGasto(categoria.tipo)) continue   // NEW

  const monto = Math.abs(row.monto as number)
  const fecha = row.fecha as string
  const bucket = fecha >= currentMonthStart ? gastoMesActual : gastoTrailing
  bucket.set(categoriaId, (bucket.get(categoriaId) ?? 0) + monto)
}
```

No other lines change; the rest of the function (nombre resolution, ratio/heat classification, sort) is untouched.

## Data Flow

    CategoriasPage mount / periodo button click / range-input edit
         │
         ▼
    resolveRango(periodo, desdePersonalizado, hastaPersonalizado)
         │  (día|semanal|quincenal|mensual|anual → categorias-dates.ts function
         │   periodo → { desde: desdePersonalizado, hasta: hastaPersonalizado })
         ▼
    { desde, hasta }  ──▶ useEffect([desde, hasta]) ──▶ fetchCategoriasConGasto(desde, hasta)
                                                              │
                                                              ▼
                                            fetchMovimientosEnPeriodo(desde, hasta)
                                            movimiento WHERE fecha BETWEEN [desde,hasta] AND monto<0
                                                              │
                                                              ▼
                                   client-side: CATEGORIAS.find(categoria_id) → esCategoriaDeGasto(tipo)?
                                                keep → Map<categoriaId, {total,count,movimientos[]}>
                                                              │
                                                              ▼
                                    sort desc by total, porcentaje = round(total/sumaTotal*100)
                                                              │
                                                              ▼
    CategoriaCard[] rendered (collapsed) ──expand──▶ movimientos.map(MovementListItem)  (already in state, no refetch)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/categorias/categorias-dates.ts` | Create | `getRangoDia/Semanal/Quincenal/Mensual/Anual()`, local `getTodayLocal/getTodayLocalDate/toISODate` |
| `components/categorias/categorias-service.ts` | Create | `fetchMovimientosEnPeriodo`, `fetchCategoriasConGasto`, local `Movimiento`/`CategoriaConGasto` types |
| `components/categorias/categorias-card.tsx` | Create | Collapsible card, mirrors `cuentas-card.tsx` |
| `components/categorias/categorias-card.css` | Create | Card styles, mirrors `cuenta-card.css` |
| `components/categorias/categorias-period-filter.tsx` | Create | 6-button period group + inline custom range inputs |
| `components/categorias/categorias-period-filter.css` | Create | Filter styles |
| `app/(app)/categorias/page.tsx` | Modify | Stub → real client page, mirrors `app/(app)/cuentas/page.tsx` composition |
| `app/(app)/categorias/page.css` | Create | Page layout |
| `components/app-shell/sidebar.tsx` | Modify | Remove `comingSoon: true` on Categorías (line 28) |
| `components/patrimonio/patrimonio-service.ts` | Modify | `fetchCategoriasDelMes()` gains `esCategoriaDeGasto` filter |
| `data/categoria.ts` | Modify | Add `GASTO_TIPOS` const + `esCategoriaDeGasto(tipo)` export |
| `lib/catalogs/categorias.js` | Modify | Re-export `GASTO_TIPOS`, `esCategoriaDeGasto` |
| `components/movement/movement-list-item.tsx` | None | Reused as-is (no `descripcion` render — accepted per proposal) |

## Interfaces / Contracts

```ts
// data/categoria.ts (addition)
export const GASTO_TIPOS = ['compromiso', 'discrecional', 'suscripcion', 'trabajo', 'hogar'] as const
export function esCategoriaDeGasto(tipo: string): boolean {
  return (GASTO_TIPOS as readonly string[]).includes(tipo)
}

// components/categorias/categorias-dates.ts
export interface RangoFecha { desde: string; hasta: string }
export function getTodayLocal(): string
export function getTodayLocalDate(): Date
export function toISODate(date: Date): string
export function getRangoDia(): RangoFecha
export function getRangoSemanal(): RangoFecha        // wraps getCurrentWeekRange()
export function getRangoQuincenal(): RangoFecha       // day<=15 → [1,15]; else → [16, lastDayOfMonth]
export function getRangoMensual(): RangoFecha
export function getRangoAnual(): RangoFecha
// "Por periodo" has no function — direct { desde, hasta } from the two <input type="date">

// components/categorias/categorias-service.ts
export interface Movimiento {
  id: string; monto: number; descripcion?: string | null; fecha: string; hora?: string | null
  cuenta_id: string; categoria_id: string; notas?: string | null; created_at: string
  es_transferencia?: boolean | null; transferencia_id?: string | null
}
export interface CategoriaConGasto {
  categoriaId: string; nombre: string; total: number; count: number
  porcentaje: number; movimientos: Movimiento[]
}
export function fetchMovimientosEnPeriodo(desde: string, hasta: string): Promise<Movimiento[]>
export function fetchCategoriasConGasto(desde: string, hasta: string): Promise<CategoriaConGasto[]>

// components/categorias/categorias-period-filter.tsx
export type PeriodoTipo = 'dia' | 'semanal' | 'quincenal' | 'mensual' | 'anual' | 'periodo'
interface CategoriasPeriodFilterProps {
  periodo: PeriodoTipo
  desdePersonalizado: string
  hastaPersonalizado: string
  onPeriodoChange: (periodo: PeriodoTipo) => void
  onRangoPersonalizadoChange: (desde: string, hasta: string) => void
}

// components/categorias/categorias-card.tsx
interface CategoriaCardProps { categoria: CategoriaConGasto }
```

Quincenal boundary algorithm (exact):
```ts
export function getRangoQuincenal(): RangoFecha {
  const today = getTodayLocalDate()
  const year = today.getFullYear(); const month = today.getMonth(); const day = today.getDate()
  if (day <= 15) {
    return { desde: toISODate(new Date(year, month, 1)), hasta: toISODate(new Date(year, month, 15)) }
  }
  const lastDay = new Date(year, month + 1, 0).getDate()   // day 0 of next month = last day of this month
  return { desde: toISODate(new Date(year, month, 16)), hasta: toISODate(new Date(year, month, lastDay)) }
}
```

`fetchCategoriasConGasto` body (exact): fetch via `fetchMovimientosEnPeriodo`; for each row, resolve `CATEGORIAS.find(c => c.id === mov.categoria_id)`, skip if missing or `!esCategoriaDeGasto(categoria.tipo)`; else accumulate into `Map<categoriaId, {total, count, movimientos}>` (`total += Math.abs(monto)`, `count += 1`, push row); after the loop, `sumaTotal = sum of all bucket totals`; map buckets to `CategoriaConGasto[]` with `porcentaje = sumaTotal > 0 ? Math.round(total/sumaTotal*100) : 0`; sort descending by `total`.

Page (`app/(app)/categorias/page.tsx`) refetch trigger: `useEffect(() => { fetchCategoriasConGasto(desde, hasta)... }, [desde, hasta])` where `{ desde, hasta } = resolveRango(periodo, desdePersonalizado, hastaPersonalizado)` is recomputed every render. Both a period-button click (changes `periodo`) and a custom-range edit (changes `desdePersonalizado`/`hastaPersonalizado`) flow through the same single dependency pair — one refetch mechanism, no duplicated effects. `desdePersonalizado`/`hastaPersonalizado` initialize to `getTodayLocal()`.

## Testing Strategy

No test runner in repo — all rows are manual/behavioral browser verification.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Pure logic | All 6 `categorias-dates.ts` ranges, incl. both quincenal boundaries (day 15 and day 16) | Trace function output by hand against today's real date and a mocked day-16 date |
| Aggregation | Totals/percentages match a hand-tallied sum of the rendered movimientos for at least one category in one period | Expand a card, sum its `MovementListItem` amounts, compare to the card header total and `%` |
| Aggregation | Zero-gasto categories never appear | Pick a period with no movimientos in a known category; confirm no card renders for it |
| UI | Empty state renders when zero qualifying movimientos exist for the period | Select "día" on a day with no gasto |
| UI | Collapse/expand is independent per card | Expand two cards, collapse one, confirm the other stays expanded |
| UI | Custom range clamps instead of allowing `desde > hasta` | In "Por periodo", set `hasta` before `desde`, then push `desde` past it; confirm the other field moves |
| Cross-page | `/reportes` "Categorías del mes" and `/categorias` "Mensual" report the same total per category | Compare both for the current month after the `fetchCategoriasDelMes()` fix |
| Visual | Dark mode renders correctly | Toggle theme, check card/filter contrast via `theme.css` tokens |
| Navigation | Sidebar Categorías link has no "Próximamente" badge and routes to the real page | Click the sidebar entry |

## Migration / Rollout

No schema change. Single-pass rollout, no feature flag — new files only, plus two small existing-file diffs (`sidebar.tsx`, `patrimonio-service.ts`, `data/categoria.ts`). Rollback: delete `components/categorias/*` and `app/(app)/categorias/page.css`, revert `page.tsx` to the `<ComingSoon>` stub, revert `sidebar.tsx:28`'s `comingSoon: true`, revert the `esCategoriaDeGasto` filter line in `patrimonio-service.ts` and the `data/categoria.ts`/`lib/catalogs/categorias.js` additions — each reversible independently.

## Open Questions

None — all technical decisions resolved above.

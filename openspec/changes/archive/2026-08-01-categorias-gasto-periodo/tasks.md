# Tasks: Categorías — Gasto por Periodo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-780 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (forecast only — overridden below) |
| Delivery strategy | **size:exception** (user decision, 2026-08-01) |
| Chain strategy | N/A — single PR |

Decision needed before apply: **No — resolved.** The user explicitly accepted `size:exception` and chose to ship this change as **one single PR** covering Phases A-H, rather than splitting into the 4-PR chain suggested by the forecast below. The implementing LLM/session should NOT re-split this into multiple PRs; proceed as one PR/commit series against a single branch.

The phase ordering below (A → B → C → D → E → F → G → H) still MUST be respected internally as the implementation/commit sequence within that single PR — Phase C depends on Phase A's `esCategoriaDeGasto`, Phase D depends on Phase C's `CategoriaConGasto` type, Phase E depends on B+C+D, and Phase G (independent of B-F) can land any time after Phase A.

### Reference: Forecast's Chained PR Plan (informational only — not used, see decision above)

| Unit | Scope | Est. lines | Notes |
|------|-------|------------|-------|
| 1 | Phase A + Phase G | ~20-30 | `GASTO_TIPOS`/`esCategoriaDeGasto` + dashboard consistency fix. Backend-only, no UI |
| 2 | Phase B + Phase C | ~200-240 | `categorias-dates.ts` (5 range functions) + `categorias-service.ts` (fetch + aggregation) |
| 3 | Phase D | ~290-340 | `categorias-card.tsx`/`.css` + `categorias-period-filter.tsx`/`.css` |
| 4 | Phase E + Phase F + Phase H | ~140-180 | Page composition, sidebar graduation, verification + lint/build |

## Phase A: Gasto-Category Foundation (`data/categoria.ts`)

*No dependencies. Blocks Phase C and Phase G.*

- [x] A.1 In `data/categoria.ts`, add `export const GASTO_TIPOS = ['compromiso', 'discrecional', 'suscripcion', 'trabajo', 'hogar'] as const` and `export function esCategoriaDeGasto(tipo: string): boolean { return (GASTO_TIPOS as readonly string[]).includes(tipo) }`, placed after the existing `CATEGORIAS`/`CATEGORIA_DEFAULT` exports.
- [x] A.2 In `lib/catalogs/categorias.js`, extend the re-export line to `export { CATEGORIAS, CATEGORIA_DEFAULT, GASTO_TIPOS, esCategoriaDeGasto } from '../../data/categoria'`.
- [ ] A.3 MANUAL: Verify `esCategoriaDeGasto('sistema')`/`esCategoriaDeGasto('ingreso')` return `false` and the 5 gasto tipos return `true` — not executable by the implementing agent (no runtime/browser access); logic traced by hand during implementation and matches design.md exactly.

## Phase B: Period Date Ranges (`components/categorias/categorias-dates.ts`)

*Depends only on Phase A being present in the working tree is not required — pure date math. Blocks Phase E.*

- [x] B.1 Create `components/categorias/categorias-dates.ts`. Add local helpers `getTodayLocal(): string`, `getTodayLocalDate(): Date`, `toISODate(date: Date): string` — hand-rolled, mirroring `components/diversion/diversion-week-range.ts`'s `getTodayLocal()` (no shared import; this is a deliberate third near-duplicate per proposal's Resolved Decisions). Also export `interface RangoFecha { desde: string; hasta: string }`.
- [x] B.2 Add `export function getRangoDia(): RangoFecha` → `{ desde: getTodayLocal(), hasta: getTodayLocal() }`.
- [x] B.3 Add `export function getRangoSemanal(): RangoFecha` — import `getCurrentWeekRange` from `@/components/diversion/diversion-week-range` and map its `{fecha_inicio, fecha_fin}` to `{desde, hasta}`.
- [x] B.4 Add `export function getRangoMensual(): RangoFecha` — 1st through last day of the current calendar month, computed from `getTodayLocalDate()`.
- [x] B.5 Add `export function getRangoAnual(): RangoFecha` — Jan 1 through Dec 31 of the current calendar year.
- [x] B.6 Add `export function getRangoQuincenal(): RangoFecha`, exact algorithm from design.md's "Quincenal boundary algorithm (exact)":
  ```ts
  export function getRangoQuincenal(): RangoFecha {
    const today = getTodayLocalDate()
    const year = today.getFullYear(); const month = today.getMonth(); const day = today.getDate()
    if (day <= 15) {
      return { desde: toISODate(new Date(year, month, 1)), hasta: toISODate(new Date(year, month, 15)) }
    }
    const lastDay = new Date(year, month + 1, 0).getDate()
    return { desde: toISODate(new Date(year, month, 16)), hasta: toISODate(new Date(year, month, lastDay)) }
  }
  ```
- [ ] B.7 MANUAL: Trace `getRangoQuincenal()` output for day 15/16/today's real date, and `getRangoDia/Semanal/Mensual/Anual()` against today's real date — needs browser or REPL execution, not executable by the implementing agent; algorithm copied verbatim from design.md.

## Phase C: Fetch + Aggregation Service (`components/categorias/categorias-service.ts`)

*Depends on Phase A (`esCategoriaDeGasto`). Blocks Phase D and Phase E.*

- [x] C.1 Create `components/categorias/categorias-service.ts`. Add local `interface Movimiento { id: string; monto: number; descripcion?: string | null; fecha: string; hora?: string | null; cuenta_id: string; categoria_id: string; notas?: string | null; created_at: string; es_transferencia?: boolean | null; transferencia_id?: string | null }` (mirrors `movement-service.ts`'s shape, kept local per `cuentas-service.ts` precedent — not imported). Add `interface CategoriaConGasto { categoriaId: string; nombre: string; total: number; count: number; porcentaje: number; movimientos: Movimiento[] }`.
- [x] C.2 Add `export async function fetchMovimientosEnPeriodo(desde: string, hasta: string): Promise<Movimiento[]>` — one bounded Supabase fetch: `.from('movimiento').select(<same fields as Movimiento>).gte('fecha', desde).lte('fecha', hasta).lt('monto', 0)` (inclusive both ends; no RPC, no pagination — same architecture as `patrimonio-service.ts`'s `fetchCategoriasDelMes()`).
- [x] C.3 Add `export async function fetchCategoriasConGasto(desde: string, hasta: string): Promise<CategoriaConGasto[]>` — call `fetchMovimientosEnPeriodo(desde, hasta)`; for each row, resolve `CATEGORIAS.find(c => c.id === mov.categoria_id)` (import `CATEGORIAS` from `@/data/categoria`), skip the row if the categoria is missing or `!esCategoriaDeGasto(categoria.tipo)`; else accumulate into a `Map<string, {total: number; count: number; movimientos: Movimiento[]}>` keyed by `categoria_id` (`total += Math.abs(monto)`, `count += 1`, push the row). After the loop, compute `sumaTotal` (sum of all bucket totals), map buckets to `CategoriaConGasto[]` with `porcentaje = sumaTotal > 0 ? Math.round(total/sumaTotal*100) : 0`, and sort the array descending by `total`.
- [ ] C.4 MANUAL: Pick one real period, hand-sum the qualifying movimientos for one category from Supabase, compare to `fetchCategoriasConGasto`'s output total/count/porcentaje for that category — needs live Supabase data + browser, not executable by the implementing agent.

## Phase D: UI Components

*Depends on Phase C (`CategoriaConGasto` type). Blocks Phase E.*

- [x] D.1 Create `components/categorias/categorias-card.tsx` mirroring `components/cuentas/cuentas-card.tsx`'s exact pattern: `interface CategoriaCardProps { categoria: CategoriaConGasto }`; `useState(false)` for `expanded`; `<button type="button" aria-expanded={expanded}>` header showing `categoria.nombre`, `(${categoria.count})`, total formatted via `Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', minimumFractionDigits:2})`, and `${categoria.porcentaje}%`; `ChevronDown` from `lucide-react` with a rotating CSS state class; `{expanded && (...)}` body mapping `categoria.movimientos` to `MovementListItem` (import from `@/components/movement/movement-list-item`), with an empty-body fallback message if `movimientos.length === 0` (should not occur per Phase C's structural exclusion, but keep the guard for defensive parity with `cuentas-card.tsx`).
- [x] D.2 Create `components/categorias/categorias-card.css` — class names `categoria-card__*`, mirroring `components/cuentas/cuentas-card.css`'s (or equivalent `cuenta-card.css`) header/chevron/body/empty styles.
- [x] D.3 Create `components/categorias/categorias-period-filter.tsx` exporting `export type PeriodoTipo = 'dia' | 'semanal' | 'quincenal' | 'mensual' | 'anual' | 'periodo'` and `interface CategoriasPeriodFilterProps { periodo: PeriodoTipo; desdePersonalizado: string; hastaPersonalizado: string; onPeriodoChange: (periodo: PeriodoTipo) => void; onRangoPersonalizadoChange: (desde: string, hasta: string) => void }`. Render a 6-button segmented group (`role="group"`, each button `aria-pressed={periodo === thisOption}`) for día/semanal/quincenal/mensual/anual/periodo. When `periodo === 'periodo'`, render two inline `<input type="date">` fields (desde/hasta) beneath the group; on change, clamp so `desde <= hasta` is never violated in state (moving `desde` past `hasta` pushes `hasta` up, and vice versa), and set native `min`/`max` attributes on each input as a first line of defense.
- [x] D.4 Create `components/categorias/categorias-period-filter.css` — segmented-group button styles (active/inactive/`aria-pressed` state) + inline custom-range input row styles.
- [ ] D.5 MANUAL: Click each of the 6 buttons, confirm `aria-pressed` toggles correctly with exactly one active; select "Por periodo" and confirm date inputs appear; set `hasta` before `desde` then drag `desde` past it, confirm `hasta` clamps up (and reverse) — needs browser, not executable by the implementing agent.

## Phase E: Page Composition (`app/(app)/categorias/page.tsx`)

*Depends on Phase B, Phase C, and Phase D. Blocks nothing further (leaf of the dependency graph besides Phase H).*

- [x] E.1 Replace the `app/(app)/categorias/page.tsx` `<ComingSoon>` stub with a real client page mirroring `app/(app)/cuentas/page.tsx`'s composition: `'use client'`, `Suspense` wrapper around an inner `CategoriasContent` component holding `periodo` (`PeriodoTipo`, default `'mensual'`), `desdePersonalizado`/`hastaPersonalizado` (both init to `getTodayLocal()` from `categorias-dates.ts`), `categorias`, `loading`, `error` state.
- [x] E.2 Add a local `resolveRango(periodo, desdePersonalizado, hastaPersonalizado): RangoFecha` helper inside the page: dispatches `dia|semanal|quincenal|mensual|anual` to the matching `categorias-dates.ts` function, and `periodo` (custom) to `{ desde: desdePersonalizado, hasta: hastaPersonalizado }`.
- [x] E.3 Wire `useEffect(() => { fetchCategoriasConGasto(desde, hasta).then(setCategorias)... }, [desde, hasta])`, where `{ desde, hasta } = resolveRango(periodo, desdePersonalizado, hastaPersonalizado)` is recomputed every render — both a period-button click and a custom-range-input edit flow through this single dependency pair (exact pattern per design.md's Data Flow section; do not add a second effect).
- [x] E.4 Render `<CategoriasPeriodFilter>` plus loading/error states, and an empty-state message when `categorias.length === 0` (per spec's "Empty state when no categories qualify"); otherwise render `categorias.map(c => <CategoriaCard key={c.categoriaId} categoria={c} />)`.
- [x] E.5 Create `app/(app)/categorias/page.css` mirroring `app/(app)/cuentas/page.css`'s header/grid/loading/error/empty layout classes, renamed to `categorias-page__*`.
- [ ] E.6 MANUAL: Page loads with mensual selected by default and the 1st-through-last-day-of-month range applied — needs browser, not executable by the implementing agent.

## Phase F: Sidebar Graduation

*No dependency on Phase A-E; can be done any time before Phase H, but grouped into PR 4 for delivery convenience.*

- [x] F.1 In `components/app-shell/sidebar.tsx` line 28, change `{ href: '/categorias', label: 'Categorías', icon: Tags, comingSoon: true }` to `{ href: '/categorias', label: 'Categorías', icon: Tags }` (drop the `comingSoon: true` property).
- [ ] F.2 MANUAL: Confirm the sidebar's Categorías link no longer shows the "Próximamente" badge or `sidebar__link--coming-soon` muted styling, and clicking it navigates to `/categorias` — needs browser, not executable by the implementing agent.

## Phase G: Dashboard Consistency Fix (`components/patrimonio/patrimonio-service.ts`)

*Depends on Phase A (`esCategoriaDeGasto`). Independent of Phase B-F; grouped into PR 1.*

- [x] G.1 Change the import line to `import { CATEGORIAS, esCategoriaDeGasto } from '@/data/categoria'`.
- [x] G.2 Inside `fetchCategoriasDelMes()`'s aggregation loop, apply the exact diff from design.md verbatim — resolve `categoria` before computing `monto`, and skip non-gasto rows:
  ```ts
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
  No other lines in `fetchCategoriasDelMes()` change (nombre resolution, ratio/heat classification, and sort stay as-is); the filter applies to both `gastoMesActual` and `gastoTrailing` since they share this one loop.
- [ ] G.3 MANUAL: Compare `/reportes`'s "Categorías del mes" total for one category against `/categorias`'s mensual-filter total for the same category in the same calendar month — confirm they match; confirm "Transferencia" and any `tipo: ingreso` categoria no longer appear in `/reportes`'s category list. Needs browser + live data, not executable by the implementing agent.

## Phase H: Manual Verification + Lint/Build

*Depends on all prior phases being merged (page live, sidebar graduated, dashboard fix applied). No automated test runner exists in this repo (`package.json` has no `test` script) — all checks below are manual/behavioral, mirroring design.md's Testing Strategy table.*

- [ ] H.1 MANUAL: Trace all 6 `categorias-dates.ts` ranges by hand against today's real date, and separately trace `getRangoQuincenal()` for a mocked day-16 date.
- [ ] H.2 MANUAL: Expand a category card, hand-sum its rendered `MovementListItem` amounts, and compare the sum to the card header's total and `%`.
- [ ] H.3 MANUAL: Pick a period with zero movimientos in a known gasto category; confirm no card renders for it (zero-gasto exclusion).
- [ ] H.4 MANUAL: Select "día" on a day with zero gasto movimientos; confirm the empty-state message renders, not a blank list or an error.
- [ ] H.5 MANUAL: Expand two cards, collapse one; confirm the other stays expanded (independent per-card state).
- [ ] H.6 MANUAL: In "Por periodo," set `hasta` before `desde`, then push `desde` past `hasta`; confirm the other field clamps instead of allowing `desde > hasta`.
- [ ] H.7 MANUAL: Toggle dark mode; confirm card and filter contrast render correctly via `theme.css` tokens.
- [ ] H.8 MANUAL: Click the sidebar's Categorías entry; confirm no "Próximamente" badge and correct navigation to `/categorias`.
- [ ] H.9 MANUAL: Re-confirm the `/reportes` vs `/categorias` mensual cross-page total match from G.3 for at least one additional category.
- [x] H.10 Ran `npm run lint` (scoped to this change's new/changed files) and `npm run build` — both exited with zero errors. Lint scoped per session precedent (repo has thousands of pre-existing unrelated errors outside this change's scope).

# Tasks: Presupuestos Mensuales por Categoría

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300-1550 (1 SQL migration ~50, `presupuestos-dates.ts` ~70, `presupuestos-service.ts` ~200 [8 functions + 2 interfaces + `PresupuestoDuplicadoError`], 5 new component+CSS pairs ~950 [`presupuesto-progress` ~130, `presupuestos-resumen` ~110, `presupuestos-mes-selector` ~90, `presupuesto-form` ~170, `presupuesto-card` ~310 mirrors `meta-card.tsx`], `app/(app)/presupuestos/page.tsx`+`.css` ~210, `sidebar.tsx` ~10, `specs/app-shell-navigation/spec.md` delta ~10 [already drafted]) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | **ask-on-risk** — orchestrator must confirm chain strategy with the user before `sdd-apply` starts |
| Chain strategy | **stacked-to-main** (proposed default, pending user confirmation) — mirrors `2026-08-20-metas-ahorro`'s 6-PR split for a comparably-sized new domain (1 migration, 1 service, 5 component pairs, 1 page, 1 sidebar diff) |

Decision needed before apply: **Yes — not yet confirmed with the user.**

Calibration against `2026-08-20-metas-ahorro` (~1300-1500 lines, 6 chained PRs, High risk, also a brand-new top-level entity with its own migration + service + accordion card): this change is comparable in shape but slightly smaller — no chart component, but adds a duplicate-rejection error path (`PresupuestoDuplicadoError`), a category-exclusion filter in both the form and the copy function, and a first-ever `user_id`/RLS migration in this repo (`docs/SUPABASE-RLS-SETUP.md` procedure, not a copy of an existing versioned migration). Expect final size close to the metas-ahorro precedent.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase A (migration, operator-applied) + Phase B (`presupuestos-dates.ts`) + Phase C (`presupuestos-service.ts`) | PR 1 | ~320 lines. Foundation — compiles standalone; live functionality depends on A.2's operator-applied migration |
| 2 | Phase D1: `presupuesto-progress.tsx`/`.css` + `presupuestos-resumen.tsx`/`.css` | PR 2 | ~240 lines. Depends on PR 1's exported types (`PresupuestoConGasto`) only — no dependency on the form/card/selector, could ship independently of Unit 3 |
| 3 | Phase D2: `presupuestos-mes-selector.tsx`/`.css` + `presupuesto-form.tsx`/`.css` | PR 3 | ~260 lines. Depends on PR 1's `presupuestos-dates.ts` (selector) and `crearPresupuesto` signature + `data/categoria.ts`'s `esCategoriaDeGasto` (form); independent of PR 2, could run in parallel |
| 4 | Phase D3: `presupuesto-card.tsx`/`.css` | PR 4 | ~310 lines. Depends on PR 2 (`PresupuestoProgress`) and PR 1 (`updatePresupuestoMonto`/`eliminarPresupuesto`) — the accordion card composes progress + inline edit/delete |
| 5 | Phase E: `app/(app)/presupuestos/page.tsx`/`.css` | PR 5 | ~210 lines. Depends on PR 1 (service) + PR 2 (resumen) + PR 3 (selector, form) + PR 4 (card) |
| 6 | Phase F (`sidebar.tsx`) + Phase G (spec delta checkpoint) | PR 6 | ~10 code lines + delta merge. Depends on PR 5 — the sidebar link would 404 if `/presupuestos` doesn't exist yet |

## Phase A: Database Migration (`presupuesto`)

- [x] A.1 Create `supabase/migrations/20260827090000_add_presupuesto_mensual.sql` with the exact DDL from design.md's "SQL migration" section verbatim: `CREATE TABLE presupuesto` (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL`, `categoria_id UUID NOT NULL REFERENCES categoria(id)`, `monto DECIMAL(14,2) NOT NULL CHECK (monto > 0)`, `anio INT NOT NULL`, `mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `UNIQUE (user_id, categoria_id, anio, mes)`). No `activa` column — delete is a hard `DELETE`. Add `CREATE INDEX idx_presupuesto_user_periodo ON presupuesto (user_id, anio, mes)`.
- [x] A.2 In the same file, add `ALTER TABLE presupuesto ENABLE ROW LEVEL SECURITY` and the 4 `auth.uid() = user_id` policies (`presupuesto_select_own`, `presupuesto_insert_own`, `presupuesto_update_own`, `presupuesto_delete_own`) — this is the `fondo_semanal` pattern (`docs/SUPABASE-RLS-SETUP.md`), the repo's first versioned migration with real `user_id`/RLS.
- [x] A.3 **Do not skip this** — in the same file, add `GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto TO authenticated;`. The recent 403 on `categoria` (`openspec/changes/archive/2026-08-21-catalog-icons/design.md`) was caused by omitting this exact statement, not by RLS.
- [x] A.4 **Operator action, live Supabase**: apply `20260827090000_add_presupuesto_mensual.sql` against the live Supabase project. — Applied successfully by the operator on 2026-08-27; no errors reported at apply time.
- [x] A.5 **Operator/manual verify**: no "permission denied for table presupuesto" on live `crearPresupuesto` — first write after the migration must succeed cleanly (per design.md's Open Question on apply-time verification). Operator confirmed on 2026-09-03: created presupuesto rows live with no permission error.

## Phase B: Month Date Helper (`components/presupuestos/presupuestos-dates.ts`)

*Pure, no Supabase dependency. Blocks Phase C and Phase D2 (mes-selector).*

- [x] B.1 Create `components/presupuestos/presupuestos-dates.ts`. Export `interface RangoFecha { desde: string; hasta: string }`. Hand-rolled `Date` math — do not import `categorias-dates.ts` (its `getRangoMensual()` is anchored to "today" and cannot accept an arbitrary `(anio, mes)`).
- [x] B.2 Add `export function getRangoDelMes(anio: number, mes: number): RangoFecha` — 1st through the last day of the given calendar month (`new Date(anio, mes, 0).getDate()` for month length), both bounds as ISO `YYYY-MM-DD`.
- [x] B.3 Add `export function getMesAnterior(anio: number, mes: number): { anio: number; mes: number }` and `export function getMesSiguiente(anio: number, mes: number): { anio: number; mes: number }` — handle December→January and January→December year rollover.
- [x] B.4 MANUAL: Trace `getRangoDelMes` for a 28/29/30/31-day month, and `getMesAnterior`/`getMesSiguiente` across a year boundary (Dec↔Jan) — not executable by the implementing agent; algorithm copied verbatim from design.md. — Traced by the orchestrator against the written implementation: `new Date(anio, mes, 0)` uses a 0-based month index, so passing the 1-based `mes` lands on the following month and day `0` rolls back to the last day of the requested month (Feb 2026 → 28, Feb 2028 → 29, Apr → 30, Jan → 31). December is the interesting case: `new Date(2026, 12, 0)` overflows to January 2027 and rolls back to 2026-12-31, correct. `desde` uses `mes - 1` for the 1st. `toISODate` reads local `getFullYear/getMonth/getDate` rather than `toISOString`, avoiding the UTC off-by-one that would shift dates in negative-offset timezones. Rollover in `getMesAnterior`/`getMesSiguiente` verified for Jan→Dec and Dec→Jan.

## Phase C: Service Layer (`components/presupuestos/presupuestos-service.ts`)

*Depends on Phase B (`RangoFecha`, `getMesAnterior`). Blocks Phase D and Phase E.*

- [x] C.1 Create `components/presupuestos/presupuestos-service.ts` importing `createClient` from `@/lib/supabase/client` and `fetchMovimientosEnPeriodo` from `@/components/categorias/categorias-service` (reused unchanged). Add local `requireUserId(supabase)` copying `diversion-service.ts`'s implementation exactly (calls `supabase.auth.getUser()`, throws `Error('Usuario no autenticado')` if no session).
- [x] C.2 Export `interface Presupuesto { id: string; categoriaId: string; monto: number; anio: number; mes: number; createdAt: string }`, `export class PresupuestoDuplicadoError extends Error {}`, and `interface PresupuestoConGasto extends Presupuesto { gastado: number; porcentaje: number; excedente: number }`.
- [x] C.3 Implement `fetchPresupuestosDelMes(anio: number, mes: number): Promise<Presupuesto[]>` — `SELECT * FROM presupuesto WHERE user_id=:userId AND anio=:anio AND mes=:mes`, explicit `.eq('user_id', userId)` in addition to RLS (defense in depth — with RLS active a missing filter returns 0 rows silently, not an error).
- [x] C.4 Implement `fetchGastoPorCategorias(categoriaIds: string[], anio: number, mes: number): Promise<Map<string, number>>` — call `getRangoDelMes(anio, mes)`, then `fetchMovimientosEnPeriodo(desde, hasta)` (no `user_id` filter — `movimiento` is single-user real, per design.md's Architecture Decisions), then aggregate `SUM(ABS(monto))` per `categoria_id` restricted to `categoriaIds`. Categories with no matching movimiento resolve to `0`, never throw.
- [x] C.5 Implement `computePresupuestoConGasto(presupuesto: Presupuesto, gastado: number): PresupuestoConGasto` — pure, no Supabase call: `porcentaje = presupuesto.monto > 0 ? (gastado / presupuesto.monto) * 100 : 0`, `excedente = Math.max(0, gastado - presupuesto.monto)`.
- [x] C.6 Implement `crearPresupuesto(categoriaId: string, monto: number, anio: number, mes: number): Promise<Presupuesto>` as a **plain `INSERT`, never an upsert**. On Postgres error code `23505` (unique violation on `(user_id, categoria_id, anio, mes)`), catch it and throw `new PresupuestoDuplicadoError(...)` instead of the raw Supabase error — the existing row must be left untouched, not silently overwritten.
- [x] C.7 Implement `updatePresupuestoMonto(id: string, monto: number): Promise<Presupuesto>` — `UPDATE presupuesto SET monto WHERE id=:id AND user_id=:userId`.
- [x] C.8 Implement `eliminarPresupuesto(id: string): Promise<void>` — `DELETE FROM presupuesto WHERE id=:id AND user_id=:userId`. Hard delete — there is no `activa` column and no soft-delete path in this domain.
- [x] C.9 Implement `copiarPresupuestosMesAnterior(anio: number, mes: number): Promise<Presupuesto[]>` — resolve `getMesAnterior(anio, mes)`, `fetchPresupuestosDelMes` for both origen and destino, filter `origen.filter(p => !destino.some(d => d.categoriaId === p.categoriaId))` **before** looping `crearPresupuesto(...)` on the remainder. This filter is required for correctness (not a nicety) because `crearPresupuesto` is a plain `INSERT` with no `ON CONFLICT` fallback — an unfiltered copy over a partially-budgeted month would abort on the first duplicate instead of copying what's missing.
- [x] C.10 Verified by code inspection (2026-09-03): the picker excludes already-budgeted categories, so a duplicate is unreachable from a single UI session by design. `crearPresupuesto` is a pure `.insert()` — no `upsert`/`onConflict` anywhere in the service — and it translates Postgres `23505` to `PresupuestoDuplicadoError` at presupuestos-service.ts:139-144, leaving the existing row's `monto` untouched. Matches verify-report.md point 3.

## Phase D: UI Components

### Phase D1: Progress bar + month summary (depends only on Phase C's `PresupuestoConGasto` type)

- [x] D1.1 Create `components/presupuestos/presupuesto-progress.tsx` — `PresupuestoProgressProps { gastado: number; monto: number }`. `widthPct = monto > 0 ? Math.max(0, Math.min(100, (gastado/monto)*100)) : 0` (identical clamp technique to `metas-progress.tsx:27`, copied not imported — different domain). Fill turns red when `gastado > monto`; when `excedente > 0` render the surplus as separate text (e.g. "+$320 sobre el presupuesto"), never by extending the bar past 100%.
- [x] D1.2 Create `components/presupuestos/presupuesto-progress.css` — `--theme-*` tokens; `.presupuesto-progress__fill--excedido` (`--theme-color-error`), default fill (`--theme-color-accent`); dark-mode rules matching `metas-progress.css`/`cuentas-card.css` convention.
- [x] D1.3 Create `components/presupuestos/presupuestos-resumen.tsx` — `PresupuestosResumenProps { totalPresupuestado: number; totalGastado: number }`, rendered once above the list; sums only over the presupuestos already fetched for the selected month (caller-computed, this component is presentational only, no fetch).
- [x] D1.4 Create `components/presupuestos/presupuestos-resumen.css` — `--theme-*` tokens, dark-mode rules.
- [x] D1.5 MANUAL: Render the progress bar with `gastado=820, monto=500`; confirm the bar is red, capped at 100% width, and the text reads "+$320 sobre el presupuesto" separate from the bar. Operator confirmed 2026-09-03.

### Phase D2: Month selector + create form (depends on Phase B and Phase C)

- [x] D2.1 Create `components/presupuestos/presupuestos-mes-selector.tsx` — `PresupuestosMesSelectorProps { anio: number; mes: number; onAnterior: () => void; onSiguiente: () => void }`, two arrow buttons only, no free date-range picker (per spec's "Navegación de mes anclada al mes actual").
- [x] D2.2 Create `components/presupuestos/presupuestos-mes-selector.css` — `--theme-*` tokens, dark-mode rules.
- [x] D2.3 Create `components/presupuestos/presupuesto-form.tsx` — create form for a `presupuesto` (categoría + `monto`). Import `AutocompleteInput` from `@/components/ui/autocomplete-input` with `kind="categoria"`; build `options` by filtering `CATEGORIAS` with `esCategoriaDeGasto(c.tipo)` from `@/data/categoria`, **then** excluding any `categoriaId` already present in the current month's `presupuestos[]` (passed in as a prop) — the picker itself does not filter by type or availability, filtering is the caller's responsibility. Client-side validation rejects `monto <= 0` before calling `crearPresupuesto`.
- [x] D2.4 Create `components/presupuestos/presupuesto-form.css` — `--theme-*` tokens, dark-mode rules.
- [x] D2.5 MANUAL: Open the category picker in a month where "Comida" already has a presupuesto; confirm "Comida" does not appear in the options, and no `tipo='ingreso'` category ever appears. Operator confirmed 2026-09-03.

### Phase D3: Accordion card (depends on Phase D1's progress bar + Phase C's update/delete)

- [x] D3.1 Create `components/presupuestos/presupuesto-card.tsx` — `PresupuestoCardProps { presupuesto: PresupuestoConGasto; categoriaNombre: string; onUpdateMonto: (id: string, monto: number) => Promise<void>; onEliminar: (id: string) => Promise<void> }`. `useState(expanded)` + `ChevronDown` pattern mirroring `meta-card.tsx`/`cuentas-card.tsx`: collapsed shows categoría nombre/ícono + `PresupuestoProgress(gastado, monto)`; expanded reveals an inline edit-monto form and a delete affordance. Edit and delete are wired identically regardless of whether the presupuesto's `mes` is past or current — no "mes cerrado" branch anywhere in this component.
- [x] D3.2 Create `components/presupuestos/presupuesto-card.css` — `.presupuesto-card__chevron--expanded` (BEM-ish, matching `meta-card__chevron--expanded`), `--theme-*` tokens, dark-mode rules.
- [x] D3.3 MANUAL: Expand a card for a presupuesto in a month before the current one, edit its monto, then delete it — confirm both operations succeed with no blocking/read-only behavior. Operator confirmed 2026-09-03.

## Phase E: Page Composition (`app/(app)/presupuestos/page.tsx`)

*Depends on Phase C (service) + Phase D1 (resumen) + Phase D2 (selector, form) + Phase D3 (card).*

- [x] E.1 Create `app/(app)/presupuestos/page.tsx` — `'use client'`, `Suspense`-wrapped `Page → Content` split (same gotcha as `movimientos`/`dashboard`: month state uses `new Date()` on the client). `useState(anio, mes)` initialized to the current calendar month.
- [x] E.2 On mount and on every `(anio, mes)` change: `fetchPresupuestosDelMes(anio, mes)` → `fetchGastoPorCategorias(categoriaIds, anio, mes)` → `computePresupuestoConGasto` per row → `PresupuestoConGasto[]`. Render `PresupuestosResumen` (sums only over this list) and one `PresupuestoCard` per row.
- [x] E.3 Wire `PresupuestosMesSelector`'s `onAnterior`/`onSiguiente` to `getMesAnterior`/`getMesSiguiente` from `presupuestos-dates.ts`, updating `(anio, mes)` state and re-triggering E.2's fetch.
- [x] E.4 Add a "+ Nuevo presupuesto" toggle revealing `PresupuestoForm`; on submit call `crearPresupuesto(...)` and prepend the result (after computing its gasto) to local state — no full refetch. On `PresupuestoDuplicadoError`, show the domain error message and leave existing state untouched.
- [x] E.5 Wire `PresupuestoCard`'s callbacks: `onUpdateMonto` → `updatePresupuestoMonto(...)` (patch local state in place), `onEliminar` → `eliminarPresupuesto(...)` (filter the row out of local state) — no refetch of the full list for either action.
- [x] E.6 Render "Copiar presupuestos de [mes anterior]" only when the selected month's `presupuestos[]` is empty (per spec's `Scenario: Acción visible solo en mes totalmente vacío`); on click call `copiarPresupuestosMesAnterior(anio, mes)` then refetch the destino month (per design.md's Data Flow — this is the one action allowed to refetch).
- [x] E.7 Create `app/(app)/presupuestos/page.css` — page layout using `--theme-*` tokens (normal app page, not an isolated-palette page like `/reportes`), list spacing, empty-state styling for a month with zero presupuestos and no mes-anterior data to copy.

## Phase F: Sidebar

*Depends on Phase E — the link must not point at a 404.*

- [x] F.1 Modify `components/app-shell/sidebar.tsx` — add `PiggyBank` to the `lucide-react` import list; insert `{ href: '/presupuestos', label: 'Presupuestos', icon: PiggyBank }` into `NAV_ITEMS` between the `/categorias` entry and the `/reportes` entry, per design.md's sidebar diff verbatim. Do not reorder any other existing entry.

## Phase G: Spec Delta Confirmation

- [x] G.1 Confirm `openspec/changes/2026-08-27-presupuestos-mensuales/specs/app-shell-navigation/spec.md` (already drafted in this change) merges cleanly into `openspec/specs/app-shell-navigation/spec.md` at archive time — checkpoint only, no new authoring here. — Verified: the delta's `### Requirement: Functional sidebar navigation links` heading matches the main spec's heading at `openspec/specs/app-shell-navigation/spec.md:9` exactly, so archive replaces that block wholesale. Note the delta deliberately corrects two pre-existing drifts in the main spec, which currently says "seven functional links" while omitting Categorías entirely and labeling `/reportes` as "Patrimonio" when `NAV_ITEMS` labels it "Reportes". Post-merge the requirement reads nine functional links, matching `sidebar.tsx` as shipped.

## Phase H: Manual Verification (no automated test runner in this project)

Mirrors design.md's `Verificación` table — reference it directly, do not re-derive the scenario list here.

- [x] H.1 `npm run lint` passes with zero new errors introduced by this change's files (scope against pre-existing baseline errors, same precedent as `2026-08-01-categorias-gasto-periodo`). — Zero new source-level problems. Hits matching this change fall into two buckets, both pre-existing: (a) generated build output under `.next/**` that ESLint should not be linting at all (same config gap that produces the `dist/**` baseline); (b) `components/app-shell/sidebar.tsx:50`, a pre-existing `<img>` LCP *warning* on the logo markup, untouched by this change's import + `NAV_ITEMS` edits.
- [x] H.2 `npm run build` passes with zero errors; `/presupuestos` listed as a route in the build output. — `exit=0`, `○ /presupuestos` present as a static route. Note: builds intermittently fail on a transient `fonts.gstatic.com` fetch for the Geist font (Turbopack, network-dependent, unrelated to this change); a retry succeeds. Observed and re-verified three times.
- [x] H.3 Walked through every row of design.md's `Verificación` table against the live app (2026-09-03). Operator-confirmed live: crear suelto, gastado coincide con Categorías, eliminar+recrear, copiar mes anterior, sidebar sin badge; plus D1.5/D2.5/D3.3/A.5 covered separately. Closed by inspection (unreachable from a single UI session): duplicado no pisa el existente + duplicado inalcanzable (C.10), copiar no duplica en reintento (button only renders on an empty month; service excludes already-budgeted categorias), aislamiento por usuario (UNIQUE includes user_id + per-user .eq filters).

---

The Review Workload Forecast and the proposed PR slices are at the top of this file.

Estimate breakdown backing the ~1300-1550 line figure: migration ~50, `presupuestos-dates.ts` ~70, `presupuestos-service.ts` ~200, 5 component+CSS pairs ~950, page+CSS ~210, sidebar ~10, spec delta ~10 (already drafted).

Calibration against comparable domains already in this repo (measured, not estimated): `components/diversion/` totals 1,480 lines across 14 files; `components/metas/` totals ~950 across 8. Presupuestos has a comparable surface — 5 component pairs, a service, a dates helper and a page — so the forecast sits in the expected range for a new domain here rather than being inflated.

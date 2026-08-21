# Design: Metas de Ahorro (Savings Goals) — Phase 1

## Technical Approach

Add a new `components/metas/` domain folder following the established `{domain}-service.ts` + `.tsx` + `.css` split (`components/cuentas/`, `components/deudas/`, `components/diversion/`). Two new Supabase tables, `meta` and `meta_abono`, are created in a single migration mirroring `20260811070000_add_deuda_pago.sql`'s exact RLS + explicit-GRANT convention (no `user_id`, matching every other table's single-user model). `meta_abono` is a dated log (mirrors `deuda_pago`'s own "one historical row per event" shape), never overwritten by progress recalculation — progress is derived, not stored. A new `app/(app)/metas/page.tsx` (`'use client'`, `Suspense`-wrapped, fetch-on-mount `Promise.all`, mirroring `app/(app)/cuentas/page.tsx`'s shape) fetches all active goals plus every `meta_abono` for those goals in one bounded second query (no RPC/join — this repo's zero-join precedent, restated from the deuda and patrimonio designs), computes `monto_actual`/`porcentaje`/`cumplida` client-side via a pure helper in `metas-service.ts`, and renders one `MetaCard` per goal. Each card is an accordion — collapsed shows name + progress bar + percentage, expanded reveals the chart, the abono log, and an add-abono inline form — modeled directly on `cuentas-card.tsx`'s `useState(expanded)` + `ChevronDown` pattern, since a goal card summarizing a running total that expands to reveal its own dated entries is structurally identical to an account card summarizing a balance that expands to reveal its own movimientos. A "+ Nueva meta" toggle at the page top reveals a create form styled on `diversion-budget-edit.tsx`'s edit-in-place numeric-input pattern — the closest existing form-input precedent in the codebase, since no prior page in this repo creates a brand-new top-level entity from scratch (accounts come from a catalog sync, deuda rows are existing `cuenta` rows, the weekly `diversion` budget is a singleton). The progress-over-time chart (`metas-progreso-chart.tsx`) and progress bar (`metas-progress.tsx`) both use `--theme-*` tokens (per the proposal's already-resolved rejection of the isolated `--ink`/`--up` patrimonio palette and of Recharts — restated below, not re-derived).

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Chart data unit | One bar per `meta_abono` entry, chronological (`fecha` ascending), plotting the running cumulative `monto_actual` at that point | Per-calendar-month bucket (like a typical time-series chart) | The spec (`progress-over-time chart` requirement) explicitly requires "points plotted in ascending fecha order, each reflecting cumulative monto_actual at that date" — i.e. per-entry, not per-bucket. Per-month bucketing would also force defining behavior for empty months (skip? flat line? zero bar?) with zero benefit, since `fecha_objetivo` is purely informational with no countdown enforcement (Phase 1 non-goal). Per-entry bars reuse `patrimonio-sparkline.tsx`'s exact technique (one value → one bar, min/max-normalized height, "renders fewer bars when sparse, never fabricates zero-value bars") with zero adaptation logic beyond re-scoping CSS custom properties — a literal, not just conceptual, adaptation as the proposal specifies |
| Where progress is computed | Pure function `computeProgreso(meta, abonos)` inside `metas-service.ts`, not a separate helper file | New `components/metas/metas-progress-calc.ts` | `deudas-service.ts` keeps its own pure date helpers (`computePeriodoParaCuenta`, `computePeriodoParaMes`) inline rather than splitting them out; a separate file is only justified when a helper is reused across two *different* domain services (e.g. `patrimonio-dates.ts`, imported by both `patrimonio-service.ts` and `deudas-service.ts`). No such cross-domain reuse exists here, so keeping it inline avoids an unjustified extra file |
| Abono fetch shape | `fetchAbonosPorMetas(metaIds: string[])` — one bounded query for ALL active goals' abonos at once, on initial page load | `fetchAbonosPorMeta(metaId)` fetched lazily only when a card is expanded | Every visible `MetaCard` needs its `monto_actual` computed for the collapsed progress bar — not just the expanded one — so all abonos are needed up front regardless of which card (if any) is expanded. Fetching once for every goal avoids a double fetch (list-view totals + expand-view detail) and matches the established "one bounded fetch + client-side aggregation" convention (`fetchCategoriasDelMes`, `fetchPagosDelAnio`, `fetchLatestPagosPorCuentas`) |
| Page composition pattern | Inline accordion-expand per goal card (`cuentas-card.tsx` pattern) | `/deudas`' month-tab + data-grid table; a modal for abono entry/editing | `/deudas`' month-tab table fits because debt payments have an inherent month dimension (12 discrete periods); a `meta_abono` log has no periodo axis, it's a flat chronological list per goal — a tab selector doesn't map onto this domain. `/reportes`' static dashboard is read-only aggregate display, not CRUD — ruled out immediately. A modal was rejected because no modal/dialog primitive exists anywhere in this codebase yet (confirmed: no portal/overlay component found in `components/`); reusing the existing accordion-expand avoids introducing new UI machinery for a first use case that doesn't need it |
| Negative / below-`monto_inicial` progress rendering | Bar width clamps to 0% (a `<div>` cannot render negative width), but the numeric label always shows the true `monto_actual` and percentage, colored `--theme-color-error` when negative | Let the bar itself read as "negative" via a mirrored/inverted visual treatment | `diversion-progress.tsx`'s `Math.max(0, spent)` clamp is safe there because `spent` is never legitimately negative. Metas differs: a withdrawal-heavy goal CAN have a legitimately negative `monto_actual` (spec: "a negative abono can bring progress below the initial amount"), so silently clamping the width without any other signal would hide real information. Diverging from `diversion-progress.tsx` here (0% width but a visibly colored true value) is the smallest change that keeps both components' bar geometry consistent while not lying about the number |
| "Cumplida" (>=100%) visual state | Bar fills 100% width in `--theme-color-success` (instead of `--theme-color-accent`), plus a "Cumplida" text badge | A distinct progress-bar color scale (e.g. gradient by percentage) | Matches the existing binary state-color convention already used across the app (`diversion-progress` uses one accent color throughout; `deuda-payment-table`'s paid/unpaid badges are binary `--theme-color-success`/`--theme-color-warning`) — no precedent for a continuous gradient scale exists to extend instead |
| `meta`/`meta_abono` GRANT scope | Single `GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta, public.meta_abono TO authenticated` covering both tables, even though the app never issues a `DELETE` on `meta` itself (only archives via `activa=false`) | Two separate GRANT statements; omit `DELETE` on `meta` since it's unused | One statement covering both tables is simpler to audit and matches the proposal's explicit Impact-table requirement verbatim. Granting unused `DELETE` on `meta` costs nothing (RLS still gates it, and the app code never calls it) and avoids a second near-duplicate GRANT line for marginal precision |
| Table/index naming | `meta`, `meta_abono` (singular, per proposal's already-resolved decision #7); `idx_meta_abono_meta_fecha ON meta_abono (meta_id, fecha ASC)` | Composite index ordered `fecha DESC` (matching `deuda_pago`'s `periodo DESC` index) | `deuda_pago`'s index is `DESC` because it always wants the *latest* record. `meta_abono` is read chronologically ascending for the chart and for `SUM()` aggregation (order doesn't affect the sum, but ascending matches the abono-log UI's natural reading order and the chart's plotting order) — `ASC` is the better default here, a deliberate divergence from the `deuda_pago` precedent, not an oversight |
| Migration filename | `supabase/migrations/20260820120000_add_metas_ahorro.sql`, single file for both tables | Two files (one per table), matching `deuda_pago`'s split from its later `notas` column migration | `deuda_pago`'s two files exist because the `notas` column was added in a *later* amendment after the base table already shipped — not because tables are split across files by convention. `meta` and `meta_abono` ship together in Phase 1 with no such staging need, so one file is simpler and has zero precedent-violation |

## Rejected Alternatives (restated from proposal/prior designs, not re-derived)

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Charting library | Hand-rolled `<div>`-bar component | Recharts (already an installed dependency) | Already rejected once for this exact "progress over time" need in the archived `add-dashboard-patrimonio` design ("Recharts' SVG/theming model doesn't map onto the prototype's exact pixel shapes"); reusing it here would create visual/technical inconsistency with the rest of the app's hand-rolled charts (`patrimonio-sparkline.tsx`, `patrimonio-day-pips.tsx`) |
| Color token system | App-wide `--theme-*` tokens (`lib/theme.css`), full `next-themes` light/dark support | The isolated hardcoded `--ink`/`--up`/`--down`/`--amber` palette scoped to `.patrimonio-page` | That isolated palette is a deliberate, contractually-scoped exception for `/reportes` only (archived design's "Color system isolation" decision — "always dark, ignores `next-themes`"). `/metas` is a normal CRUD app page like `/cuentas` and `/deudas`, which both use `--theme-*` and respond to the theme toggle; extending the isolated palette beyond its one intended page would violate that existing contract for no reason |

## Data Flow

```
/metas PAGE — READ PATH (on mount, browser)
────────────────────────────────────────────
app/(app)/metas/page.tsx  ('use client', Suspense, useEffect, sequential fetch)
  │
  ├─▶ fetchActiveMetas()                         metas-service.ts
  │     SELECT * FROM meta WHERE activa=true ORDER BY nombre ASC
  │
  ▼  (needs meta ids first)
  ├─▶ fetchAbonosPorMetas(metas.map(m => m.id))  metas-service.ts
  │     SELECT * FROM meta_abono WHERE meta_id IN (...) ORDER BY fecha ASC
  │
  ▼  group abonos by meta_id (Map) → computeProgreso(meta, abonos) per goal
  MetaConProgreso[] = [{ ...meta, montoActual, porcentaje, cumplida }, ...]
  │
  ▼  setState → render
  MetaCard (one per goal, accordion, mirrors cuentas-card.tsx)
    │
    ├─ collapsed: nombre, MetaProgressBar(montoActual, montoObjetivo, cumplida)
    │
    └─ expanded ──▶ MetaProgresoChart(abonos, montoInicial)
                 └─▶ abono log (list) + inline "add abono" form
                       │
                       ├─ add    ──▶ crearAbono(metaId, monto, fecha, nota)
                       ├─ edit   ──▶ updateAbono(id, { monto?, fecha?, nota? })
                       └─ delete ──▶ deleteAbono(id)
                             │
                             ▼  page patches local abonos[] state in place (no refetch)

CREATE / EDIT / ARCHIVE GOAL
────────────────────────────
"+ Nueva meta" toggle (page top) ──▶ form (diversion-budget-edit.tsx-style inputs)
                                        │
                                        ▼
                                      crearMeta(nombre, montoObjetivo, montoInicial, fechaObjetivo)
                                        │
                                        ▼  page prepends to local metas[] state (no refetch)

MetaCard "Editar" ──▶ updateMeta(id, { nombre?, montoObjetivo?, montoInicial?, fechaObjetivo? })
MetaCard "Archivar" ──▶ archivarMeta(id)  →  local metas[] filtered (removed from default list)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260820120000_add_metas_ahorro.sql` | Create | `meta` + `meta_abono` tables, index, RLS policies (SELECT/INSERT/UPDATE/DELETE), explicit `GRANT` for both tables |
| `components/metas/metas-service.ts` | Create | `Meta`, `MetaAbono`, `MetaConProgreso` types; `fetchActiveMetas`, `fetchAbonosPorMetas`, `crearMeta`, `updateMeta`, `archivarMeta`, `crearAbono`, `updateAbono`, `deleteAbono`, `computeProgreso` |
| `components/metas/meta-card.tsx` + `.css` | Create | Accordion card (mirrors `cuentas-card.tsx`): header (nombre, `MetaProgressBar`, chevron), expand reveals chart + abono log + add-abono form |
| `components/metas/metas-progress.tsx` + `.css` | Create | Progress bar, adapted from `diversion-progress.tsx`, `--theme-*` tokens, cumulative (non-resetting) semantics, cumplida + negative states |
| `components/metas/metas-progreso-chart.tsx` + `.css` | Create | Per-abono cumulative bar chart, adapted from `patrimonio-sparkline.tsx`'s div-bar technique, `--theme-*` tokens |
| `components/metas/meta-abono-form.tsx` + `.css` | Create | Inline add/edit form for a single `meta_abono` (monto, fecha, nota), styled on `diversion-budget-edit.tsx`'s input pattern |
| `components/metas/meta-form.tsx` + `.css` | Create | Create/edit form for a `meta` (nombre, monto_objetivo, monto_inicial, fecha_objetivo) |
| `app/(app)/metas/page.tsx` + `.css` | Create | Fetch-on-mount composition, `Suspense` wrapper (mirrors `cuentas/page.tsx`), loading/error/empty states, "+ Nueva meta" toggle |
| `components/app-shell/sidebar.tsx` | Modify | `NAV_ITEMS`: new `{ href: '/metas', label: 'Metas', icon: Target }` entry inserted after "Deudas", before "Categorías"; new `Target` import from `lucide-react` |
| `openspec/specs/app-shell-navigation/spec.md` | Modify (delta) | Functional link count increases by one |

## Interfaces / Contracts

```ts
// components/metas/metas-service.ts
import { createClient } from '@/lib/supabase/client'

export interface Meta {
  id: string
  nombre: string
  montoObjetivo: number
  montoInicial: number
  fechaObjetivo: string | null   // ISO date, nullable
  activa: boolean
  createdAt: string
}

export interface MetaAbono {
  id: string
  metaId: string
  monto: number          // signed: positive = contribution, negative = withdrawal
  fecha: string           // ISO date, required
  nota: string | null
  createdAt: string
}

/** Meta + client-computed progress. Never persisted — recomputed on every render from `meta` + `meta_abono`. */
export interface MetaConProgreso extends Meta {
  montoActual: number     // montoInicial + SUM(abonos.monto)
  porcentaje: number      // montoActual / montoObjetivo * 100 — may exceed 100 or be negative
  cumplida: boolean       // montoActual >= montoObjetivo
}

/** SELECT * FROM meta WHERE activa=true ORDER BY nombre ASC */
export async function fetchActiveMetas(): Promise<Meta[]>

/** SELECT * FROM meta_abono WHERE meta_id IN (:metaIds) ORDER BY fecha ASC — one bounded query for all goals */
export async function fetchAbonosPorMetas(metaIds: string[]): Promise<MetaAbono[]>

/** Pure, no Supabase call. abonos MUST already be filtered to this meta's id. */
export function computeProgreso(meta: Meta, abonos: MetaAbono[]): MetaConProgreso

export async function crearMeta(
  nombre: string,
  montoObjetivo: number,
  montoInicial: number,
  fechaObjetivo: string | null,
): Promise<Meta>

export async function updateMeta(
  id: string,
  updates: Partial<Pick<Meta, 'nombre' | 'montoObjetivo' | 'montoInicial' | 'fechaObjetivo'>>,
): Promise<Meta>

/** UPDATE meta SET activa = false WHERE id — soft-delete only, no hard DELETE ever issued on `meta` */
export async function archivarMeta(id: string): Promise<Meta>

export async function crearAbono(
  metaId: string,
  monto: number,
  fecha: string,
  nota: string | null,
): Promise<MetaAbono>

export async function updateAbono(
  id: string,
  updates: Partial<Pick<MetaAbono, 'monto' | 'fecha' | 'nota'>>,
): Promise<MetaAbono>

/** DELETE FROM meta_abono WHERE id — the only hard delete in this domain, per spec's "individually deleted" requirement */
export async function deleteAbono(id: string): Promise<void>
```

Every function calls `createClient()` from `@/lib/supabase/client` locally (never module-level), matching `deudas-service.ts`/`cuentas-service.ts` convention. No `id`-scoped function accepts or filters by `user_id` — single-user model, same as `cuenta`/`movimiento`/`deuda_pago`.

```tsx
// components/metas/meta-card.tsx
interface MetaCardProps {
  meta: MetaConProgreso
  abonos: MetaAbono[]              // pre-filtered to this meta's id by the page
  onUpdateMeta: (id: string, updates: Partial<Meta>) => Promise<void>
  onArchivar: (id: string) => Promise<void>
  onCrearAbono: (metaId: string, monto: number, fecha: string, nota: string | null) => Promise<void>
  onUpdateAbono: (id: string, updates: Partial<MetaAbono>) => Promise<void>
  onDeleteAbono: (id: string) => Promise<void>
}

// components/metas/metas-progress.tsx
interface MetaProgressBarProps {
  montoActual: number
  montoObjetivo: number
  cumplida: boolean
}

// components/metas/metas-progreso-chart.tsx
interface MetaProgresoChartProps {
  montoInicial: number
  abonos: MetaAbono[]   // any order — component sorts by fecha ascending internally
}
```

Class naming: `.meta-card__chevron--expanded`, `.metas-progress__fill--cumplida`, `.metas-progress__label--negative`, `.metas-progreso-chart__bar` — BEM-ish, matching `cuenta-card__chevron--expanded` / `patrimonio-sparkline__bar`.

**Progress algorithm** (`computeProgreso`):
```ts
export function computeProgreso(meta: Meta, abonos: MetaAbono[]): MetaConProgreso {
  const montoActual = meta.montoInicial + abonos.reduce((sum, a) => sum + a.monto, 0)
  const porcentaje = meta.montoObjetivo > 0 ? (montoActual / meta.montoObjetivo) * 100 : 0
  return { ...meta, montoActual, porcentaje, cumplida: montoActual >= meta.montoObjetivo }
}
```

**Chart algorithm** (`metas-progreso-chart.tsx`, adapted from `patrimonio-sparkline.tsx`):
```tsx
const sorted = [...abonos].sort((a, b) => a.fecha.localeCompare(b.fecha))
let running = montoInicial
const points = sorted.map((a) => {
  running += a.monto
  return { fecha: a.fecha, montoActual: running }
})
// same min/max normalization + 6% floor + last-bar-highlight as patrimonio-sparkline.tsx;
// 0 points → empty state; 1 point → single bar at 50% height (range=0 fallback)
```

**Progress bar width/label clamping** (diverges from `diversion-progress.tsx`, see Architecture Decisions):
```tsx
const widthPct = montoObjetivo > 0 ? Math.max(0, Math.min(100, (montoActual / montoObjetivo) * 100)) : 0
// label always shows the true montoActual/porcentaje (can be negative or >100), colored
// --theme-color-error when montoActual < 0, --theme-color-success when cumplida, else --theme-color-accent
```

**SQL migration** (`supabase/migrations/20260820120000_add_metas_ahorro.sql`):
```sql
CREATE TABLE meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  monto_objetivo DECIMAL(14,2) NOT NULL,
  monto_inicial DECIMAL(14,2) NOT NULL DEFAULT 0,
  fecha_objetivo DATE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meta_abono (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID NOT NULL REFERENCES meta(id),
  monto DECIMAL(14,2) NOT NULL,
  fecha DATE NOT NULL,
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_meta_abono_meta_fecha ON meta_abono (meta_id, fecha ASC);

ALTER TABLE meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_select_authenticated ON meta FOR SELECT TO authenticated USING (true);
CREATE POLICY meta_insert_authenticated ON meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meta_update_authenticated ON meta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meta_delete_authenticated ON meta FOR DELETE TO authenticated USING (true);

ALTER TABLE meta_abono ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_abono_select_authenticated ON meta_abono FOR SELECT TO authenticated USING (true);
CREATE POLICY meta_abono_insert_authenticated ON meta_abono FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meta_abono_update_authenticated ON meta_abono FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meta_abono_delete_authenticated ON meta_abono FOR DELETE TO authenticated USING (true);

-- RLS bypass and Postgres GRANTs are separate permission layers — this project
-- has hit live "permission denied for table ..." errors every time a migration
-- omitted the explicit GRANT (patrimonio_snapshot, restated again for
-- deuda_pago). Both tables' full CRUD grant is included from the start here,
-- in one statement, so this cannot be forgotten at apply time.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta, public.meta_abono TO authenticated;
```

**Sidebar diff** (`components/app-shell/sidebar.tsx`):
```tsx
import {
  LayoutDashboard,
  ArrowLeftRight,
  Gamepad2,
  Wallet,
  MinusCircle,
  Target,     // NEW
  Tags,
  BarChart3,
  Settings,
} from 'lucide-react'

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/diversion', label: 'Diversión', icon: Gamepad2 },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: MinusCircle },
  { href: '/metas', label: 'Metas', icon: Target },        // NEW — inserted here
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/configuracion', label: 'Configuración', icon: Settings, comingSoon: true },
]
```
Matches the live `sidebar.tsx` on disk (not the older `add-dashboard-patrimonio`/`deuda-payment-tracking` design snapshots, which predate the current `MinusCircle`-icon "Deudas" entry and un-renamed "Reportes" label) — "Metas" is inserted between the existing "Deudas" and "Categorías" entries, per the proposal's resolved decision #8.

## Testing Strategy

| Scenario | Steps | Expected |
|---|---|---|
| Create goal with non-zero inicial + fecha_objetivo | "+ Nueva meta" → submit nombre/objetivo/inicial/fecha | `meta` row created, `activa=true`, appears in list with `monto_actual = monto_inicial` |
| Create goal without fecha_objetivo | Submit form leaving date empty | `fecha_objetivo=NULL`, card renders without error, no date shown |
| Edit goal preserves abono history | Goal has 3 abonos, edit `monto_objetivo` | New value persists, all 3 `meta_abono` rows unchanged |
| Archive hides from default list | Archive an active goal with abonos | `activa=false`, goal disappears from `/metas`, `meta_abono` rows remain in DB |
| Add/edit/delete abono in isolation | Goal has 3 abonos; edit one, delete another | Only the targeted entry changes/disappears; other 2 unaffected |
| Negative abono lowers progress | `monto_inicial=1000`, add `monto=-300` | `monto_actual=700`; bar clamps to computed % (still ≥0 since 700>0 here), label shows 700 |
| Fully negative progress | `monto_inicial=100`, add `monto=-500` | `monto_actual=-400`; bar renders 0% width; label shows "-$400.00" in `--theme-color-error` |
| Cumplida does not archive | `monto_objetivo=1000`, abonos sum to ≥1000 | "Cumplida" badge shown, `activa` stays `true`, further abonos can still be added |
| Chart plots out-of-order entries correctly | Add abonos with fechas not in insertion order | Chart bars ordered by `fecha` ascending, each reflecting the correct running cumulative total |
| No account/movimiento fields | Inspect goal creation form and abono form | No `cuenta`/`movimiento` selector present anywhere |
| Dark mode | Toggle `next-themes` while on `/metas` | Cards, bars, chart, forms all respond via `--theme-*` (matches `cuentas-card.css`) |
| Sidebar nav | Click "Metas" | Navigates to `/metas`, link highlights active, positioned between "Deudas" and "Categorías", no "Próximamente" badge |

## Migration / Rollout

Real schema migration — ordered deployment required:
1. Apply `supabase/migrations/20260820120000_add_metas_ahorro.sql` against live Supabase (both tables + RLS + the combined `SELECT`/`INSERT`/`UPDATE`/`DELETE` grant, included from the start — applying the lesson from `patrimonio_snapshot`'s missed-grant incident, not deferring it).
2. Ship the code: `components/metas/*`, `app/(app)/metas/page.tsx`, and the `sidebar.tsx` nav entry, in the same deploy (fully additive — no existing page or table is touched other than the sidebar's `NAV_ITEMS` array).

Day-1 state: `/metas` renders an empty-state message until the user creates a first goal (no seed data, no backfill — matches every prior migration's day-1 pattern in this project).

## Open Questions

None — every decision above is final for Phase 1. The following is an **assumption requiring apply-time verification** against the live Supabase project, not resolvable from source alone (same pattern as every prior design in this project):

- The combined `GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta, public.meta_abono TO authenticated` statement is expected to be sufficient (no `service_role` grant needed — all writes come from the authenticated browser session, no unattended job writes to these tables). Confirm no "permission denied" occurs on the first live `crearMeta`/`crearAbono` call after migration.

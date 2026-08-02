# Design: Dashboard de Patrimonio

## Technical Approach

Replace the `/reportes` `<ComingSoon>` stub with a client component page (`'use client'`, mirroring `app/(app)/diversion/page.tsx`'s fetch-on-mount pattern) that composes five new presentational components from a new `components/patrimonio/` domain folder, following the `{domain}-service.ts` + `.tsx`+`.css` split convention established by `components/cuentas/` and `components/diversion/`. All Supabase reads go through a new `patrimonio-service.ts` using the existing browser client (`@/lib/supabase/client`), throw-on-error, no `user_id` filter (matches `cuenta`/`movimiento`'s schema). Visual fidelity to the prototype is achieved by a fully isolated CSS token file (`patrimonio-tokens.css`) scoped under `.patrimonio-page`, never touching `lib/theme.css`, plus two `next/font/google` objects loaded in a dedicated module and applied via `.variable` classNames only on this page's root wrapper. The daily net-worth history is written by the project's first Edge Function + `pg_cron` job, decoupled entirely from the page's read path.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Category/month aggregation | Client-side `.reduce()` over one bounded 4-calendar-month row fetch | Postgres RPC (`CREATE FUNCTION ...`) | Zero RPC precedent anywhere in this repo (confirmed by exploration); dataset is small (low hundreds of `movimiento` rows/month); avoids a new deployment artifact for marginal perf gain |
| Net worth vs. retiro queries | Two separate targeted `cuenta` queries: `fetchNetWorth()`, `fetchRetiroTotal()` | One `fetchCuentasActivas()` + shared client derivation | Matches `cuentas-service.ts`'s existing one-query-per-concern granularity; `cuenta` has ~20 rows, extra round trip is negligible |
| Snapshot aggregate definitions | `total_activos = Σ saldo_real (>0)`, `total_deudas = \|Σ saldo_real (<0)\|`, `patrimonio_neto = total_activos − total_deudas` (≡ `Σ saldo_real`), `patrimonio_disponible = patrimonio_neto − retiro` | Store only `patrimonio_neto`/`patrimonio_disponible` | Proposal's schema lists all 4 columns; costs nothing extra from the same fetched rows, enables a future assets-vs-debts view without backfill |
| Snapshot job mechanism | Supabase Edge Function + `pg_cron` + `pg_net` | Vercel Cron hitting a Route Handler | Proposal commits to Edge Function/`pg_cron` explicitly (project's first); keeps the write path entirely inside Supabase |
| Edge Function auth | Service-role key (server env var `SUPABASE_SERVICE_ROLE_KEY`) | Anon key + RLS insert policy for `authenticated` | Unattended server-to-server job, not a user session; service role is safe here since the function's write target and logic are fixed/non-user-controllable |
| Cron schedule | `0 6 * * *` UTC = `00:00 America/Mexico_City` (no DST) | Midday UTC | Captures the prior day's finalized movements right after local midnight, before same-day transactions are typically logged |
| Font loading scope | Font objects in `components/patrimonio/patrimonio-fonts.ts`; applied via `.variable` className on the page's root wrapper only | Add to `app/layout.tsx` alongside Geist | Proposal requires isolation; Next.js supports per-subtree font scoping without a global load, and `app/layout.tsx` stays Geist-only |
| Color system isolation | New hardcoded custom properties scoped under `.patrimonio-page` in `patrimonio-tokens.css` | New `--theme-*` variant/"flavor" | Proposal explicitly rejects a general theming-exception mechanism; reusing `--theme-*` naming risks future confusion about which system a page uses |
| Sparkline/day-pips rendering | Hand-rolled `<div>` bars/pips, inline `style={{height}}` + class modifiers | Recharts (already installed) | Proposal commits to the prototype's exact hand-rolled DOM; Recharts' SVG/theming model doesn't map onto the prototype's exact pixel shapes |
| Due-date month clamping | `clampDayToMonth = Math.min(diaPago, lastDayOfMonth)`, `lastDayOfMonth = new Date(y, m+1, 0).getDate()` | No clamping | JS `Date` silently overflows invalid days (`new Date(2026,1,30)` → March 2), which would corrupt the due date, not just its display |

## Data Flow

```
CRON WRITE PATH (daily, unattended)
────────────────────────────────────
pg_cron  cron.schedule('patrimonio-snapshot-daily', '0 6 * * *', ...)
  │
  ▼
pg_net.http_post ──▶ Edge Function: supabase/functions/patrimonio-snapshot-daily/index.ts
                         │  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                         ▼
                       SELECT saldo_real, es_fondo_retiro FROM cuenta WHERE activa = true
                         │
                         ▼  (aggregate in Deno)
                       totalActivos / totalDeudas / patrimonioNeto / retiro / patrimonioDisponible
                         │
                         ▼
                       UPSERT patrimonio_snapshot (fecha, ...) ON CONFLICT (fecha) DO UPDATE
                         │
                         ▼
                       patrimonio_snapshot table (1 row/day, idempotent same-day re-runs)

PAGE READ PATH (on mount, browser)
────────────────────────────────────
app/(app)/reportes/page.tsx  ('use client', useEffect on mount, Promise.all)
  │
  ├─▶ fetchNetWorth()                        ┐
  ├─▶ fetchRetiroTotal()                     │
  ├─▶ fetchSnapshotHistory(14)                ├─ parallel, patrimonio-service.ts
  ├─▶ fetchProximosVencimientos(7)           │
  ├─▶ fetchCategoriasDelMes()                │
  └─▶ fetchActiveWeek()+fetchWeekMovements() ┘  (diversion-service.ts, reused as-is)
        │
        ▼  setState → render
  PatrimonioHero(netWorth, history) ──▶ PatrimonioSparkline(history)
  PatrimonioSplit(disponible = netWorth − retiro, retiro)
  PatrimonioFondoDiversion(budget, spent, daysLeft, daysElapsed) ──▶ PatrimonioDayPips
  PatrimonioVencimientos(vencimientos)
  PatrimonioCategorias(categorias)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260724060000_add_patrimonio_snapshot.sql` | Create | `cuenta.es_fondo_retiro` column + seed `UPDATE` + `patrimonio_snapshot` table + index + RLS policy + grant. First tracked migration in repo history (schema previously lived only in live Supabase) |
| `supabase/migrations/20260724060100_setup_patrimonio_snapshot_cron.sql` | Create | Enables `pg_cron`/`pg_net` extensions (`CREATE EXTENSION IF NOT EXISTS`), `cron.schedule(...)` calling the Edge Function; project-ref/secret placeholders filled at apply time |
| `supabase/functions/patrimonio-snapshot-daily/index.ts` | Create | Deno Edge Function; service-role client; computes 4 aggregates; upserts by `fecha` |
| `components/patrimonio/patrimonio-service.ts` | Create | `fetchNetWorth`, `fetchRetiroTotal`, `fetchSnapshotHistory`, `fetchProximosVencimientos`, `fetchCategoriasDelMes` |
| `components/patrimonio/patrimonio-dates.ts` | Create | `getTodayLocal`, `getTodayLocalDate`, `startOfMonth`, `monthsAgoStart`, `addMonths`, `toISODate`, `clampDayToMonth`, `nextDueDate`, `diasRestantes` |
| `components/patrimonio/patrimonio-format.ts` | Create | `formatMoney(amount)`, `formatDeltaLabel(current, previous)` |
| `components/patrimonio/patrimonio-fonts.ts` | Create | `JetBrains_Mono`/`Inter` `next/font/google` objects |
| `components/patrimonio/patrimonio-tokens.css` | Create | `.patrimonio-page` hardcoded palette (prototype-exact hex) + base layout |
| `components/patrimonio/patrimonio-hero.tsx` + `.css` | Create | Net worth headline + delta chip, embeds `PatrimonioSparkline` |
| `components/patrimonio/patrimonio-sparkline.tsx` + `.css` | Create | 14-bar hand-rolled sparkline |
| `components/patrimonio/patrimonio-split.tsx` + `.css` | Create | Disponible/retiro grid |
| `components/patrimonio/patrimonio-fondo-diversion.tsx` + `.css` | Create | Receipt-card block, `::before`/`::after` notches, embeds `PatrimonioDayPips` |
| `components/patrimonio/patrimonio-day-pips.tsx` + `.css` | Create | 7-dot day-pip row |
| `components/patrimonio/patrimonio-vencimientos.tsx` + `.css` | Create | Stacked due-date strips |
| `components/patrimonio/patrimonio-categorias.tsx` + `.css` | Create | Category heat bar-list |
| `app/(app)/reportes/page.tsx` | Modify | Replace `<ComingSoon>` stub with the full dashboard composition |
| `components/app-shell/sidebar.tsx` | Modify | `/reportes` `NAV_ITEMS` entry: `label: 'Reportes' → 'Patrimonio'`, remove `comingSoon: true` |

## Interfaces / Contracts

```ts
// components/patrimonio/patrimonio-service.ts
export interface PatrimonioSnapshot {
  id: string; fecha: string
  patrimonio_neto: number; patrimonio_disponible: number
  total_activos: number; total_deudas: number
}
export interface VencimientoCuenta { id: string; nombre: string; diaPago: number; diasRestantes: number }
export interface CategoriaHeat {
  categoriaId: string; nombre: string; gastoMes: number
  ratio: number | null; heat: 'hot' | 'warm' | 'normal'
}

export async function fetchNetWorth(): Promise<number>
// SELECT saldo_real FROM cuenta WHERE activa = true; sum client-side

export async function fetchRetiroTotal(): Promise<number>
// SELECT saldo_real FROM cuenta WHERE activa = true AND es_fondo_retiro = true; sum client-side

export async function fetchSnapshotHistory(days: number): Promise<PatrimonioSnapshot[]>
// SELECT * FROM patrimonio_snapshot ORDER BY fecha DESC LIMIT days; .reverse() to ascending

export async function fetchProximosVencimientos(windowDays?: number): Promise<VencimientoCuenta[]>
// SELECT id, nombre, dia_pago FROM cuenta WHERE activa=true AND dia_pago IS NOT NULL
// then diasRestantes() per row, filter 0<=x<=windowDays (default 7), sort ascending

export async function fetchCategoriasDelMes(): Promise<CategoriaHeat[]>
// SELECT categoria_id, monto, fecha FROM movimiento
// WHERE fecha >= monthsAgoStart(today,3) AND fecha < addMonths(startOfMonth(today),1) AND monto < 0
// bucket client-side by currentMonth vs. trailing-3 total; ratio = gastoMes / (trailingTotal/3)
// heat: ratio>1.5 hot, >1.15 warm, else normal; trailingTotal absent/0 → heat 'normal', ratio null

// components/patrimonio/patrimonio-dates.ts
export function nextDueDate(diaPago: number, today: Date): Date
export function diasRestantes(diaPago: number, today: Date): number
export function clampDayToMonth(year: number, month: number, day: number): number // month 0-indexed
```

```ts
// Component props
interface PatrimonioHeroProps { netWorth: number; history: PatrimonioSnapshot[] }
interface PatrimonioSparklineProps { history: PatrimonioSnapshot[] } // ascending, ≤14, sparse OK
interface PatrimonioSplitProps { disponible: number; retiro: number }
interface PatrimonioFondoDiversionProps {
  budget: number; spent: number; daysLeft: number; daysElapsed: number
}
interface PatrimonioDayPipsProps { totalDays: number; daysElapsed: number }
interface PatrimonioVencimientosProps { vencimientos: VencimientoCuenta[] } // pre-sorted
interface PatrimonioCategoriasProps { categorias: CategoriaHeat[] } // sorted by gastoMes desc
```

Class naming: `.patrimonio-hero__amount`, `.patrimonio-hero__delta--up|--down`, `.patrimonio-split__value--negative`, `.patrimonio-fondo__pct`, `.patrimonio-day-pips__pip--filled`, `.patrimonio-vencimiento-strip`, `.patrimonio-categoria-bar--hot|--warm|--normal` — BEM-ish, matching `movement-list-item__label`.

**Due-date algorithm** (`diasRestantes`, decision #8):
```
clampDayToMonth(y, m, day) = min(day, new Date(y, m+1, 0).getDate())
nextDueDate(diaPago, today):
  due = date(today.year, today.month, clampDayToMonth(today.year, today.month, diaPago))
  if due < startOfDay(today):
    nextMonth = today.month + 1 (rolling year if > 11)
    due = date(nextMonth.year, nextMonth.month, clampDayToMonth(nextMonth.year, nextMonth.month, diaPago))
  return due
diasRestantes = round((nextDueDate − startOfDay(today)) / 86_400_000)
```
Example: `diaPago=30`, today = Feb 5 2026 → `clampDayToMonth(2026,1,30)` = 28 (Feb 2026 non-leap) → due = Feb 28.

**SQL migration** (`20260724060000_add_patrimonio_snapshot.sql`):
```sql
ALTER TABLE cuenta ADD COLUMN es_fondo_retiro BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE cuenta SET es_fondo_retiro = TRUE
WHERE nombre IN ('Afore', 'Fintual PPR', 'GBM', 'Prestadero inversión', 'Yo te presto');

CREATE TABLE patrimonio_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  patrimonio_neto DECIMAL(14,2) NOT NULL,
  patrimonio_disponible DECIMAL(14,2) NOT NULL,
  total_activos DECIMAL(14,2) NOT NULL,
  total_deudas DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patrimonio_snapshot_fecha ON patrimonio_snapshot (fecha DESC);

ALTER TABLE patrimonio_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY patrimonio_snapshot_select_authenticated
  ON patrimonio_snapshot FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.patrimonio_snapshot TO authenticated;
```

**Cron setup** (`20260724060100_setup_patrimonio_snapshot_cron.sql`):
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'patrimonio-snapshot-daily',
  '0 6 * * *', -- 06:00 UTC = 00:00 America/Mexico_City (no DST)
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/patrimonio-snapshot-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```
`<PROJECT_REF>` and the `app.settings.service_role_key` Postgres setting (or a Supabase Vault secret referenced the same way) are filled at apply time from the live project — see Assumptions below. If the Supabase Dashboard's built-in Cron Jobs UI (Integrations → Cron) is available on this project's plan, it may be used instead to wire the same schedule → Edge Function invocation without hand-writing the `net.http_post` call; the outcome (one upserted row/day) is identical either way.

**Edge Function** (`supabase/functions/patrimonio-snapshot-daily/index.ts`):
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cuentas, error: fetchError } = await supabase
    .from('cuenta').select('saldo_real, es_fondo_retiro').eq('activa', true)
  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })

  const totalActivos = cuentas.filter((c) => c.saldo_real > 0).reduce((s, c) => s + c.saldo_real, 0)
  const totalDeudas = Math.abs(cuentas.filter((c) => c.saldo_real < 0).reduce((s, c) => s + c.saldo_real, 0))
  const patrimonioNeto = totalActivos - totalDeudas
  const retiro = cuentas.filter((c) => c.es_fondo_retiro).reduce((s, c) => s + c.saldo_real, 0)
  const patrimonioDisponible = patrimonioNeto - retiro
  const fecha = new Date().toISOString().slice(0, 10) // fixed 06:00 UTC run ⇒ matches local date, see rationale

  const { error: upsertError } = await supabase.from('patrimonio_snapshot').upsert(
    { fecha, patrimonio_neto: patrimonioNeto, patrimonio_disponible: patrimonioDisponible,
      total_activos: totalActivos, total_deudas: totalDeudas },
    { onConflict: 'fecha' },
  )
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
  return new Response(JSON.stringify({ ok: true, fecha }), { status: 200 })
})
```

**Font scoping** (`patrimonio-fonts.ts` + page wrapper):
```ts
// components/patrimonio/patrimonio-fonts.ts
import { JetBrains_Mono, Inter } from 'next/font/google'
export const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono', subsets: ['latin'],
  weight: ['400','500','600','700','800'], display: 'swap',
})
export const inter = Inter({
  variable: '--font-inter', subsets: ['latin'],
  weight: ['400','500','600','700'], display: 'swap',
})
```
```tsx
// app/(app)/reportes/page.tsx (root wrapper)
<div className={`${jetbrainsMono.variable} ${inter.variable} patrimonio-page`}>...</div>
```
`patrimonio-tokens.css` declares `--font-inter`-based `font-family` on `.patrimonio-page` and monetary/date elements reference `var(--font-jetbrains-mono)` directly — both resolve only inside this DOM subtree since the CSS variables are the `next/font` `.variable` classNames applied on that same wrapper, not on `<body>`.

**Color isolation**: `patrimonio-tokens.css` defines `--bg:#0B0E14; --bg-raised:#12161F; --line:#262B38; --line-soft:#1B2029; --ink:#F2F0EA; --ink-dim:#8B92A5; --ink-faint:#545B6B; --up:#3FB68B; --up-dim:#1E4A3C; --down:#D9534F; --down-dim:#4A2422; --amber:#E8A33D; --amber-dim:#4A3A1E;` all under the `.patrimonio-page` selector. Enforcement of "always dark, ignores `next-themes`": none of `components/patrimonio/**/*.css` references `.dark`, `.light`, or any `var(--theme-*)` token — the hex values are fixed regardless of the `class` `next-themes` sets on `<html>`, since `.patrimonio-page`'s own custom properties are unconditional. Verified at implementation review via `grep -r "theme-" components/patrimonio/` returning zero matches.

## Testing Strategy

| Scenario | Steps | Expected |
|---|---|---|
| Net worth reconciles | Compare `/reportes` hero figure to `/cuentas` sum | Values match exactly (both use `saldo_real`) |
| Sparse sparkline (day 1) | Fresh deploy, `patrimonio_snapshot` has 1 row | Renders 1 bar, no crash, delta chip omitted or shows "—" (no prior point to diff) |
| Delta chip color | Compare snapshot rows across days with rising/falling `patrimonio_neto` | Chip renders `--up`/green when current > oldest fetched, `--down`/red when lower |
| Disponible negative | Force `retiro > netWorth` in test data | `.patrimonio-split__value--negative` applies, renders in `--down` |
| Fondo diversión overflow | `spent > budget` | "excedido por $X" shown, percentage bar caps visually at 100% with red gradient, no layout break past 999% |
| Day-pips | `daysElapsed` from 0–7 | Exactly that many pips get `--filled`, rest unfilled |
| Vencimiento stacking | ≥2 cards with `dia_pago` inside 7-day window | Strips render most-urgent (`diasRestantes` ascending) first, correct count |
| Month-boundary clamping | `dia_pago=30`, test on Feb-dated "today" | Due date clamps to Feb 28/29, `diasRestantes` computed against clamped date |
| Categorías heat boundaries | `ratio` values at 1.14, 1.16, 1.5, 1.51, and `trailingTotal=0` | 1.16→warm, 1.51→hot, 1.14→normal, `trailingTotal=0`→normal/`ratio:null` |
| Prototype fidelity vs. theme toggle | Toggle app-wide `ThemeSwitcher` light/dark while on `/reportes` | Page colors/fonts unchanged — no `--theme-*` value visibly shifts anything under `.patrimonio-page` |
| Cron fires | Manually invoke the Edge Function (`supabase functions invoke patrimonio-snapshot-daily` or direct `pg_net.http_post` call) once deployed | New/updated row appears in `patrimonio_snapshot` for today's `fecha`, no duplicate row on second manual run |

## Migration / Rollout

Real schema migration — ordered deployment required:
1. Apply `20260724060000_add_patrimonio_snapshot.sql` (column + seed + table) against live Supabase.
2. Deploy the Edge Function (`supabase functions deploy patrimonio-snapshot-daily`) and set `SUPABASE_SERVICE_ROLE_KEY` in its environment.
3. Apply `20260724060100_setup_patrimonio_snapshot_cron.sql` (extensions + `cron.schedule`) — only after step 2, since it references the deployed function's URL.
4. Ship the page/components. Not blocked on the cron having fired yet — `fetchSnapshotHistory` handles 0 or 1 rows gracefully (sparse-history requirement), so the page is safe to ship the same day as the migration even before the first cron run completes.

Day-1 state: `patrimonio_snapshot` starts empty; sparkline renders 0–1 bars until the cron accumulates history over subsequent days. No backfill (explicit non-goal).

## Open Questions

None — all decisions above are final. The following are **assumptions requiring apply-time verification** against the live Supabase project (not resolvable from source alone):

- `pg_cron` and `pg_net` extension availability/enablement on this project's Supabase instance (Database → Extensions).
- Storage mechanism for the service-role secret referenced by `cron.schedule`'s `net.http_post` call — either a Postgres setting (`ALTER DATABASE ... SET app.settings.service_role_key = '...'`) or a Supabase Vault secret; exact syntax depends on which is available/enabled.
- `GRANT SELECT ON public.patrimonio_snapshot TO authenticated` and the RLS policy above may need adjustment if the live project's grant model differs from `fondo_semanal`'s (per the proposal's assumption, same fallback pattern applies).
- Whether the Supabase Dashboard's built-in Cron Jobs UI is available on this project's plan as an alternative to hand-written `pg_cron`/`pg_net` SQL.

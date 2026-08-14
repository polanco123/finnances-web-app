# Design: Debt Payment Control Panel

## Technical Approach

Add a new `components/deudas/` domain folder following the established `{domain}-service.ts` + `.tsx` + `.css` split (`components/cuentas/`, `components/patrimonio/`, `components/diversion/`). A new Supabase table, `deuda_pago`, stores one historical row per `(cuenta_id, periodo)` — never overwritten except for its own `monto_planeado`/`pagado`/`monto_pagado` fields within the same period — using the `patrimonio_snapshot` migration's exact RLS + explicit-GRANT convention (no `user_id`, matching `cuenta`'s single-user model). `periodo` is a `DATE` storing the first day of the month, computed client-side by reusing `patrimonio-dates.ts`'s existing `startOfMonth`/`toISODate` helpers — no new date-math is introduced, only a new consumer of the existing pure functions. A new `app/(app)/deudas/page.tsx` (`'use client'`, fetch-on-mount + `Promise.all`, mirroring `app/(app)/reportes/page.tsx`'s pattern) lists every `tipo='deuda'` account merged client-side with the current period's `deuda_pago` rows (no Postgres joins — this repo has zero RPC/join precedent per prior exploration; a second bounded query + `Map`-based merge is the established pattern, e.g. `fetchCategoriasDelMes()`'s client-side aggregation). Each account renders as a `DeudaPaymentCard` (collapsible header, mirroring `cuentas-card.tsx`) that expands into a `DeudaPaymentEdit` form (extends `diversion-budget-edit.tsx`'s edit-in-place numeric-input pattern, adding a paid/unpaid toggle). Separately, `fetchProximosVencimientos()` gains a `tipo='deuda'` filter and a second bounded query against `deuda_pago` for the current period, merged into `VencimientoCuenta` so the existing dashboard widget can render the recorded amount. The widget's rendering change stays inside `.patrimonio-page`'s isolated hardcoded-token system (`--ink`, `--ink-dim`, `--up`, `--amber` from `patrimonio-tokens.css`) — it must NOT introduce `--theme-*` references, since that page is deliberately theme-isolated (archived `add-dashboard-patrimonio` design, "Color system isolation" decision). The new `/deudas` page is a normal app page, so it uses the app-wide `--theme-*` tokens like `cuentas-card.css` does.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| `periodo` column type | `DATE`, storing the first day of the month (e.g. `2026-08-01`) | `periodo_year INT + periodo_month INT`; `periodo TEXT` (`'2026-08'`) | A single `DATE` supports `ORDER BY periodo` / range queries via native Postgres date functions with zero parsing; composes directly with `UNIQUE (cuenta_id, periodo)` (same guarantee shape as `patrimonio_snapshot.fecha UNIQUE`); avoids a text round-trip format bug class. Two-column `year+month` requires composite ordering/comparison logic for no benefit here (no cross-year arithmetic is needed beyond what `Date` already does). |
| `periodo` computation convention | Client computes `toISODate(startOfMonth(getTodayLocalDate()))` from the **existing** `patrimonio-dates.ts` exports, imported directly (cross-domain import, no duplication) | Duplicate a local `deudas-dates.ts` with copy-pasted `startOfMonth`/`toISODate` | These two functions are pure, side-effect-free, and already exhaustively used/tested indirectly via `patrimonio-service.ts`. Duplicating hand-rolled `Date` logic (the exact class of bug `clampDayToMonth` was written to prevent) risks drift between two copies. The functions have zero patrimonio-specific coupling (no Supabase calls, no component state), so importing them from `@/components/patrimonio/patrimonio-dates` is a reasonable, low-risk cross-domain dependency. Moving them to a shared `lib/dates.ts` was rejected as unnecessary churn — it would touch `patrimonio-service.ts`'s existing working import path for no functional gain. |
| Table name | `deuda_pago` | `pago_deuda` (proposal's placeholder); `deuda_payment` | Singular-noun table naming matches every existing table (`cuenta`, `movimiento`, `patrimonio_snapshot`, `fondo_semanal`); `deuda_pago` reads as "the debt's payment [record]" and aligns with the `deudas` domain folder/route naming below. |
| Domain folder / route naming | `components/deudas/` (plural), route `/deudas`, service `deudas-service.ts` | `components/deuda/` (singular, per proposal's Impact table) | The route is `/deudas` (plural, per proposal's "What Changes" and success criteria) and the sidebar label is "Deudas" — the domain folder name should match the route it serves, consistent with `components/cuentas/` matching `/cuentas` and `components/movement/` matching `/movimientos` conceptually. This is a deliberate refinement of the proposal's Impact table (which used singular `deuda/`), not a contradiction of any resolved decision — no capability name or spec path depends on the singular form. |
| No `user_id` column | Confirmed: `deuda_pago` has no `user_id` | `user_id UUID` (like `fondo_semanal`) | Restates the proposal's already-resolved decision #6: matches `cuenta`/`movimiento`/`patrimonio_snapshot`'s single-user model; the table's only foreign key is `cuenta_id`, and `cuenta` itself has no `user_id`. |
| `fetchProximosVencimientos()` monto join | Second bounded query (`deuda_pago` filtered by `periodo` + `cuenta_id IN (...)`) merged client-side via `Map`, only when the vencimientos list is non-empty | Supabase embedded-resource `select('*, deuda_pago(*)')` foreign-table syntax | Consistent with this project's zero-RPC, zero-embedded-join precedent (`fetchCategoriasDelMes()` does the same two-query-and-merge shape); embedded-resource selects require a declared FK relationship recognized by PostgREST's schema cache and add a coupling style not used anywhere else in the codebase. Query is skipped entirely when there are no vencimientos in the window, avoiding a wasted round trip. |
| Widget color tokens | Reuses `.patrimonio-page`'s existing isolated tokens: `--ink-dim` for a planned (unpaid) amount, `--up` for a paid amount | New `--theme-*` reference; a new patrimonio-specific token | The widget lives inside `.patrimonio-page`, which is contractually isolated from the app-wide theme system (archived design's "Color system isolation" decision, still binding — verified via `grep -r "theme-" components/patrimonio/patrimonio-vencimientos.css` returning zero matches before this change). `--amber` stays reserved for the existing urgency signal (`diasRestantes` label); reusing it for money would overload its meaning. `--up` (green) is the closest existing semantic match for "settled/paid." |
| `/deudas` page color tokens | App-wide `--theme-*` tokens (`--theme-color-success`, `--theme-color-warning`, `--theme-text-secondary`) | Isolated custom tokens (patrimonio-style) | `/deudas` is a normal app page (not a prototype-fidelity page like `/reportes`), so it must behave like every other page under the global `next-themes` light/dark toggle — `cuentas-card.css`, `diversion-budget-edit.css` etc. all use `--theme-*` and respond to `.dark`. |
| Paid/unpaid/no-data visual states | `--theme-color-success` (paid), `--theme-color-warning` (planned, not yet paid), `--theme-text-secondary` (no record for the period) | `--theme-color-error` for "no data" | "No data" is a neutral, not-yet-acted-upon state, not an error — `--theme-color-error` is reserved for validation/failure messaging elsewhere (`diversion-budget-edit.css`'s `--input--error`). `--theme-text-secondary` is the existing neutral/muted token (used for labels and empty states across the codebase). |
| `marcarMontoPlaneado` write semantics | `.upsert({ cuenta_id, periodo, monto_planeado }, { onConflict: 'cuenta_id,periodo' })` — payload omits `pagado`/`monto_pagado` | Always pass all four writable columns on every upsert | Supabase's generated `INSERT ... ON CONFLICT (...) DO UPDATE SET` only sets the columns present in the payload object; omitting `pagado`/`monto_pagado` means editing the planned amount after a period is already marked paid does NOT silently reset its paid state — editing planned and marking paid are independent writes, matching the proposal's "monto_pagado may differ from planned, independently" requirement. |
| "Mark paid" precondition | `DeudaPaymentEdit` disables "Marcar como pagado" until a `deuda_pago` row exists for that cuenta+periodo (i.e. `monto_planeado` was saved at least once) | Allow marking paid with no planned amount, defaulting `monto_planeado` to 0 | `marcarPagado(id, montoPagado)` takes a row `id`, which only exists once the row has been created via `upsertMontoPlaneado`. Requiring "plan first, then pay" is also the more natural real-world flow and avoids a confusing `monto_planeado: 0` artifact if the user never intended to set one. |
| Sidebar insertion point | Appended after `Patrimonio` (`/reportes`), before `Configuración` (`comingSoon: true`) | Inserted after `Cuentas` | Keeps the always-`comingSoon` placeholder last (existing invariant — every other real link precedes it); "Deudas" becomes the newest functional link, consistent with landing at the end of the functional group, same placement rule the proposal's success criteria implies ("sixth functional link"). |

## Data Flow

```
/deudas PAGE — READ PATH (on mount, browser)
──────────────────────────────────────────────
app/(app)/deudas/page.tsx  ('use client', useEffect, Promise.all)
  │
  ├─▶ fetchDeudaAccounts()          ─┐  deudas-service.ts
  └─▶ fetchPagosPorPeriodo(periodo) ─┘  periodo = getCurrentPeriodo()
        │
        ▼  merge client-side by cuenta.id === pago.cuentaId (Map lookup)
      DeudaAccountWithPago[] = [{ cuenta, pago: DeudaPago | null }, ...]
        │
        ▼  setState → render
      DeudaPaymentCard (one per account)
        │
        ├─ header: nombre, saldo_real, badge (Pagado/Planeado/Sin registrar)
        └─ expanded → DeudaPaymentEdit
              │
              ├─ edit monto_planeado ──▶ upsertMontoPlaneado(cuentaId, periodo, monto)
              │                            │
              │                            ▼
              │                          deuda_pago UPSERT ON CONFLICT (cuenta_id, periodo)
              │                            │
              │                            ▼  returns updated row
              │                          page patches local state in place (no refetch)
              │
              └─ marcar pagado (monto_pagado) ──▶ marcarPagado(id, montoPagado)
                                             │
                                             ▼
                                           deuda_pago UPDATE SET pagado=true, monto_pagado=...
                                             │
                                             ▼  returns updated row
                                           page patches local state in place (no refetch)

DASHBOARD WIDGET — EXTENDED READ PATH (on mount, browser, /reportes)
──────────────────────────────────────────────────────────────────
app/(app)/reportes/page.tsx  (unchanged call site: fetchProximosVencimientos(7))
  │
  ▼
patrimonio-service.ts: fetchProximosVencimientos(windowDays)
  │
  ├─▶ SELECT id, nombre, dia_pago FROM cuenta
  │     WHERE activa=true AND tipo='deuda' AND dia_pago IS NOT NULL
  │
  ▼  compute diasRestantes, filter 0..windowDays, sort ascending
  vencimientos: VencimientoCuenta[]  (monto fields still undefined)
  │
  ▼  if vencimientos.length > 0:
  ├─▶ SELECT cuenta_id, monto_planeado, pagado, monto_pagado FROM deuda_pago
  │     WHERE periodo = currentPeriodo AND cuenta_id IN (vencimientos.map(v => v.id))
  │
  ▼  merge by cuenta_id via Map
  VencimientoCuenta[] with montoPlaneado / montoPagado / pagado populated when a row exists
  │
  ▼  setState → render
  PatrimonioVencimientos(vencimientos)
    └─ per strip: nombre · [monto span, only if montoPlaneado !== undefined] · diasRestantes label
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260811070000_add_deuda_pago.sql` | Create | `deuda_pago` table + index + RLS policy + grants. 4th tracked migration (after `20260802000000_add_saldo_calculado_trigger.sql`) |
| `components/deudas/deudas-service.ts` | Create | `DeudaPago`, `DeudaAccountWithPago` interfaces; `getCurrentPeriodo`, `fetchDeudaAccounts`, `fetchPagosPorPeriodo`, `upsertMontoPlaneado`, `marcarPagado` |
| `components/deudas/deuda-payment-card.tsx` + `.css` | Create | Collapsible per-account card (mirrors `cuentas-card.tsx`): header (nombre, saldo_real, status badge, chevron), expand reveals `DeudaPaymentEdit` |
| `components/deudas/deuda-payment-edit.tsx` + `.css` | Create | Edit-in-place form (extends `diversion-budget-edit.tsx`): monto_planeado numeric input + save/cancel, paid toggle revealing monto_pagado input |
| `app/(app)/deudas/page.tsx` | Create | Fetch-on-mount composition: `fetchDeudaAccounts()` + `fetchPagosPorPeriodo(periodo)`, merge, render list of `DeudaPaymentCard`, loading/error/empty states |
| `app/(app)/deudas/page.css` | Create | Page layout (`--theme-*` tokens), list spacing, empty state |
| `components/patrimonio/patrimonio-service.ts` | Modify | `VencimientoCuenta` gains `montoPlaneado?`, `montoPagado?`, `pagado?`; `fetchProximosVencimientos()` adds `.eq('tipo', 'deuda')` filter + second bounded query + client-side merge |
| `components/patrimonio/patrimonio-vencimientos.tsx` | Modify | Renders monto span (planned or paid) when present, conditionally styled by paid state |
| `components/patrimonio/patrimonio-vencimientos.css` | Modify | New `__right`, `__monto`, `__monto--pagado` rules using existing isolated tokens |
| `components/app-shell/sidebar.tsx` | Modify | `NAV_ITEMS`: new `{ href: '/deudas', label: 'Deudas', icon: CreditCard }` inserted after Patrimonio, before Configuración; new `CreditCard` import from `lucide-react` |
| `data/cuenta.ts` | No change | `Cuenta` interface already has `tipo`, `activa`, `saldo_real` — confirmed sufficient for `fetchDeudaAccounts()`'s filter and card rendering |

## Interfaces / Contracts

```ts
// components/deudas/deudas-service.ts
import { createClient } from '@/lib/supabase/client'
import type { Cuenta } from '@/data/cuenta'
import { getTodayLocalDate, startOfMonth, toISODate } from '@/components/patrimonio/patrimonio-dates'

export interface DeudaPago {
  id: string
  cuentaId: string
  periodo: string           // ISO date, first-of-month, e.g. '2026-08-01'
  montoPlaneado: number
  pagado: boolean
  montoPagado: number | null
  createdAt: string
}

export interface DeudaAccountWithPago {
  cuenta: Cuenta
  pago: DeudaPago | null    // null = no record yet for this account+periodo
}

/** Returns the current calendar month's periodo key as an ISO date (first day of month). */
export function getCurrentPeriodo(): string
// toISODate(startOfMonth(getTodayLocalDate()))

/** SELECT * FROM cuenta WHERE tipo='deuda' AND activa=true ORDER BY nombre ASC */
export async function fetchDeudaAccounts(): Promise<Cuenta[]>

/** SELECT ... FROM deuda_pago WHERE periodo = :periodo (all deuda accounts, one query) */
export async function fetchPagosPorPeriodo(periodo: string): Promise<DeudaPago[]>

/**
 * Creates or updates the (cuentaId, periodo) row's monto_planeado.
 * UPSERT ON CONFLICT (cuenta_id, periodo) — payload omits pagado/monto_pagado,
 * so an existing paid state is never reset by editing the planned amount.
 */
export async function upsertMontoPlaneado(
  cuentaId: string,
  periodo: string,
  monto: number,
): Promise<DeudaPago>

/**
 * UPDATE deuda_pago SET pagado=true, monto_pagado=:montoPagado WHERE id=:id.
 * Caller must hold an existing row id (obtained from upsertMontoPlaneado or
 * fetchPagosPorPeriodo) — a period with no planned-amount row yet cannot be
 * marked paid directly.
 */
export async function marcarPagado(id: string, montoPagado: number): Promise<DeudaPago>
```

```ts
// components/patrimonio/patrimonio-service.ts (changed)
export interface VencimientoCuenta {
  id: string
  nombre: string
  diaPago: number
  diasRestantes: number
  montoPlaneado?: number   // present only if a deuda_pago row exists for the current period
  montoPagado?: number     // present only if pagado === true
  pagado?: boolean         // present only if a deuda_pago row exists for the current period
}

export async function fetchProximosVencimientos(windowDays?: number): Promise<VencimientoCuenta[]>
// unchanged signature; query gains .eq('tipo', 'deuda'); result merged with
// a second deuda_pago query scoped to the current period + matching cuenta_ids
```

```tsx
// components/deudas/deuda-payment-card.tsx
interface DeudaPaymentCardProps {
  cuenta: Cuenta
  pago: DeudaPago | null
  periodo: string
  onSavePlaneado: (cuentaId: string, periodo: string, monto: number) => Promise<void>
  onMarcarPagado: (id: string, montoPagado: number) => Promise<void>
}

// components/deudas/deuda-payment-edit.tsx
interface DeudaPaymentEditProps {
  montoPlaneado: number       // 0 when pago is null (no record yet)
  pagado: boolean
  montoPagado: number | null
  canMarcarPagado: boolean    // false when pago is null — must save planned amount first
  onSavePlaneado: (monto: number) => Promise<void>
  onMarcarPagado: (montoPagado: number) => Promise<void>
}
```

Class naming: `.deuda-payment-card__badge--pagado|--pendiente|--sin-registrar`, `.deuda-payment-edit__toggle`, `.deuda-payment-edit__monto-pagado-input` — BEM-ish, matching `cuenta-card__chevron--expanded`.

**SQL migration** (`supabase/migrations/20260811070000_add_deuda_pago.sql`):
```sql
CREATE TABLE deuda_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id UUID NOT NULL REFERENCES cuenta(id),
  periodo DATE NOT NULL,
  monto_planeado DECIMAL(14,2) NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  monto_pagado DECIMAL(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cuenta_id, periodo)
);
CREATE INDEX idx_deuda_pago_cuenta_periodo ON deuda_pago (cuenta_id, periodo DESC);

ALTER TABLE deuda_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY deuda_pago_select_authenticated
  ON deuda_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY deuda_pago_insert_authenticated
  ON deuda_pago FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY deuda_pago_update_authenticated
  ON deuda_pago FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS bypass and Postgres GRANTs are separate permission layers — the
-- patrimonio_snapshot migration missed this initially and a live upsert
-- failed with "permission denied for table patrimonio_snapshot" until the
-- explicit GRANT was added. Both grants are included from the start here.
GRANT SELECT, INSERT, UPDATE ON public.deuda_pago TO authenticated;
```
No `user_id` column — matches `cuenta`/`movimiento`/`patrimonio_snapshot`'s single-user model (proposal's Resolved Decision #6, restated here, not re-argued).

**`fetchProximosVencimientos()` diff** (`components/patrimonio/patrimonio-service.ts`):
```ts
export async function fetchProximosVencimientos(windowDays: number = 7): Promise<VencimientoCuenta[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('id, nombre, dia_pago')
    .eq('activa', true)
    .eq('tipo', 'deuda')                 // NEW
    .not('dia_pago', 'is', null)

  if (error) throw error

  const today = getTodayLocalDate()

  const vencimientos = (data ?? [])
    .map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
      diaPago: c.dia_pago as number,
      diasRestantes: diasRestantesHelper(c.dia_pago as number, today),
    }))
    .filter((v) => v.diasRestantes >= 0 && v.diasRestantes <= windowDays)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  if (vencimientos.length === 0) return vencimientos            // NEW: skip 2nd query

  const periodo = toISODate(startOfMonth(today))                // NEW
  const { data: pagos, error: pagosError } = await supabase     // NEW
    .from('deuda_pago')
    .select('cuenta_id, monto_planeado, pagado, monto_pagado')
    .eq('periodo', periodo)
    .in('cuenta_id', vencimientos.map((v) => v.id))

  if (pagosError) throw pagosError

  const pagoByCuentaId = new Map((pagos ?? []).map((p) => [p.cuenta_id as string, p]))

  return vencimientos.map((v) => {
    const pago = pagoByCuentaId.get(v.id)
    if (!pago) return v
    return {
      ...v,
      montoPlaneado: pago.monto_planeado as number,
      pagado: pago.pagado as boolean,
      montoPagado: (pago.monto_pagado as number | null) ?? undefined,
    }
  })
}
```
`startOfMonth`/`toISODate` are already imported at the top of this file (used by `fetchCategoriasDelMes()`) — no new import needed.

**`patrimonio-vencimientos.tsx` diff**:
```tsx
function formatMonto(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

// inside the .map((v) => ...) render:
<div key={v.id} className="patrimonio-card patrimonio-vencimiento-strip">
  <span className="patrimonio-vencimiento-strip__nombre">{v.nombre}</span>
  <span className="patrimonio-vencimiento-strip__right">
    {v.montoPlaneado !== undefined && (
      <span
        className={`patrimonio-vencimiento-strip__monto${
          v.pagado ? ' patrimonio-vencimiento-strip__monto--pagado' : ''
        }`}
      >
        {formatMonto(v.pagado && v.montoPagado !== undefined ? v.montoPagado : v.montoPlaneado)}
      </span>
    )}
    <span className="patrimonio-vencimiento-strip__dias">
      {labelDiasRestantes(v.diasRestantes)}
    </span>
  </span>
</div>
```
When `montoPlaneado` is `undefined` (no `deuda_pago` row for the period), only the date label renders — identical to today's output, satisfying the proposal's "otherwise falls back to date-only" requirement.

**`patrimonio-vencimientos.css` additions**:
```css
.patrimonio-vencimiento-strip__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.patrimonio-vencimiento-strip__monto {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-dim);
}

.patrimonio-vencimiento-strip__monto--pagado {
  color: var(--up);
}
```

**Sidebar diff** (`components/app-shell/sidebar.tsx`):
```tsx
import {
  LayoutDashboard,
  ArrowLeftRight,
  Gamepad2,
  Wallet,
  Tags,
  BarChart3,
  CreditCard,     // NEW
  Settings,
} from 'lucide-react'

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/diversion', label: 'Diversión', icon: Gamepad2 },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/reportes', label: 'Patrimonio', icon: BarChart3 },
  { href: '/deudas', label: 'Deudas', icon: CreditCard },        // NEW — inserted here
  { href: '/configuracion', label: 'Configuración', icon: Settings, comingSoon: true },
]
```

## Testing Strategy

| Scenario | Steps | Expected |
|---|---|---|
| Create planned amount | On `/deudas`, expand a debt account with no prior record, enter a monto, save | Row created in `deuda_pago` (`pagado=false`, `monto_pagado=null`); card badge shows "Planeado $X" (`--theme-color-warning`) |
| Mark paid with differing amount | On a card with a saved `monto_planeado`, toggle "marcar pagado", enter a different `monto_pagado`, save | `pagado=true`, `monto_pagado` persisted independently of `monto_planeado` (both values remain distinct in the DB row); badge switches to "Pagado $Y" (`--theme-color-success`) |
| Edit planned amount after paid | On an already-paid card, edit `monto_planeado` again and save | `upsertMontoPlaneado` payload omits `pagado`/`monto_pagado` — paid state and `monto_pagado` remain untouched; badge stays "Pagado" |
| History across 2+ periods | Manually insert a second row for the same `cuenta_id` with a past `periodo` via Supabase SQL editor, then reload `/deudas` | Current-period fetch (`fetchPagosPorPeriodo(currentPeriodo)`) only returns the current-period row — the past-period row is not clobbered and does not appear, confirming `UNIQUE (cuenta_id, periodo)` allows multiple periods per account without collision |
| Zero deuda accounts | Temporarily set all `tipo='deuda'` accounts to `activa=false` (or verify against a fresh account with none), load `/deudas` | Empty-state message renders, no crash, no error |
| Dashboard: amount vs. date-only | Compare a `tipo='deuda'` account with a `deuda_pago` row for the current period vs. one without | With a row: monto renders next to the date. Without: only the date label renders (identical to pre-change output) |
| Dashboard: non-deuda accounts excluded | Check live data for any account with `dia_pago` set but `tipo != 'deuda'` | Such an account no longer appears in "Próximo vencimiento" post-change — **flagged below as an apply-time verification**, not a design open question |
| Sidebar nav | Click "Deudas" in the sidebar | Navigates to `/deudas`, link highlights active, no "Próximamente" badge |
| Dark mode | Toggle `next-themes` light/dark while on `/deudas` | Card, badges, inputs all respond via `--theme-*` (matches `cuentas-card.css`/`diversion-budget-edit.css` dark-mode rules); `/reportes` widget colors remain unchanged regardless of toggle (isolated tokens) |

## Migration / Rollout

Real schema migration — ordered deployment required:
1. Apply `supabase/migrations/20260811070000_add_deuda_pago.sql` against live Supabase (table + RLS + both `SELECT`/`INSERT`/`UPDATE` grants for `authenticated`, included from the start — proactively applying the lesson from `patrimonio_snapshot`'s missed-grant incident earlier this session, not deferring it to a hotfix).
2. Ship the code: `components/deudas/*`, `app/(app)/deudas/page.tsx`, the `patrimonio-service.ts`/`patrimonio-vencimientos.tsx` extensions, and the `sidebar.tsx` nav entry, in the same deploy (all additive/backward-compatible — pre-change `VencimientoCuenta` consumers still work since the new fields are optional).

Day-1 state: `deuda_pago` starts empty (explicit non-goal: no historical backfill, same precedent as `patrimonio_snapshot`). `/deudas` renders every `tipo='deuda'` account with a "Sin registrar" badge until the user records its first `monto_planeado`. The dashboard widget renders date-only for every account until a `deuda_pago` row exists for the current period — functionally identical to its pre-change behavior on day 1.

## Open Questions

None — every decision above is final. The following is an **assumption requiring apply-time verification** against the live Supabase project and live data (not resolvable from source alone), per this session's established pattern:

- Whether any live `cuenta` row has `dia_pago IS NOT NULL` but `tipo != 'deuda'` — if so, the new `tipo='deuda'` filter on `fetchProximosVencimientos()` will correctly stop surfacing it (per the proposal's Resolved Decision #5, a correctness fix), but this should be spot-checked against live data at apply time to confirm no currently-visible vencimiento silently disappears unexpectedly for the user.
- The `GRANT SELECT, INSERT, UPDATE ON public.deuda_pago TO authenticated` statement is expected to be sufficient (no `service_role` grant is needed here, unlike `patrimonio_snapshot`, since there is no unattended Edge Function writing to this table — all writes come from the authenticated browser session). Confirm no "permission denied" occurs on first live `upsertMontoPlaneado`/`marcarPagado` call after migration.

## Amendment (2026-08-14): Per-account `periodo` semantics

**Do not read this as replacing the sections above** — the migration, table shape, and `marcarPagado` semantics documented above are still accurate and still shipped. This amendment supersedes ONLY the "shared current-month `periodo`" parts of the original design (the `getCurrentPeriodo()` helper and `fetchPagosPorPeriodo(periodo)` shape), based on real user testing feedback after PR 1-3 shipped: a single page-wide "current month" `periodo` does not match how `dia_pago` actually varies per debt account (e.g. a card due on the 5th and a loan due on the 28th should never share the same `periodo` value).

### What changed and why

The original design computed one `periodo` (`toISODate(startOfMonth(getTodayLocalDate()))`) shared by every deuda account on the page. In practice this is wrong: each account's real due date is its own `dia_pago`-derived date, not the calendar month's first day. The fix reuses `patrimonio-dates.ts`'s existing `nextDueDate(diaPago, today)` — already proven correct by the `/reportes` "Próximo vencimiento" widget — as the ONE date rule for computing an account's `periodo`, for both "first record ever" and "next record after the previous one was paid." No new date-math was introduced; only a new consumer of the existing pure function, consistent with the original design's own precedent for reusing `patrimonio-dates.ts`.

### `deudas-service.ts` — removed / added functions

| Function | Status | Signature |
|---|---|---|
| `getCurrentPeriodo()` | **Removed** | — |
| `fetchPagosPorPeriodo(periodo)` | **Removed** | — |
| `upsertMontoPlaneado(cuentaId, periodo, monto)` | **Removed** | replaced by `crearRegistroPago` (insert) + `updateMontoPlaneado` (update by id) — an upsert-by-(cuenta,periodo) no longer maps cleanly onto the 3-state model below |
| `computePeriodoParaCuenta(cuenta, today?)` | **Added** | `(cuenta: Cuenta, today: Date = getTodayLocalDate()) => string \| null` — `null` when `cuenta.dia_pago` is not set; otherwise `toISODate(nextDueDate(cuenta.dia_pago, today))` |
| `fetchLatestPagosPorCuentas(cuentaIds)` | **Added** | `(cuentaIds: string[]) => Promise<Map<string, DeudaPago>>` — one bounded query (`.in('cuenta_id', cuentaIds).order('periodo', { ascending: false })`), client-side reduced to the latest row per account. Same "one bounded fetch + client-side aggregation" convention as `fetchCategoriasDelMes`/`fetchCategoriasConGasto` |
| `crearRegistroPago(cuentaId, periodo, montoPlaneado)` | **Added** | `Promise<DeudaPago>` — plain `INSERT`, not upsert; only called when no existing row is known for the account, so a real DB error should surface rather than be silently absorbed |
| `updateMontoPlaneado(id, monto)` | **Added** | `Promise<DeudaPago>` — `UPDATE ... SET monto_planeado WHERE id`, does not touch `pagado`/`monto_pagado`/`periodo` |
| `updatePeriodo(id, periodo)` | **Added** | `Promise<DeudaPago>` — `UPDATE ... SET periodo WHERE id`; may throw a `UNIQUE (cuenta_id, periodo)` violation, intentionally not caught here — the caller (UI) must surface it |
| `marcarPagado(id, montoPagado)` | **Unchanged** | still `UPDATE ... SET pagado=true, monto_pagado WHERE id` |
| `fetchDeudaAccounts()` | **Unchanged** | still `SELECT * FROM cuenta WHERE tipo='deuda' AND activa=true ORDER BY nombre ASC` |

`DeudaPago.periodo`'s doc comment changes meaning: it is no longer "first-of-month" — it is now an arbitrary ISO date representing that specific record's own computed-or-edited due date.

### 3-state UI model (replaces the old single "edit monto, mark paid" flow)

`DeudaPaymentCard` now derives one of four states from `(pago, cuenta.dia_pago)` and passes it to `DeudaPaymentEdit` as a `state` prop, instead of `DeudaPaymentEdit` inferring behavior from a `canMarcarPagado` boolean:

1. **`bloqueado`** — no record AND `cuenta.dia_pago` is null. No action available; renders an explanatory message. Per the user's explicit decision, there is NO day-1-of-month fallback — a debt account without a configured `dia_pago` simply cannot have a payment record created for it.
2. **`sin-registrar`** — no record, `dia_pago` is set. "Registrar pago" reveals an editable date picker (defaulting to `computePeriodoParaCuenta(cuenta)`) + monto input → `crearRegistroPago`.
3. **`pendiente`** — latest record exists, `pagado === false`. Three independent actions: edit `monto_planeado` (→ `updateMontoPlaneado`), edit `periodo` via date picker defaulting to the record's OWN current value, not recalculated (→ `updatePeriodo`), and "Marcar como pagado" (→ `marcarPagado`, unchanged).
4. **`pagado`** — latest record exists, `pagado === true`. Read-only: shows final `monto_planeado`/`monto_pagado`/`periodo`. "Registrar próximo pago" recomputes `periodoSugerido = computePeriodoParaCuenta(cuenta)` (from TODAY, not "last periodo + 1 month") and shows an inline confirmation form (editable date, defaulting to the recalculated one, + monto input + Confirmar/Cancelar, with confirmation text reflecting the currently-selected date) before calling `crearRegistroPago`. Disabled with a tooltip if `dia_pago` was cleared since the record was created (`periodoSugerido === null`).

`DeudaPaymentCard` also now renders a read-only `Corte: día N · Pago: día N` subtitle under the account name (from `cuenta.dia_corte`/`cuenta.dia_pago`), omitted entirely when both are null.

### `app/(app)/deudas/page.tsx` diff

`Promise.all([fetchDeudaAccounts(), fetchPagosPorPeriodo(periodo)])` is replaced with a sequential `fetchDeudaAccounts()` → `fetchLatestPagosPorCuentas(accounts.map(c => c.id))` (sequential because the bounded query now needs the account ids first). Local state changes from a `DeudaPago[]` array to a `Map<cuentaId, DeudaPago>` tracking only each account's latest record. `patchPago` now sets by `cuentaId` (not by row `id`) so that `crearRegistroPago`'s response both ADDS a first-ever record and REPLACES a superseded (just-paid) record under the same key, while `updateMontoPlaneado`/`updatePeriodo`/`marcarPagado` responses replace in place — both cases collapse to the same "set by cuentaId" operation.

### Non-goals of this amendment

Phase E (`patrimonio-service.ts` / `patrimonio-vencimientos.tsx` dashboard widget) and Phase F (sidebar) were never implemented (still `[ ]` in tasks.md) and are unaffected by this amendment — they will need to account for the new per-account `periodo` semantics when they are eventually built, but that is out of scope here.

## Amendment (2026-08-14): Table/month-tabs UI redesign

**Do not read this as replacing the sections above** — the table shape, RLS/grants, `crearRegistroPago`/`updateMontoPlaneado`/`updatePeriodo`/`marcarPagado` semantics, and the 4-value state model (`bloqueado`/`sin-registrar`/`pendiente`/`pagado`) documented above are all still accurate and still shipped. This amendment supersedes ONLY the presentation layer — the collapsible-card list (`DeudaPaymentCard` + `DeudaPaymentEdit`) is retired and replaced with a 12-month-tab selector plus a data-grid table, per a real UX rework requested by the user after live-testing the card-based `/deudas` panel.

### What changed and why

The card-per-account list only ever showed each account's LATEST record — there was no way to see or edit a specific past/future month's record, and no aggregate view of what was planned/paid across accounts for a given month. The user requested: (1) a month-tab selector (current year only, year switcher deferred) so any month's records are directly addressable; (2) a table/grid layout, since a spreadsheet-like view suits comparing many accounts across a period far better than expandable cards; (3) a `notas` free-text field per record; (4) a per-month totals row. This is a real requirements change discovered through use, not a bug fix — the underlying per-account `periodo` data model from the prior amendment is untouched.

### New database column

`supabase/migrations/20260812000000_add_deuda_pago_notas.sql`: `ALTER TABLE deuda_pago ADD COLUMN notas TEXT;` — written to disk but NOT applied to the live Supabase project as of this amendment (operator action, same pattern as `20260811070000_add_deuda_pago.sql`'s A.4 task). Code assumes the column exists going forward — `DeudaPago.notas: string | null`, read by `mapDeudaPago`, written by the new `updateNotas`. Until the migration is applied live, `notas` reads as `null` (the column is simply absent from Supabase's response) and `updateNotas` will fail with a live Postgres error — this is a compile-time-only implementation, matching this session's established convention for not-yet-live migrations.

### `deudas-service.ts` — added functions and changed interface

| Symbol | Status | Signature / change |
|---|---|---|
| `DeudaPago.notas` | **Added field** | `string \| null` |
| `computePeriodoParaMes(diaPago, year, month)` | **Added** | `(diaPago: number, year: number, month: number) => string` — `month` is 0-indexed (JS `Date`/`clampDayToMonth` convention). Reuses `clampDayToMonth` directly (imported from `patrimonio-dates.ts`) to compute the clamped due-date WITHIN the given month/year — no "roll to next month" logic, unlike `computePeriodoParaCuenta`/`nextDueDate`, since the month is already explicitly chosen by a tab. |
| `fetchPagosDelAnio(year)` | **Added** | `(year: number) => Promise<DeudaPago[]>` — one bounded query, `periodo >= '{year}-01-01' AND periodo <= '{year}-12-31'`, ordered by `periodo` ascending. Returns the flat list for the whole year; the page does client-side month-bucketing (no grouping happens in the service layer). |
| `updateNotas(id, notas)` | **Added** | `(id: string, notas: string \| null) => Promise<DeudaPago>` — plain `UPDATE ... SET notas WHERE id`, same "update by id" pattern as `updateMontoPlaneado`/`updatePeriodo`. |
| `computePeriodoParaCuenta`, `fetchLatestPagosPorCuentas`, `crearRegistroPago`, `updateMontoPlaneado`, `updatePeriodo`, `marcarPagado`, `fetchDeudaAccounts` | **Unchanged** | `fetchLatestPagosPorCuentas` is no longer called by `page.tsx` (superseded by `fetchPagosDelAnio`, which fetches the whole year instead of just the latest record per account) but is kept — it's a small, correct, potentially-reusable "latest per account" query and removing it would be unjustified churn for a still-exported, still-documented function. |

### Account × month row model

Replaces the old "one row per account, showing only its latest record" model. For a selected `(year, month)` tab: every active `tipo='deuda'` account gets exactly one table row. `page.tsx` builds a `Map<cuentaId, DeudaPago>` by filtering the full-year `fetchPagosDelAnio` result to rows whose `periodo`'s month component equals the selected month (parsed via string-slicing the ISO date, `Number(periodo.slice(5, 7)) - 1`, deliberately avoiding a `Date` construction and its timezone pitfalls), then maps every account to `{ cuenta, pago: map.get(cuenta.id) ?? null }`. If an account has 2+ records within the same month (not prevented by `UNIQUE (cuenta_id, periodo)`, which is exact-date, not per-month — an edge case outside normal usage, since the UI only ever creates one record at a time per account), the Map's last-write-wins on the year list's ascending `periodo` order, so the latest-dated one within that month is shown.

### New/changed files

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260812000000_add_deuda_pago_notas.sql` | Create (already on disk, not yet applied live) | `ALTER TABLE deuda_pago ADD COLUMN notas TEXT;` |
| `components/deudas/deudas-service.ts` | Modify | `notas` field + `computePeriodoParaMes`, `fetchPagosDelAnio`, `updateNotas` added; nothing removed |
| `components/deudas/deuda-payment-card.tsx` + `.css` | **Deleted** | Retired — no remaining references anywhere in the codebase (confirmed via grep before deletion); a table-row layout doesn't fit the "collapsible card → expand to edit form" interaction model |
| `components/deudas/deuda-payment-edit.tsx` + `.css` | **Deleted** | Retired alongside the card — its state-branching logic (4-value state model, numeric-input validation pattern, confirm-before-create-next flow) was reused conceptually in the new row component, not copy-pasted, since the rendered output is now table cells, not a card's expand panel |
| `components/deudas/deuda-month-tabs.tsx` + `.css` | Create | 12-tab month selector (`role="tablist"`), current year only |
| `components/deudas/deuda-payment-table.tsx` + `.css` | Create | The table/grid: header row, one `DeudaPaymentTableRow` per account (local, unexported sub-component), totals `<tfoot>` row, and an inline `DeudaPaidCheckbox` (styled square button using `--theme-color-success` + a `lucide-react` `Check` icon, not a bare native checkbox) |
| `app/(app)/deudas/page.tsx` + `.css` | Modify | Composes `DeudaMonthTabs` + `DeudaPaymentTable`; `selectedMonth` state (0-indexed, defaults to `new Date().getMonth()`); year fixed to `new Date().getFullYear()` (no year switcher yet); fetches `fetchDeudaAccounts()` + `fetchPagosDelAnio(currentYear)` via `Promise.all` on mount (no longer sequential — `fetchPagosDelAnio` doesn't need account ids first, unlike the retired `fetchLatestPagosPorCuentas`); local state is a flat `DeudaPago[]` (the whole year) instead of a `Map<cuentaId, DeudaPago>` (latest-only); `patchPago` now inserts-or-replaces by row `id` in that flat list |

### Styled checkbox

The "Pagado" column renders `DeudaPaidCheckbox`: a `<button role="checkbox">` styled as a 22×22px bordered square using `--theme-border-default`/`--theme-color-success`/`--theme-radius-sm`, filling solid `--theme-color-success` and showing a `lucide-react` `Check` icon (14px, `strokeWidth={3}`, white via `--theme-text-on-primary`) when checked. Disabled (non-interactive, dimmed via `opacity`) for every state except `pendiente` — `sin-registrar`/`bloqueado` rows have no record `id` to mark paid, and `pagado` rows are read-only history. Clicking an enabled (unchecked) checkbox reuses the EXISTING `marcarPagado` flow unchanged: `window.prompt('Monto pagado', pago.montoPlaneado.toString())` for the amount (defaulting to the planned amount), then `onMarcarPagado(pago.id, monto)`. A native browser prompt was chosen over an inline mini-form specifically for the table-cell context — the row is a compact grid cell, not an expandable card panel, so a modal-less prompt keeps the interaction one click instead of an inline form taking over the row's layout.

### Non-goals of this amendment

Phase E (dashboard widget) and Phase F (sidebar) remain out of scope, same as the prior amendment. A year switcher for the month tabs is explicitly deferred per the user's confirmed requirements round — the year is hardcoded to the current calendar year.

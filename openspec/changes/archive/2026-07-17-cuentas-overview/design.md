# Design: Cuentas Overview Page

## Technical Approach

Replace the `ComingSoon` stub at `app/(app)/cuentas/page.tsx` with a client-rendered page that mirrors the existing `movimientos` and `diversion` pages: `'use client'` + `useEffect`-driven fetch via a dedicated service module, no server-side data fetching. A new `components/cuentas/cuentas-service.ts` exposes two read-only functions (list active accounts, list an account's recent movimientos). The page orchestrates both calls and renders one `CuentaCard` per active account, each embedding the existing `MovementListItem` unchanged. The sidebar change is a one-line flag flip with no new CSS.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Component type | Client Component (`'use client'`) | Server Component (proposal allows either) | `movimientos/page.tsx` and `diversion/page.tsx` — the two precedents in this route family — are both client components with browser Supabase client + `useEffect`. Matching keeps all sibling pages consistent; no auth/SEO/streaming need justifies forking the data-fetching style. |
| Supabase client | Browser client (`@/lib/supabase/client`), created per function call | Server client (`@/lib/supabase/server`) | Follows `diversion-service.ts` exactly: fresh `createClient()` inside each exported function, never module-level. Also required by the component-type decision above (server client needs `cookies()`, unavailable client-side). |
| Service structure | Two functions: `fetchActiveCuentas()`, `fetchRecentMovimientos(cuentaId)` | One combined "fetch everything" function | Mirrors `diversion-service.ts`'s granularity (`fetchActiveWeek` / `fetchWeekMovements` separate). Single-purpose, independently reusable. |
| Fetch orchestration | Fetch accounts first, then `Promise.all` over accounts for movimientos | Sequential per-account loop | Avoids N sequential round-trips; account count is small (personal, single-user app). |
| Per-card layout | New `CuentaCard` wraps balance header + `MovementListItem` list | Inline JSX in the page | Keeps `page.tsx` a thin orchestrator (matches `movimientos/page.tsx`'s simple `.map`); isolates card-level empty/loading states. |
| Sidebar update | Remove `comingSoon: true` key entirely from the Cuentas entry | Set `comingSoon: false` explicitly | Matches how Dashboard/Movimientos/Diversión are already written — key absent, not falsy. |
| CSS tokens | `--theme-*` custom properties only | Hardcoded hex values | Matches every existing stylesheet; no page in this codebase uses raw hex. `.account-pill`/`.account-cards` in dashboard `page.css` is visual reference only, not a reused class name. |

## Data Flow

```
cuenta (activa=true) ─fetchActiveCuentas()─► Cuenta[]
                                                │
CuentasPage (useEffect) ◄──────────────────────┘
        │ Promise.all(cuentas.map(c => fetchRecentMovimientos(c.id)))
        ▼
movimiento (cuenta_id, limit 5, fecha desc) ─► Movimiento[] per cuenta
        │
        ▼
state { cuentas, movimientosByCuentaId } ─► CuentaCard per cuenta ─► MovementListItem per movimiento
```

No `user_id` filter anywhere (neither table has the column, per proposal §5).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/(app)/cuentas/page.tsx` | Modify | Replace `<ComingSoon>` stub; `useEffect` loads accounts + movimientos, renders loading/empty/error states and a `CuentaCard` per active account |
| `app/(app)/cuentas/page.css` | Create | Page container + grid layout, `--theme-*` tokens only |
| `components/cuentas/cuentas-service.ts` | Create | `fetchActiveCuentas()`, `fetchRecentMovimientos(cuentaId)`, `Cuenta` type — follows `diversion-service.ts`'s per-call `createClient()` + throw-on-error pattern |
| `components/cuentas/cuentas-card.tsx` | Create | Renders one account's balance header + movimientos list (`MovementListItem`) or empty-state |
| `components/cuentas/cuentas-card.css` | Create | Card visual treatment, `--theme-*` tokens only |
| `components/app-shell/sidebar.tsx` | Modify | Remove `comingSoon: true` from the Cuentas `NAV_ITEMS` entry (line 27) |
| `components/movement/movement-list-item.tsx` | None | Reused unchanged |

## Interfaces / Contracts

```typescript
// components/cuentas/cuentas-service.ts
export interface Cuenta {
  id: string
  nombre: string
  tipo: string
  saldo_real: number
  activa: boolean
}

export async function fetchActiveCuentas(): Promise<Cuenta[]>

// Movimiento shape matches movement-list-item.tsx's existing prop type —
// no new type needed; import/reuse its inline interface shape.
export async function fetchRecentMovimientos(cuentaId: string): Promise<Movimiento[]>
```

Both functions follow the `diversion-service.ts` contract: throw on Supabase error, return `[]` (never `null`) when no rows match.

## Testing Strategy

No automated test runner is configured in this project. Verification is manual, per project convention:

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build/Lint | Type correctness, no unused imports | `npm run lint`, `npm run build` |
| Manual — happy path | Active accounts render `saldo_real` + up to 5 movimientos, `fecha` desc | Load `/cuentas` against seeded data with >5 movimientos on one account |
| Manual — edge cases | Zero active accounts, zero movimientos, `es_transferencia = true` row | Toggle `activa`, delete movimientos, insert a transfer row, reload |
| Manual — navigation | Sidebar "Cuentas" has no badge/muted style, navigates to `/cuentas` | Inspect sidebar and click through |
| Manual — non-goals | No mutation controls; `saldo_calculado` never rendered | Visual inspection |

## Migration / Rollout

No migration required. If live `cuenta`/`movimiento` queries hit a permissions error (unverified RLS/grants), apply the documented fix: `GRANT SELECT ON public.cuenta TO authenticated;` (and `public.movimiento` if needed), following the `TODO` convention in `diversion-service.ts`.

## Open Questions

None — all decisions were resolved by the user prior to this proposal (see proposal's "Resolved Decisions" section).

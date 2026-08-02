## Why

The "Diversión personal" categoria (id `af6b676c-04db-4fda-b9f7-349123d75e1a`, tipo discrecional, es_diversion: true) already carries a weekly Monday-Sunday budget in the live Supabase table `fondo_semanal` (fecha_inicio, fecha_fin, monto_presupuestado, activo), but that table has zero footprint in the app — no UI reads or writes it. Today the user has to mentally track discretionary spend against a budget they can't see in-app, and logging a diversion expense means using the generic movimientos form with no budget context. This makes it hard to know, in the moment, whether there's room left in the week before spending.

## What Changes

- Add a `/diversion` route showing the current week's (Mon-Sun) Diversión personal movimientos — the list scoped to whichever `fondo_semanal` row is active for today's date — plus a spent-vs-`monto_presupuestado` progress indicator.
- Allow registering a new gasto movimiento for Diversión personal directly from this view (mirrors the `components/movement/` form+mapper+service split, in TypeScript).
- Allow editing `monto_presupuestado` on the currently active `fondo_semanal` row from this view.
- Rollover is manual and out of this feature's logic: users already register a transferencia movimiento to move surplus to savings or replenish a deficit; each week has its own pre-existing `fondo_semanal` row. This feature only reads the active row — it computes no rollover.

## Non-Goals (Phase 1)

- Editing or deleting existing movimientos.
- Viewing historical (past) weeks or past `fondo_semanal` rows.
- Automatic rollover/reset computation between weeks.
- Changing `fecha_inicio`/`fecha_fin` on any `fondo_semanal` row.
- Creating new `fondo_semanal` rows (see Open Questions — flagged as a possible Phase 1 usability blocker, not assumed safe to defer).

## Assumptions to Validate

- `fondo_semanal` schema (`id, fecha_inicio, fecha_fin, monto_presupuestado, activo`) is known only from the user's verbal description — no migration, type, or code reference exists in-repo (consistent with `movimiento`/`categoria`/`cuenta` also having no in-repo schema; not a special gap). Must confirm actual column names/types/nullability against live Supabase before the design phase writes the service layer.
- "Active" week is assumed to mean "today falls within `[fecha_inicio, fecha_fin]`". Whether the `activo` boolean is the actual source of truth (vs. redundant with date-range containment, vs. something else entirely) is unconfirmed and must be resolved before query logic is designed.
- No RLS/auth-scoping specifics for `fondo_semanal` are known; assumed to follow the same single-user auth model already enforced by `proxy.ts` for every other authenticated route.

## Capabilities

### New Capabilities

- `diversion-weekly-view`: Read-only view of the current week's Diversión personal movimientos (scoped to the active `fondo_semanal` row's date range) plus a spent-vs-budget progress indicator.
- `diversion-expense-registration`: Register a new gasto movimiento for Diversión personal directly from the diversion view.
- `fondo-semanal-budget-config`: Edit `monto_presupuestado` on the currently active `fondo_semanal` row.

### Modified Capabilities

- None. This mirrors the existing `components/movement/` domain pattern into a new, separate domain rather than changing behavior of any existing spec.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/diversion/page.tsx` | New | Flat route (no `proxy.ts` change needed — auth already covers any new authenticated path); composes fetch of active `fondo_semanal` + week's movimientos, list, progress indicator, and form |
| `components/diversion/diversion-form.tsx` | New | Mirrors `movement-form` for Diversión personal gasto registration, in TS |
| `components/diversion/diversion-mapper.ts` | New | Pure function(s) building the movimiento payload for a Diversión personal expense |
| `components/diversion/diversion-service.ts` | New | Supabase calls: fetch active `fondo_semanal` row, fetch week's movimientos, insert movimiento, update `monto_presupuestado` |
| `components/diversion/diversion-list-item.tsx` | New | Mirrors `movement-list-item.tsx` for diversion expense rows |
| `components/diversion/diversion-progress.tsx` | New | Spent-vs-budget indicator; design phase decides shadcn `Progress` vs. reusing the hand-rolled `category-bar__fill` width% pattern from `app/dashboard/page.tsx` |
| week-range date helper (path TBD) | New | Monday-Sunday range math; design phase decides hand-rolled `Date` logic vs. adding a date library (no date-fns/dayjs in this repo today) |
| `data/categoria.ts` | None | Already has the Diversión personal categoria; no changes needed |

## Resolved Decisions

Answered by the user on 2026-07-16 — these supersede the "Open Questions" defaults below and are binding for spec/design:

1. **Missing active week**: show an empty state — the view informs the user no budget is configured for the current week and blocks expense registration until a `fondo_semanal` row exists. Creating next week's row from the UI is **not Phase 1** (fast-follow candidate, not committed).
2. **Spent calculation**: net — gasto movimientos **minus** any ingreso/reembolso movimientos registered under the Diversión personal categoria. Not gasto-only.
3. **Editing `monto_presupuestado`**: unrestricted — any positive numeric value, no validation against amount already spent.
4. **Progress indicator threshold**: no explicit decision requested from the user; proceeding with the conservative default — a plain spent/total bar, no 80-100% visual threshold state in Phase 1. Flag in design review if this default is wrong.
5. **`fondo_semanal` schema**: confirmed by the user directly (not by inspecting live Supabase) as `id, fecha_inicio, fecha_fin, monto_presupuestado, activo`. Still not verified against the live database schema (types/nullability/constraints) — design/apply should do a lightweight verification pass (e.g. a single `select *` or the Supabase dashboard) before finalizing the service layer, since a user's recollection of column types can be imprecise even when names are right.

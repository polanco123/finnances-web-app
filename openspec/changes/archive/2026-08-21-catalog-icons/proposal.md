# Proposal: Per-Item Icons for Cuentas and Categorías

## Why

Every `cuenta` and `categoria` row today carries only `nombre`/`tipo` — no visual identity. `CatalogItem`/`Cuenta`/`Categoria` (`lib/catalogs/catalog-store.ts`, `data/cuenta.ts`, `data/categoria.ts`) confirm zero icon-related field. Every render site (cards, movement rows, dropdowns) shows bare text names, making accounts/categories harder to scan at a glance. `lucide-react` is already this app's only icon library (`sidebar.tsx`, `deuda-payment-table.tsx`, `meta-card.tsx`) — no new dependency needed. There is also no edit UI at all for `cuenta`/`categoria` today (zero `updateCuenta`/`updateCategoria` hits); `cuentas-overview`'s own spec explicitly states the page "MUST NOT provide any UI for creating, editing, or deleting accounts" — this proposal narrowly overturns that constraint for icon assignment only.

## What Changes

- Add nullable `icono TEXT` to `cuenta` and `categoria` (new migration, RLS UPDATE policy + explicit `GRANT UPDATE` — `cuenta` currently only has `SELECT` granted per the TODO in `cuentas-service.ts`).
- Curated ~40-icon `lucide-react` allow-list, grouped by theme (comida, transporte, hogar, salud, entretenimiento, tarjetas/deuda, ingreso, ahorro, compras, genérico) — not the full ~1500-icon catalog, for searchability and to keep imports static/tree-shakeable (no dynamic string→component resolution).
- New `lib/catalogs/icon-catalog.ts`: `Record<string, LucideIcon>` built from the curated list, plus distinct fallback icons for `icono = null` — `Wallet` for `cuenta`, `Tag` for `categoria` (lets an unassigned row still read as "account" vs. "category" at a glance).
- Widen `CatalogItem`/`Cuenta`/`Categoria` types and Supabase `select`s to include `icono`, flowing through the existing `localStorage` sync path (`catalog-caching`).
- **Correction to prior assumption**: the type-widening touches 5 places, not 3 — `CatalogItem`, `data/cuenta.ts`'s `Cuenta`, `data/categoria.ts`'s `Categoria`, plus two locally-redeclared shapes: `components/cuentas/cuentas-service.ts`'s own `Cuenta` interface and `components/categorias/categorias-service.ts`'s `CategoriaConGasto`.
- New shared `IconPicker` popover/grid, wired into `cuentas-card.tsx` and `categorias-card.tsx` via an inline-toggle affordance mirroring `meta-card.tsx`'s existing "Editar" pattern — not a new edit page, not a general edit form (nombre/tipo/límites stay Supabase-managed).
- Render the resolved icon (or fallback) everywhere a name renders today: `movement-list-item.tsx`, `movement-transfer-card.tsx`, `autocomplete-input.tsx`, `deuda-payment-table.tsx`, `patrimonio-vencimientos.tsx`, `patrimonio-categorias.tsx`.

## Non-Goals

- No new icon library/dependency.
- No general edit form for `cuenta`/`categoria` beyond icon assignment.
- No automated tests — `npm run lint` + `npm run build` + manual browser testing.
- No `tipo`-level shared icons — strictly per-item.

## Capabilities

### New Capabilities
- `catalog-item-icons`: `icono` field, curated icon lookup map + fallback, `IconPicker` UI on `/cuentas` and `/categorias` cards.

### Modified Capabilities
- `catalog-caching`: cache shape (`localStorage` + Supabase `select`) widens to include `icono`.
- `cuentas-overview`: "Read-only page" requirement narrows to permit icon assignment only.
- `movement-display`: catalog resolution also resolves an icon alongside the name.

## Resolved Decisions

1. Curated ~40-icon allow-list (static imports), not full catalog.
2. `icono TEXT` + static `Record<string, LucideIcon>` lookup map — no dynamic import.
3. Distinct fallback icons when `icono` is null — `Wallet` for `cuenta`, `Tag` for `categoria` (confirmed with user; not a shared generic icon).
4. Inline picker on existing cards, no new pages.
5. One combined change; migration ships as two independent `ALTER TABLE` statements (separable rollback per table).

## Rollback Plan

Icon columns are additive/nullable — can stay unused if reverted. Revert render-site changes and drop `IconPicker`/`icon-catalog.ts`; revert `cuentas-overview` spec delta.

## Success Criteria

- [ ] User can assign/change an icon per account and per category from `/cuentas`/`/categorias`.
- [ ] Icon renders (or fallback) at every listed render site.
- [ ] `icono` persists via Supabase with working RLS + GRANT.
- [ ] `npm run lint` and `npm run build` pass.

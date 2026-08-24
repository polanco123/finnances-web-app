# Tasks: Per-Item Icons for Cuentas and Categorías

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750-950 (1 SQL migration ~25 [already written], `icon-catalog.ts` ~90 [static import block + 2 lookup tables + `resolveIcon`], `icon-picker.tsx`+`.css` ~180, 5-place type widening + 2 new service functions ~90 [small diffs across `catalog-store.ts`/`data/cuenta.ts`/`data/categoria.ts`/`cuentas-service.ts`/`categorias-service.ts`/`patrimonio-service.ts`], `autocomplete-input.tsx`+`movement-form.jsx` ~40, 7 render-site diffs ~5-15 lines each ≈ ~80 [`movement-list-item.tsx`, `movement-transfer-card.tsx`, `deuda-payment-table.tsx`, `patrimonio-vencimientos.tsx`, `patrimonio-categorias.tsx`], `cuentas-card.tsx`+`.css` ~90, `categorias-card.tsx`+`.css` ~90, `cuentas-overview` spec delta ~10 [already drafted]) |
| 400-line budget risk | Moderate as a single PR, but the shape is "many small surgical diffs across ~16 files" rather than a few large new files — file *count* risk (review fatigue from touching 16 files) outweighs raw line-count risk |
| Chained PRs recommended | Yes |
| Delivery strategy | **chained PRs**, stacked-to-main — recommended default, mirrors `deuda-payment-tracking` and `metas-ahorro`; confirm with user before first apply if not already decided |
| Chain strategy | **stacked-to-main** — each PR merges directly to main in dependency order |

Decision needed before apply: **Yes — not yet confirmed with the user.** No delivery-strategy decision has been recorded for this change yet. The forecast below assumes chained PRs by default.

Calibration: smaller in total lines than `metas-ahorro` (~1300-1500 lines, 6 brand-new component+CSS pairs for a net-new entity) and roughly comparable to or slightly below `deuda-payment-tracking` (~700-900 lines) — but this change creates only 2 new non-trivial files (`icon-catalog.ts`, `icon-picker.tsx`+`.css`) versus touching **9 existing render/service files** with small (~5-15 line) surgical diffs each. The review cost here is dominated by file-count/context-switching, not raw line volume — a single combined PR would ask a reviewer to hold ~16 files' worth of context, which is why chaining is still recommended despite the lower line estimate.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase A (migration, operator-applied) + Phase B (`icon-catalog.ts`) | PR 1 | ~115 lines. Foundation — compiles standalone; live column/grant depends on A.2's operator-applied migration |
| 2 | Phase C (5-place type widening + 2 new service functions) | PR 2 | ~90 lines. Depends only on the migration's column existing for live correctness; type shape itself needs no import from PR 1 |
| 3 | Phase D (`icon-picker.tsx`+`.css`) | PR 3 | ~180 lines. Depends on PR 1 (`ICON_GROUPS`/`ICON_CATALOG`) only — independent of PR 2, could run in parallel |
| 4 | Phase E1 (movement-related render sites: `movement-list-item.tsx`, `movement-transfer-card.tsx`, `autocomplete-input.tsx`, `movement-form.jsx`) | PR 4 | ~90 lines. Depends on PR 1 (`resolveIcon`) + PR 2 (`icono` on `CatalogItem`/`AutocompleteOption`) |
| 5 | Phase E2 (`cuentas-card.tsx`+`.css`, `categorias-card.tsx`+`.css` — wiring `IconPicker` + update handlers) | PR 5 | ~180 lines. Depends on PR 2 (service update functions) + PR 3 (`IconPicker`) |
| 6 | Phase E3 (`deuda-payment-table.tsx`, `patrimonio-vencimientos.tsx`, `patrimonio-categorias.tsx`) + Phase F (spec delta checkpoint) | PR 6 | ~80 lines. Depends on PR 1 (`resolveIcon`) + PR 2 (widened `patrimonio-service.ts` types/selects) |

## Phase A: Database Migration (`cuenta.icono`, `categoria.icono`)

- [x] A.1 Create `supabase/migrations/20260821090000_add_catalog_icons.sql` with the exact DDL from design.md's "Migration SQL" section verbatim — two independent `ALTER TABLE ... ADD COLUMN icono TEXT` statements (one per table), a new `cuenta_update_authenticated` UPDATE policy (`USING (true) WITH CHECK (true)`), a new `categoria_update_authenticated` UPDATE policy, and `GRANT UPDATE ON public.cuenta/categoria TO authenticated` for each table. Already created (orchestrator wrote it directly from design.md so the user could apply it immediately).
- [x] A.2 **Operator action, live Supabase**: user applied `20260821090000_add_catalog_icons.sql` against the live Supabase project (confirmed 2026-08-24).
- [x] A.3 **Operator/manual verify**: no "permission denied" or "policy already exists" errors — confirmed via the user's manual browser walkthrough (icon assignment on `/cuentas`/`/categorias` worked live against the migrated tables).

## Phase B: Icon Catalog (`icon-catalog.ts`)

- [x] B.1 Create `lib/catalogs/icon-catalog.ts` — static `import { ... } from 'lucide-react'` block for all 40 curated icon names exactly as listed in design.md's Interfaces/Contracts section (Comida, Transporte, Hogar, Salud, Entretenimiento, Tarjetas/Deuda, Ingreso, Ahorro, Compras, Genérico groups), plus `Wallet` and `Tag` imported separately as the two fallback-only icons (excluded from the selectable set).
- [x] B.2 In the same file, export `ICON_CATALOG: Record<string, LucideIcon>` (the 40 curated icons only, `Wallet`/`Tag` excluded) and `ICON_GROUPS: Record<string, (keyof typeof ICON_CATALOG)[]>` (the 10 theme-keyed groups, same names, same order as design.md's table).
- [x] B.3 In the same file, export `CUENTA_FALLBACK_ICON: LucideIcon = Wallet` and `CATEGORIA_FALLBACK_ICON: LucideIcon = Tag`.
- [x] B.4 In the same file, implement `resolveIcon(iconName: string | null | undefined, kind: 'cuenta' | 'categoria'): LucideIcon` exactly per design.md's Interfaces/Contracts code block — returns `ICON_CATALOG[iconName]` when `iconName` is truthy and present in `ICON_CATALOG`, else the kind's fallback. This is the single entry point every render site MUST call; no render site reimplements this branching inline.

## Phase C: Type Widening + Service Functions

- [x] C.1 Modify `lib/catalogs/catalog-store.ts` — widen `CatalogItem` with `icono: string | null`; widen `fetchCuentasFromSupabase()`'s `.select()` to `'id, nombre, tipo, icono'`; widen `fetchCategoriasFromSupabase()`'s `.select()` to `'id, nombre, tipo, es_diversion, icono'`. `syncCuentas`/`syncCategorias` need no separate change — both call these two functions internally.
- [x] C.2 Modify `data/cuenta.ts` — widen `Cuenta` interface with `icono: string | null`.
- [x] C.3 Modify `data/categoria.ts` — widen `Categoria` interface with `icono: string | null`.
- [x] C.4 Modify `components/cuentas/cuentas-service.ts` — widen the locally-redeclared `Cuenta` interface with `icono: string | null` (no query change needed — `fetchActiveCuentas()` already uses `select('*')`); add `updateCuentaIcono(id: string, icono: string): Promise<Cuenta>` exactly per design.md's Interfaces/Contracts code block (`UPDATE cuenta SET icono WHERE id`, `.select().single()`, throw on error).
- [x] C.5 Modify `components/categorias/categorias-service.ts` — widen `CategoriaConGasto` with `icono: string | null` (sourced from `CATEGORIAS.find(categoriaId)?.icono ?? null`); import `Categoria` from `@/data/categoria`; add `updateCategoriaIcono(id: string, icono: string): Promise<Categoria>` per design.md's code block.
- [x] C.6 Modify `components/patrimonio/patrimonio-service.ts` — widen `VencimientoCuenta` with `icono: string | null` and widen `fetchProximosVencimientos()`'s explicit `.select('id, nombre, dia_pago')` to `.select('id, nombre, dia_pago, icono')`; widen `CategoriaHeat` with `icono: string | null`, captured from the existing `CATEGORIAS.find((c) => c.id === categoriaId)` call in `fetchCategoriasDelMes()` (no new query).

## Phase D: Shared `IconPicker` Component

- [x] D.1 Create `components/ui/icon-picker.tsx` — `IconPickerProps { icono: string | null; kind: 'cuenta' | 'categoria'; onSelect: (iconName: string) => Promise<void> }` per design.md's Interfaces/Contracts code block. Renders `ICON_GROUPS` as labeled theme sections in a button grid; each button resolves its own icon via `ICON_CATALOG[name]`; the currently-selected `icono` gets a selected-state class; clicking selects and calls `onSelect(name)`. No internal `createClient()`/Supabase call, no internal `isSubmitting` state — stateless, callback-only, matching `meta-form.tsx`/`meta-abono-form.tsx`'s convention.
- [x] D.2 Create `components/ui/icon-picker.css` — `--icon-picker__btn--selected` (and related grid/section classes) using `--theme-*` tokens; dark-mode rules matching `cuentas-card.css`'s established pattern.

## Phase E1: Movement-Related Render Sites

- [x] E1.1 Modify `components/ui/autocomplete-input.tsx` — widen `AutocompleteOption` with `icono?: string | null`; add required `kind: 'cuenta' | 'categoria'` prop to `AutocompleteInputProps`; dropdown `<li>` renders `resolveIcon(option.icono, kind)` at 14px before `option.nombre`.
- [x] E1.2 Modify `components/movement/movement-form.jsx` — add `kind="cuenta"` / `kind="categoria"` to each of the 4 `<AutocompleteInput>` call sites (3× `kind="cuenta"`, 1× `kind="categoria"` per design.md). `options=` values (`CUENTAS`/`CATEGORIAS`) need no change — structurally compatible with the widened interface already.
- [x] E1.3 Modify `components/movement/movement-list-item.tsx` — resolve and render the cuenta and categoria icons alongside their respective name in the detail rows, via `resolveIcon`.
- [x] E1.4 Modify `components/movement/movement-transfer-card.tsx` — resolve and render both origen and destino accounts' icons independently, next to each account's name.

## Phase E2: Cuentas/Categorías Card Integration

- [x] E2.1 Modify `components/cuentas/cuentas-card.tsx` — render the resolved icon (via `resolveIcon(cuenta.icono, 'cuenta')`) in the card header; add an "Editar ícono" toggle in the expanded detail mirroring `meta-card.tsx`'s `editingX` boolean + `Pencil` button pattern, revealing `IconPicker` with `kind="cuenta"`; wire `onSelect` to a page-level handler (see E2.3).
- [x] E2.2 Modify `components/categorias/categorias-card.tsx` — same pattern as E2.1: render resolved icon (`resolveIcon(categoria.icono, 'categoria')`) in the header, "Editar ícono" toggle + `IconPicker` with `kind="categoria"` in expanded detail.
- [x] E2.3 In `app/(app)/cuentas/page.tsx` (or equivalent parent), wire the icon picker's `onSelect` to `updateCuentaIcono(id, iconName)`; on success, patch the returned row into local `cuentas[]` state in place — no refetch, matching `deuda-payment-tracking`/`metas-ahorro`'s established pattern.
- [x] E2.4 In `app/(app)/categorias/page.tsx` (or equivalent parent), wire the icon picker's `onSelect` to `updateCategoriaIcono(id, iconName)`; patch the returned row into local `categorias[]` state in place — no refetch.
- [x] E2.5 Modify `components/cuentas/cuentas-card.css` — icon-header layout, "Editar ícono" toggle button styling, `--theme-*` tokens, dark-mode rules.
- [x] E2.6 Modify `components/categorias/categorias-card.css` — same as E2.5 for the categoria card.

## Phase E3: Remaining Read-Only Render Sites

- [x] E3.1 Modify `components/deudas/deuda-payment-table.tsx` — render the resolved cuenta icon (via `resolveIcon`) before the nombre cell.
- [x] E3.2 Modify `components/patrimonio/patrimonio-vencimientos.tsx` — render the resolved cuenta icon before the nombre span, using the `icono` field now returned by `fetchProximosVencimientos()` (C.6).
- [x] E3.3 Modify `components/patrimonio/patrimonio-categorias.tsx` — render the resolved categoria icon before the nombre span, using the `icono` field now captured in `CategoriaHeat` (C.6).

## Phase F: Spec Delta Confirmation

- [x] F.1 Confirm `openspec/changes/2026-08-21-catalog-icons/specs/cuentas-overview/spec.md` merges cleanly into `openspec/specs/cuentas-overview/spec.md` at archive time — checkpoint only, no new work.
- [x] F.2 Confirm `openspec/changes/2026-08-21-catalog-icons/specs/catalog-caching/spec.md` merges cleanly into `openspec/specs/catalog-caching/spec.md` at archive time — checkpoint only.
- [x] F.3 Confirm `openspec/changes/2026-08-21-catalog-icons/specs/movement-display/spec.md` merges cleanly into `openspec/specs/movement-display/spec.md` at archive time — checkpoint only.
- [x] F.4 Confirm `openspec/changes/2026-08-21-catalog-icons/specs/catalog-item-icons/spec.md` is added as a new capability spec at `openspec/specs/catalog-item-icons/spec.md` at archive time — checkpoint only.

## Phase G: Manual Verification (no automated test runner in this project)

Mirrors design.md's Testing Strategy table. Verification is `npm run lint` + `npm run build` + the manual scenarios below.

- [x] G.1 `npm run lint` passes with zero new errors on all new/modified files (verified in `sdd-verify`, 18 pre-existing errors identical to baseline `main` via `git stash`).
- [x] G.2 `npm run build` passes with zero errors (verified in `sdd-verify`).
- [x] G.3 `/cuentas` → expand a card → "Editar ícono" → pick from grid — confirmed by user (2026-08-24): icon persists, propagates correctly.
- [x] G.4 `/categorias` → expand a card → "Editar ícono" → pick from grid — confirmed by user (2026-08-24).
- [ ] G.5 distinct `Wallet`/`Tag` fallbacks on unassigned rows — not individually itemized by the user; code path verified by `sdd-verify` (`resolveIcon`'s per-kind branching).
- [ ] G.6 icon propagates to `movement-list-item.tsx` — not individually itemized; user's confirmation was general ("propagation worked"), this specific site wasn't singled out.
- [ ] G.7 icon propagates to `movement-transfer-card.tsx` (both legs) — not individually itemized.
- [ ] G.8 icon propagates to `/deudas`'s `deuda-payment-table.tsx` — not individually itemized.
- [ ] G.9 icon propagates to `/reportes` — not individually itemized.
- [ ] G.10 autocomplete dropdown shows resolved icons — not individually itemized.
- [x] G.11 first live `updateCuentaIcono`/`updateCategoriaIcono` call — no permission error, confirmed by the user's successful live icon-assignment testing.
- [ ] G.12 dark/light theme toggle on `/cuentas`/`/categorias` — not individually itemized (note: `/cuentas` responds via the isolated `.cuentas-page` token system, not `--theme-*` as this task's original wording assumed — `/categorias` does use `--theme-*`).
- [ ] G.13 icon picker exposes no other editable field — not individually itemized live; confirmed by code inspection in `sdd-verify` instead.

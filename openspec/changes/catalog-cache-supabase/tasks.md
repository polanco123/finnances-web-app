# Tasks: Catalog Cache from Supabase

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single |
| Chain strategy | n/a |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

Estimate breakdown: `catalog-store.ts` (~80-100 new lines), `data/cuenta.ts` (~35 lines removed), `data/categoria.ts` (~55 lines removed), `lib/catalogs/cuentas.js` (~1 line changed), `lib/catalogs/categorias.js` (~1 line changed), `layout.tsx` (~20 new lines), `cuentas/page.tsx` (~40 new lines), `categorias/page.tsx` (~40 new lines). Total comfortably inside the 400-line single-PR budget.

## Phase 1: Catalog Store Module

- [x] 1.1 Create `lib/catalogs/catalog-store.ts`. Define the `CatalogItem` interface (`{ id: string; nombre: string; tipo: string; es_diversion?: boolean }`). Define localStorage keys as constants (`finanzas:catalog:cuentas`, `finanzas:catalog:categorias`). Define mutable `let` bindings for in-memory state: `_cuentas: CatalogItem[]`, `_categorias: CatalogItem[]`.
- [x] 1.2 Implement `loadFromStorage<T>(key: string): T[]` — reads from `localStorage`, parses JSON, returns empty array on error or missing key. Guard with `typeof window === 'undefined'` check for SSR safety.
- [x] 1.3 Implement `saveToStorage<T>(key: string, data: T[]): void` — serializes to JSON and writes to `localStorage`. Guard with `typeof window === 'undefined'` check.
- [x] 1.4 Implement `export async function initCatalogs(): Promise<void>` — loads from `localStorage` first; if either catalog is empty, fetches from Supabase via `createClient()` (imported from `@/lib/supabase/client`). Cuentas query: `.from('cuenta').select('id, nombre, tipo').eq('activa', true).order('nombre')`. Categorias query: `.from('categoria').select('id, nombre, tipo, es_diversion').eq('activa', true).order('nombre')`. On fetch success, save to `localStorage` and populate `_cuentas`/`_categorias`. On fetch error, log warning and leave catalogs empty (graceful degradation).
- [x] 1.5 Implement `export async function syncCuentas(): Promise<CatalogItem[]>` — fetches from Supabase (same query as init), saves to `localStorage`, updates `_cuentas`, returns the new array. Throws on error so caller can handle.
- [x] 1.6 Implement `export async function syncCategorias(): Promise<CatalogItem[]>` — same pattern as `syncCuentas` but for categories.
- [x] 1.7 Export mutable `let` bindings: `export let CUENTAS: CatalogItem[] = []`, `export let CATEGORIAS: CatalogItem[] = []`. After `initCatalogs()` populates `_cuentas`/`_categorias`, assign to these exports. Also export `CUENTA_DEFAULT` and `CATEGORIA_DEFAULT` as computed fallbacks (`_cuentas[0] ?? { id: '', nombre: 'Sin seleccionar', tipo: '' }`).
- [x] 1.8 Verify the module exports match what `lib/catalogs/cuentas.js` and `lib/catalogs/categorias.js` currently re-export: `CUENTAS`, `CUENTA_DEFAULT`, `CATEGORIAS`, `CATEGORIA_DEFAULT`, `GASTO_TIPOS`, `esCategoriaDeGasto`. Note: `GASTO_TIPOS` and `esCategoriaDeGasto` stay in `data/categoria.ts` (pure functions, no data dependency).

## Phase 2: Update Data Files

- [x] 2.1 Modify `data/cuenta.ts`: Remove the entire `raw` array (23 entries, lines 15-39). Keep the `Cuenta` interface. Change exports to re-export from `catalog-store`: `import { CUENTAS, CUENTA_DEFAULT } from '@/lib/catalogs/catalog-store'` and re-export them. This maintains backward compatibility for any file importing directly from `@/data/cuenta`.
- [x] 2.2 Modify `data/categoria.ts`: Remove the entire `raw` array (45 entries, lines 9-56). Keep the `Categoria` interface, `GASTO_TIPOS` constant, and `esCategoriaDeGasto()` function. Change `CATEGORIAS` and `CATEGORIA_DEFAULT` exports to re-export from `catalog-store`.
- [x] 2.3 Verify `lib/catalogs/cuentas.js` needs no change: it currently does `export { CUENTAS, CUENTA_DEFAULT } from '../../data/cuenta'`. Since `data/cuenta.ts` now re-exports from `catalog-store`, this chain resolves correctly. Confirm by reading the file.
- [x] 2.4 Verify `lib/catalogs/categorias.js` needs no change: same reasoning as 2.3. It re-exports from `data/categoria`, which now re-exports from `catalog-store`.

## Phase 3: App Init — CatalogInit Component

- [x] 3.1 Create `components/catalog-init.tsx` as a `'use client'` component. Import `initCatalogs` from `@/lib/catalogs/catalog-store`. In `useEffect(() => { initCatalogs() }, [])`, call the function. No render output — this is a side-effect-only component.
- [x] 3.2 Modify `app/(app)/layout.tsx`: Import and render `<CatalogInit />` inside the `<body>` tag (or inside the main layout wrapper). Position it before `{children}` so catalogs are initialized before any page content renders.
- [x] 3.3 Verify the component handles SSR: `initCatalogs()` must not run during SSR (server render). The `useEffect` wrapper ensures it only runs on client mount. Confirm `catalog-store.ts`'s `loadFromStorage`/`saveToStorage` functions have `typeof window === 'undefined'` guards.

## Phase 4: Sync Buttons on Pages

- [x] 4.1 Modify `app/(app)/cuentas/page.tsx`: Add `syncing` state (`useState(false)`). Add `handleSync` function that calls `syncCuentas()` from `catalog-store`, then `window.location.reload()`. Wrap in try/catch with error state. Add a "↻ Sincronizar" button in the page header area, disabled while `syncing`.
- [x] 4.2 Modify `app/(app)/cuentas/page.tsx`: Add empty-state banner. Before the account list, check `CUENTAS.length === 0`. If empty, render a banner: "Datos no sincronizados. Haz clic en Sincronizar para cargar las cuentas desde Supabase." with the sync button inline.
- [x] 4.3 Modify `app/(app)/categorias/page.tsx`: Same pattern as 4.1-4.2 — add `syncing` state, `handleSync` calling `syncCategorias()`, sync button, and empty-state banner checking `CATEGORIAS.length === 0`.
- [x] 4.4 Style the sync button: Use existing button classes from the project (e.g., `movement-form__button` pattern or page-specific button class). Ensure it matches the existing visual style. No new CSS file needed — inline or reuse existing classes.
- [x] 4.5 Style the empty-state banner: Use a simple `<div>` with existing alert/info styling patterns from the project. Keep it minimal — informational, not blocking.

## Phase 5: Verification

- [x] 5.1 Run `npm run lint` — zero errors in new/changed files.
- [x] 5.2 Run `npm run build` — zero errors, app compiles successfully.
- [x] 5.3 Manual: Clear `localStorage` for the app, reload. Confirm the app fetches catalogs from Supabase (check Network tab for `cuenta` and `categoria` queries). Confirm forms populate with account/category names after sync. — Confirmed by user in browser.
- [x] 5.4 Manual: Reload the app with populated `localStorage`. Confirm no Supabase fetch for catalogs (Network tab should not show `cuenta`/`categoria` queries). Confirm forms still work. — Confirmed by user in browser.
- [x] 5.5 Manual: Click "Sincronizar" on `/cuentas`. Confirm page reloads with fresh data. Repeat on `/categorias`. — Confirmed by user in browser.
- [x] 5.6 Manual: Verify `/movimientos` page still resolves account and category names correctly in movement list items. — Confirmed by user in browser.
- [x] 5.7 Manual: Verify no personal financial data (UUIDs, account names, amounts) remains in `data/cuenta.ts` or `data/categoria.ts` by reading the files. — Confirmed (also verified directly this session: both files contain only interfaces, empty re-exports, and pure `GASTO_TIPOS`/`esCategoriaDeGasto` — no hardcoded personal data).

**Post-apply fix (2026-08-02):** the initial apply pass introduced a regression — `/cuentas`' balance total and each `CuentaCard`'s displayed balance were changed from `saldo_real` to `saldo_calculado` (a different field), silently reverting an earlier, explicit decision from this same session to use `saldo_real` for consistency across the page. Fixed in `components/cuentas/cuentas-card.tsx`, `app/(app)/cuentas/page.tsx`, and `components/cuentas/cuentas-service.ts` (removed the now-unused `saldo_calculado` field from the local `Cuenta` interface). Rebuilt clean after the fix.

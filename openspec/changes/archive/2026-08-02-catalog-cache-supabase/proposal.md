## Why

The repository will be made public for GitHub Pages deployment. Currently, `data/cuenta.ts` contains 23 real bank accounts with UUIDs, account names ("Klar TDC", "Banamex TDC Oro", "Afore", etc.), and real financial amounts (`saldo_real`). `data/categoria.ts` contains 45 real spending categories with UUIDs. This personal financial data cannot be exposed in a public repository.

The solution: fetch catalog data (cuentas and categorías) from Supabase at runtime and cache in `localStorage`, removing all personal data from the codebase. The static data files become empty fallbacks, and the app fetches real data from the user's own Supabase instance.

## What Changes

- **New `lib/catalogs/catalog-store.ts`**: Central module managing catalog data with `localStorage` caching. Provides `initCatalogs()` (auto-fetch if cache empty), `getCuentas()`/`getCategorias()` (sync read from memory), `syncCuentas()`/`syncCategorias()` (forced refresh from Supabase).
- **`data/cuenta.ts`**: Remove all 23 hardcoded account entries. Export empty `CUENTAS` array and fallback `CUENTA_DEFAULT`. Keep `Cuenta` interface.
- **`data/categoria.ts`**: Remove all 45 hardcoded category entries. Export empty `CATEGORIAS` array and fallback `CATEGORIA_DEFAULT`. Keep `GASTO_TIPOS` and `esCategoriaDeGasto()` (pure functions, no data dependency).
- **`lib/catalogs/cuentas.js`**: Re-export from `catalog-store` instead of `data/cuenta`.
- **`lib/catalogs/categorias.js`**: Re-export from `catalog-store` instead of `data/categoria`.
- **`app/(app)/layout.tsx`**: Add `CatalogInit` component that calls `initCatalogs()` on mount.
- **`app/(app)/cuentas/page.tsx`**: Add "Sincronizar" button + empty-state banner.
- **`app/(app)/categorias/page.tsx`**: Add "Sincronizar" button + empty-state banner.

## Non-Goals

- **No migration or schema change.** The `cuenta` and `categoria` tables already exist in Supabase with the required columns (`id`, `nombre`, `tipo`, `activa`, `es_diversion`, etc.).
- **No authentication changes.** The existing Supabase client architecture (`createBrowserClient`) remains unchanged.
- **No offline-first architecture.** `localStorage` is a cache, not a source of truth. The app requires Supabase connectivity for the initial sync.
- **No changes to `/movimientos`, `/diversion`, or `/reportes` pages.** Those pages use catalog data indirectly via services; they will work once catalogs are synced.
- **No historical data migration.** Existing movements in Supabase already reference the correct `cuenta_id` and `categoria_id` UUIDs.

## Capabilities

### New Capabilities

- `catalog-caching`: Client-side catalog management with `localStorage` persistence, Supabase fetch, and manual sync.

### Modified Capabilities

None — this change replaces the data source for existing catalog consumers without changing their behavior.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `data/cuenta.ts` | Modified | Remove 23 hardcoded entries, export empty array |
| `data/categoria.ts` | Modified | Remove 45 hardcoded entries, export empty array |
| `lib/catalogs/catalog-store.ts` | Create | New catalog management module |
| `lib/catalogs/cuentas.js` | Modified | Re-export from `catalog-store` |
| `lib/catalogs/categorias.js` | Modified | Re-export from `catalog-store` |
| `app/(app)/layout.tsx` | Modified | Add `CatalogInit` component |
| `app/(app)/cuentas/page.tsx` | Modified | Add sync button + empty-state banner |
| `app/(app)/categorias/page.tsx` | Modified | Add sync button + empty-state banner |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| First-time user sees empty catalogs until sync | Expected | `initCatalogs()` auto-fetches on mount; banner informs user if manual sync needed |
| `localStorage` full or disabled | Low | Fallback to empty arrays; sync button still works; app degrades gracefully |
| Supabase fetch fails (network, auth) | Medium | Error displayed in banner; user can retry; existing movements still display (just without name resolution) |
| Catalog UUIDs change after sync (different Supabase project) | Low | User is responsible for matching Supabase projects; this is a self-hosted app |

## Rollback Plan

Revert the changes to `data/cuenta.ts` and `data/categoria.ts` (restore hardcoded entries), revert `lib/catalogs/cuentas.js` and `lib/catalogs/categorias.js` to import from `data/` files, remove `catalog-store.ts`, revert layout and page changes. No database cleanup required.

## Dependencies

None — uses existing `@supabase/ssr` client and browser `localStorage` API.

## Success Criteria

- [ ] No personal financial data (UUIDs, account names, amounts) exists in the committed codebase.
- [ ] App fetches catalogs from Supabase on first load and caches in `localStorage`.
- [ ] Subsequent page loads use cached data without network requests.
- [ ] "Sincronizar" button on `/cuentas` and `/categorias` refreshes catalog data from Supabase.
- [ ] Empty-state banner displays when catalogs are not synced.
- [ ] All existing consumers (`movement-form.jsx`, `movement-list-item.tsx`, etc.) work unchanged after sync.
- [ ] `npm run lint && npm run build` pass with zero errors.

# Design: Catalog Cache from Supabase

## Technical Approach

Replace the hardcoded static catalogs (`data/cuenta.ts`, `data/categoria.ts`) with a runtime-fetched, `localStorage`-cached catalog system. The core idea: a new `catalog-store.ts` module owns the catalog state (in-memory + `localStorage`), and all existing consumers (`movement-form.jsx`, `movement-list-item.tsx`, etc.) continue importing `CUENTAS`/`CATEGORIAS` from the same `lib/catalogs/` path — they just get data from a different source.

The catalog store uses a **write-through cache** pattern:
1. On app init, `initCatalogs()` checks `localStorage` for cached data.
2. If cache exists → load into in-memory variables → consumers work immediately.
3. If cache is empty → fetch from Supabase → write to `localStorage` → load into memory.
4. Manual sync (`syncCuentas()`/`syncCategorias()`) forces a Supabase fetch and updates both `localStorage` and in-memory state.

The in-memory variables (`CUENTAS`, `CATEGORIAS`) are exported as mutable `let` bindings. When sync updates them, all consumers that import these bindings see the new values on next access. This avoids changing the 12+ consumer files — they continue reading `CUENTAS` as a plain array.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Cache location | `localStorage` | `sessionStorage`, `IndexedDB`, in-memory only | `localStorage` persists across tabs and sessions; simpler API than `IndexedDB`; sufficient for small catalog data (~2KB). `sessionStorage` would re-fetch on every tab open. |
| Data structure in cache | JSON array of `{ id, nombre, tipo, ... }` | Separate keys per field, compressed format | Simple JSON is sufficient for ~45 categories + ~23 accounts. No performance concern at this scale. |
| In-memory state ownership | `catalog-store.ts` exports mutable `let` bindings | React Context, Zustand, Redux | Non-React code (`movement-mapper.js`) needs synchronous access. Mutable `let` exports are the simplest solution that works in both React and plain JS contexts. React Context only works in components. |
| Sync trigger | Manual button per page + auto-init | Auto-sync on every page load, SWR/refetch-on-focus | User explicitly requested manual sync buttons. Auto-fetch on every load would waste Supabase bandwidth. Auto-init only when cache is empty strikes the right balance. |
| Empty-state handling | Banner component in pages | Toast notification, modal, silent fallback | Banner is visible and persistent — the user needs to know data isn't loaded. Toast would disappear. Modal would block usage. |
| Fallback when catalogs empty | Empty arrays + "Sin seleccionar" default | Throw error, show full-page loading screen | Empty arrays let the app render (albeit non-functional for forms). Throwing would crash the app. Full-page loading would block unrelated pages. |
| `Cuenta`/`Categoria` type location | Keep in `data/cuenta.ts` and `data/categoria.ts` | Move to `catalog-store.ts` or a shared `types.ts` | Keeping types in the data files maintains the existing import pattern. Consumers already import from `@/data/categoria` for `GASTO_TIPOS`. |

## Data Flow

```
App mount (layout.tsx)
    │
    ▼
CatalogInit.useEffect()
    │
    ▼
initCatalogs()
    │
    ├──▶ localStorage.getItem('finanzas:catalog:cuentas')
    │         │
    │         ├── FOUND → JSON.parse → _cuentas = data
    │         │
    │         └── EMPTY → createClient()
    │                     .from('cuenta').select('id,nombre,tipo').eq('activa',true)
    │                     → localStorage.setItem(JSON.stringify(data))
    │                     → _cuentas = data
    │
    ├──▶ localStorage.getItem('finanzas:catalog:categorias')
    │         │
    │         ├── FOUND → JSON.parse → _categorias = data
    │         │
    │         └── EMPTY → createClient()
    │                     .from('categoria').select('id,nombre,tipo,es_diversion').eq('activa',true)
    │                     → localStorage.setItem(JSON.stringify(data))
    │                     → _categorias = data
    │
    ▼
export let CUENTAS = _cuentas   ← consumers read this
export let CATEGORIAS = _categorias
    │
    ▼
movement-form.jsx reads CUENTAS → populates dropdowns
movement-list-item.tsx reads CUENTAS → resolves account names
categorias-service.ts reads CATEGORIAS → filters/aggregates
    ...
```

```
User clicks "Sincronizar" button
    │
    ▼
syncCuentas() + syncCategorias()  [parallel]
    │
    ├──▶ createClient().from('cuenta').select(...)...
    │    createClient().from('categoria').select(...)...
    │
    ├──▶ localStorage.setItem('finanzas:catalog:cuentas', JSON.stringify(data))
    │    localStorage.setItem('finanzas:catalog:categorias', JSON.stringify(data))
    │
    ├──▶ _cuentas = data
    │    _categorias = data
    │
    ▼
window.location.reload()  ← simplest way to re-render all consumers
```

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `lib/catalogs/catalog-store.ts` | Create | Catalog management module: `initCatalogs()`, `getCuentas()`, `getCategorias()`, `syncCuentas()`, `syncCategorias()`, `getCuentaDefault()`, `getCategoriaDefault()`, exported `CUENTAS`/`CATEGORIAS`/`CUENTA_DEFAULT`/`CATEGORIA_DEFAULT` |
| `data/cuenta.ts` | Modified | Remove 23 hardcoded entries. Keep `Cuenta` interface. Export empty `CUENTAS` and fallback `CUENTA_DEFAULT`. |
| `data/categoria.ts` | Modified | Remove 45 hardcoded entries. Keep `Categoria` interface, `GASTO_TIPOS`, `esCategoriaDeGasto()`. Export empty `CATEGORIAS` and fallback `CATEGORIA_DEFAULT`. |
| `lib/catalogs/cuentas.js` | Modified | Re-export from `catalog-store` instead of `data/cuenta` |
| `lib/catalogs/categorias.js` | Modified | Re-export from `catalog-store` instead of `data/categoria` |
| `app/(app)/layout.tsx` | Modified | Add `CatalogInit` client component that calls `initCatalogs()` in `useEffect` |
| `app/(app)/cuentas/page.tsx` | Modified | Add sync button handler, empty-state banner, loading state |
| `app/(app)/categorias/page.tsx` | Modified | Add sync button handler, empty-state banner, loading state |

## Interfaces / Contracts

```ts
// lib/catalogs/catalog-store.ts

interface CatalogItem {
  id: string
  nombre: string
  tipo: string
  es_diversion?: boolean
}

// In-memory state (exported as mutable let bindings)
export let CUENTAS: CatalogItem[]
export let CATEGORIAS: CatalogItem[]
export let CUENTA_DEFAULT: CatalogItem
export let CATEGORIA_DEFAULT: CatalogItem

// Initialize catalogs: loads from localStorage, fetches from Supabase if empty
export async function initCatalogs(): Promise<void>

// Forced refresh: fetches from Supabase, updates localStorage + memory
export async function syncCuentas(): Promise<CatalogItem[]>
export async function syncCategorias(): Promise<CatalogItem[]>

// Sync reads (for non-React consumers)
export function getCuentas(): CatalogItem[]
export function getCategorias(): CatalogItem[]
```

### Supabase Queries

```ts
// Cuentas: active accounts, minimal fields for catalog resolution
supabase
  .from('cuenta')
  .select('id, nombre, tipo')
  .eq('activa', true)
  .order('nombre')

// Categorias: active categories, includes es_diversion for filtering
supabase
  .from('categoria')
  .select('id, nombre, tipo, es_diversion')
  .eq('activa', true)
  .order('nombre')
```

### localStorage Keys

| Key | Value | Size Estimate |
|-----|-------|---------------|
| `finanzas:catalog:cuentas` | JSON array of `{ id, nombre, tipo }` | ~2KB (23 items) |
| `finanzas:catalog:categorias` | JSON array of `{ id, nombre, tipo, es_diversion }` | ~3KB (45 items) |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual — first load | App fetches catalogs on first load | Clear `localStorage`, reload app, confirm data loads and forms work |
| Manual — cached load | App uses cache on subsequent loads | Reload app, confirm no Supabase fetch (check Network tab), forms still work |
| Manual — sync button | Sync refreshes data from Supabase | Click "Sincronizar", confirm page reloads with fresh data |
| Manual — empty state | Banner shows when catalogs empty | Clear `localStorage`, reload, confirm banner appears before data loads |
| Manual — form functionality | Forms work after sync | Create a movement, confirm it saves with correct `cuenta_id` and `categoria_id` |
| Manual — name resolution | Movement list resolves names | Load `/movimientos`, confirm account and category names display correctly |
| Lint/build | Zero errors | `npm run lint && npm run build` |

## Migration / Rollout

- **No Supabase schema change.** The `cuenta` and `categoria` tables already exist with the required columns.
- **Single-pass rollout.** Deploy catalog-store, update data files, update re-exports, add CatalogInit, add sync buttons — all in one commit series.
- **Breaking change for existing deployments.** After this change, the app requires a Supabase instance with `cuenta` and `categoria` tables. The hardcoded fallback data is removed. Users who haven't set up Supabase will see empty catalogs.
- **`localStorage` migration.** Users with existing `localStorage` data from other keys are unaffected. The new `finanzas:catalog:*` keys are fresh.

## Open Questions

None — all technical decisions are resolved above.

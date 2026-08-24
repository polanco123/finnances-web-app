# Design: Per-Item Icons for Cuentas and Categorías

## Technical Approach

Add a nullable `icono TEXT` column to `cuenta` and `categoria` via one migration with two independent `ALTER TABLE` statements (per the proposal's resolved decision #5). A new `lib/catalogs/icon-catalog.ts` holds a curated, statically-imported `Record<string, LucideIcon>` (~40 entries) plus a `resolveIcon(iconName, kind)` helper that every render site calls instead of reimplementing null-fallback branching — `Wallet` for `cuenta`, `Tag` for `categoria`. The existing `catalog-store.ts` → `data/cuenta.ts`/`data/categoria.ts` → `lib/catalogs/cuentas.js`/`categorias.js` re-export chain already flows into every render site that reads `CUENTAS`/`CATEGORIAS`, so widening `CatalogItem` with `icono` and the two Supabase `select()`s in `catalog-store.ts` is the single point that propagates the field everywhere that chain reaches (`movement-list-item.tsx`, `movement-transfer-card.tsx`, `autocomplete-input.tsx`'s consumers). Two render sites bypass that chain with their own direct Supabase queries (`cuentas-service.ts`'s `fetchActiveCuentas` uses `select('*')` — already covered once the column exists; `patrimonio-service.ts`'s `fetchProximosVencimientos` uses an explicit column list — needs its own widening) and are handled individually below. A new shared `IconPicker` (`components/ui/icon-picker.tsx`, alongside `autocomplete-input.tsx` as a cross-domain UI primitive) renders `ICON_GROUPS` as a themed grid and is wired into `cuentas-card.tsx`/`categorias-card.tsx` via an inline "Editar ícono" toggle mirroring `meta-card.tsx`'s established `editingX` boolean + `Pencil` button pattern — emitting via an `onSelect` callback, no direct Supabase calls inside the picker itself, matching the callback-only convention established by `meta-form.tsx`/`meta-abono-form.tsx`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Icon resolution entry point | Single `resolveIcon(iconName: string \| null, kind): LucideIcon` in `icon-catalog.ts`, called by every render site | Each render site does its own `ICON_CATALOG[name] ?? fallback` inline | 8 render sites independently reimplementing null/unknown-name fallback branching is exactly the kind of duplicated conditional this project avoids (`computeProgreso`, `esCategoriaDeGasto` are single-source pure helpers reused by call sites, not reimplemented). One function also means the `Wallet`/`Tag` distinction lives in exactly one place. |
| Curated list exposed to `IconPicker` | `ICON_GROUPS: Record<string, string[]>` (10 theme keys → 4 icon names each), same 40 names as `ICON_CATALOG`'s keys | A flat 40-item array, sectioned client-side by a separate lookup table | The proposal's grouping ("comida, transporte, hogar...") is a *display* concern for the picker grid, not a lookup concern for `resolveIcon`. Keeping both derived from the same literal list in the same file (not duplicated in the component) avoids the two ever drifting apart. |
| `IconPicker` filters by `kind`? | No — same 40-icon grid shown for both `cuenta` and `categoria` pickers; only the *fallback* differs by `kind` | Filter/hide theme groups contextually (e.g. hide "Ingreso" icons from `categoria` picker) | No real-world rule cleanly partitions themes by `kind` — a `categoria` for "tarjeta de crédito" gasto is a legitimate use of the tarjetas/deuda group, and a `cuenta` can legitimately want a "Salud" HSA-style icon. Arbitrary filtering would remove icons users might want with no clear benefit; `kind` only decides which single fallback icon renders when `icono` is null. |
| Icon persistence trigger | `IconPicker` calls `onSelect(iconName): Promise<void>` only — no `createClient()` inside the component itself | `IconPicker` calls `updateCuentaIcono`/`updateCategoriaIcono` directly | Matches this session's established form-component convention (`meta-form.tsx`, `meta-abono-form.tsx`): form-like components emit via callback, the parent page/card owns the Supabase call and local-state patch. `IconPicker` is generic (used by two different domains with two different service files) — a direct internal call would force it to know which service to import, defeating its shared-component purpose. |
| `VencimientoCuenta` icon source | Widen `fetchProximosVencimientos`'s explicit `.select('id, nombre, dia_pago')` to also select `icono`, widen the interface to match | Resolve icon in `patrimonio-vencimientos.tsx` via a second `CUENTAS.find(v.id)` lookup against the catalog store | This function already issues its own direct, explicit-column `cuenta` query (not routed through `catalog-store.ts`) — widening the same select is the smaller, more local diff and avoids introducing a new cross-module dependency (`patrimonio-vencimientos.tsx` importing the global `CUENTAS` catalog) into a component that has never needed it before. |
| `CategoriaHeat` icon source | Widen `fetchCategoriasDelMes`'s existing `CATEGORIAS.find((c) => c.id === categoriaId)` call (already performed to resolve `nombre`) to also capture `.icono`, no new query | A second `CATEGORIAS.find()` call in `patrimonio-categorias.tsx` | The lookup object is already in hand at the exact line that builds `nombre` — capturing `icono` from the same `find()` result costs nothing and avoids a second identical lookup in the render component. |
| `cuenta`/`categoria` UPDATE RLS+GRANT | Add one new `..._update_authenticated` policy + `GRANT UPDATE` per table; do NOT re-declare existing SELECT policies/grants | Recreate the full RLS policy set for both tables in this migration | Neither table's base schema (SELECT policy names, whatever else exists) is defined in any tracked migration — it predates this repo's migrations folder. Redeclaring unknown-named objects risks a live "already exists" error; only the net-new UPDATE capability is added, additive-only, matching the proposal's explicit framing that `cuenta` is missing exactly `UPDATE`. |

## Data Flow

```
CATALOG PROPAGATION (existing chain, widened, not restructured)
─────────────────────────────────────────────────────────────
catalog-store.ts  fetchCuentasFromSupabase()/fetchCategoriasFromSupabase()
  .select('id, nombre, tipo, icono')  /  .select('id, nombre, tipo, es_diversion, icono')
        │
        ▼  CatalogItem { id, nombre, tipo, es_diversion?, icono: string | null }
        │
        ├─▶ data/cuenta.ts (Cuenta += icono) ──▶ lib/catalogs/cuentas.js ──▶ movement-list-item.tsx
        │                                                                 └▶ movement-transfer-card.tsx
        │                                                                 └▶ autocomplete-input.tsx (via movement-form.jsx options=)
        └─▶ data/categoria.ts (Categoria += icono) ──▶ lib/catalogs/categorias.js ──▶ (same 3 sites, categoria leg)

DIRECT-QUERY SITES (bypass catalog-store, widened individually)
─────────────────────────────────────────────────────────────
cuentas-service.ts fetchActiveCuentas()  .select('*')            ──▶ cuentas-card.tsx, deuda-payment-table.tsx
                                                                       (via data/cuenta.ts's Cuenta, already widened)
patrimonio-service.ts fetchProximosVencimientos()
  .select('id, nombre, dia_pago, icono')                          ──▶ patrimonio-vencimientos.tsx
patrimonio-service.ts fetchCategoriasDelMes()
  CATEGORIAS.find(categoriaId) → capture .icono too                ──▶ patrimonio-categorias.tsx
categorias-service.ts fetchCategoriasConGasto()
  CATEGORIAS.find(categoriaId) → capture .icono too                ──▶ categorias-card.tsx

ICON ASSIGNMENT (write path)
─────────────────────────────────────────────────────────────
CuentaCard "Editar ícono" toggle ──▶ IconPicker(icono, kind='cuenta', onSelect)
                                       │
                                       ▼  onSelect(iconName)
                                     page.tsx handler ──▶ updateCuentaIcono(id, iconName)  cuentas-service.ts
                                       │                    UPDATE cuenta SET icono = :iconName WHERE id
                                       ▼
                                     setCuentas() patches the one row in place (no refetch, matches metas pattern)

CategoriaCard "Editar ícono" toggle ──▶ IconPicker(icono, kind='categoria', onSelect)
                                       ──▶ updateCategoriaIcono(id, iconName)  categorias-service.ts
                                       ──▶ setCategorias() patches the one row in place
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260821090000_add_catalog_icons.sql` | Create | `ALTER TABLE cuenta/categoria ADD COLUMN icono TEXT`, one new UPDATE policy + `GRANT UPDATE` per table |
| `lib/catalogs/icon-catalog.ts` | Create | `ICON_CATALOG`, `ICON_GROUPS`, `CUENTA_FALLBACK_ICON`, `CATEGORIA_FALLBACK_ICON`, `resolveIcon()` |
| `components/ui/icon-picker.tsx` + `.css` | Create | Themed icon grid popover, `onSelect(iconName): Promise<void>` callback, no internal Supabase call |
| `lib/catalogs/catalog-store.ts` | Modify | `CatalogItem += icono`; both `select()`s widened |
| `data/cuenta.ts` | Modify | `Cuenta += icono: string \| null` |
| `data/categoria.ts` | Modify | `Categoria += icono: string \| null` |
| `components/cuentas/cuentas-service.ts` | Modify | Local `Cuenta += icono`; new `updateCuentaIcono(id, icono)` |
| `components/categorias/categorias-service.ts` | Modify | `CategoriaConGasto += icono`; new `updateCategoriaIcono(id, icono)` (return type `Categoria` from `@/data/categoria`) |
| `components/patrimonio/patrimonio-service.ts` | Modify | `VencimientoCuenta += icono` (+ select widened); `CategoriaHeat += icono` (reuse existing `find()`) |
| `components/ui/autocomplete-input.tsx` | Modify | `AutocompleteOption += icono?: string \| null`; new `kind: 'cuenta' \| 'categoria'` prop; dropdown `<li>` renders resolved icon |
| `components/movement/movement-form.jsx` | Modify | 4 `<AutocompleteInput>` call sites gain `kind="cuenta"` / `kind="categoria"` |
| `components/movement/movement-list-item.tsx` | Modify | Resolve + render cuenta/categoria icons in the detail rows |
| `components/movement/movement-transfer-card.tsx` | Modify | Resolve + render both accounts' icons next to their names |
| `components/deudas/deuda-payment-table.tsx` | Modify | Render resolved cuenta icon before the nombre cell |
| `components/patrimonio/patrimonio-vencimientos.tsx` | Modify | Render resolved cuenta icon before the nombre span |
| `components/patrimonio/patrimonio-categorias.tsx` | Modify | Render resolved categoria icon before the nombre span |
| `components/cuentas/cuentas-card.tsx` + `.css` | Modify | Render icon in header; "Editar ícono" toggle + `IconPicker` in expanded detail |
| `components/categorias/categorias-card.tsx` + `.css` | Modify | Render icon in header; "Editar ícono" toggle + `IconPicker` in expanded detail |
| `openspec/specs/cuentas-overview/spec.md` | Modify (delta) | "Read-only page" requirement narrows: icon assignment permitted, no other mutation |

## Interfaces / Contracts

**Curated icon list** (`lib/catalogs/icon-catalog.ts`) — all 40 names verified present in `node_modules/lucide-react` (`^0.511.0`) as of this design:

| Group | Icons |
|---|---|
| Comida | `UtensilsCrossed`, `Coffee`, `Pizza`, `Beef` |
| Transporte | `Car`, `Bus`, `Plane`, `Fuel` |
| Hogar | `Home`, `Lightbulb`, `Wrench`, `Sofa` |
| Salud | `HeartPulse`, `Pill`, `Stethoscope`, `Dumbbell` |
| Entretenimiento | `Film`, `Music`, `Gamepad2`, `Tv` |
| Tarjetas / Deuda | `CreditCard`, `Landmark`, `Banknote`, `ReceiptText` |
| Ingreso | `Briefcase`, `TrendingUp`, `Coins`, `HandCoins` |
| Ahorro | `PiggyBank`, `Target`, `Vault`, `LineChart` |
| Compras | `ShoppingCart`, `ShoppingBag`, `Gift`, `Shirt` |
| Genérico | `Star`, `Bookmark`, `CircleDot`, `Sparkles` |

`Wallet` and `Tag` are deliberately **excluded** from the curated/selectable list — they're reserved as the two fallback icons so an unassigned row is never visually identical to a deliberately-chosen one.

```ts
// lib/catalogs/icon-catalog.ts
import type { LucideIcon } from 'lucide-react'
import {
  UtensilsCrossed, Coffee, Pizza, Beef,
  Car, Bus, Plane, Fuel,
  Home, Lightbulb, Wrench, Sofa,
  HeartPulse, Pill, Stethoscope, Dumbbell,
  Film, Music, Gamepad2, Tv,
  CreditCard, Landmark, Banknote, ReceiptText,
  Briefcase, TrendingUp, Coins, HandCoins,
  PiggyBank, Target, Vault, LineChart,
  ShoppingCart, ShoppingBag, Gift, Shirt,
  Star, Bookmark, CircleDot, Sparkles,
  Wallet, Tag,
} from 'lucide-react'

export const ICON_CATALOG: Record<string, LucideIcon> = {
  UtensilsCrossed, Coffee, Pizza, Beef,
  Car, Bus, Plane, Fuel,
  Home, Lightbulb, Wrench, Sofa,
  HeartPulse, Pill, Stethoscope, Dumbbell,
  Film, Music, Gamepad2, Tv,
  CreditCard, Landmark, Banknote, ReceiptText,
  Briefcase, TrendingUp, Coins, HandCoins,
  PiggyBank, Target, Vault, LineChart,
  ShoppingCart, ShoppingBag, Gift, Shirt,
  Star, Bookmark, CircleDot, Sparkles,
}

export const ICON_GROUPS: Record<string, (keyof typeof ICON_CATALOG)[]> = {
  Comida: ['UtensilsCrossed', 'Coffee', 'Pizza', 'Beef'],
  Transporte: ['Car', 'Bus', 'Plane', 'Fuel'],
  Hogar: ['Home', 'Lightbulb', 'Wrench', 'Sofa'],
  Salud: ['HeartPulse', 'Pill', 'Stethoscope', 'Dumbbell'],
  Entretenimiento: ['Film', 'Music', 'Gamepad2', 'Tv'],
  'Tarjetas / Deuda': ['CreditCard', 'Landmark', 'Banknote', 'ReceiptText'],
  Ingreso: ['Briefcase', 'TrendingUp', 'Coins', 'HandCoins'],
  Ahorro: ['PiggyBank', 'Target', 'Vault', 'LineChart'],
  Compras: ['ShoppingCart', 'ShoppingBag', 'Gift', 'Shirt'],
  Genérico: ['Star', 'Bookmark', 'CircleDot', 'Sparkles'],
}

export const CUENTA_FALLBACK_ICON: LucideIcon = Wallet
export const CATEGORIA_FALLBACK_ICON: LucideIcon = Tag

/** Every render site calls this instead of reimplementing null/unknown-name fallback logic. */
export function resolveIcon(iconName: string | null | undefined, kind: 'cuenta' | 'categoria'): LucideIcon {
  if (iconName && iconName in ICON_CATALOG) return ICON_CATALOG[iconName]
  return kind === 'cuenta' ? CUENTA_FALLBACK_ICON : CATEGORIA_FALLBACK_ICON
}
```

**5-place type widening** (exact one-line diffs):

```ts
// lib/catalogs/catalog-store.ts
export interface CatalogItem {
  id: string
  nombre: string
  tipo: string
  es_diversion?: boolean
  icono: string | null   // NEW
}
// fetchCuentasFromSupabase():   .select('id, nombre, tipo, icono')
// fetchCategoriasFromSupabase(): .select('id, nombre, tipo, es_diversion, icono')

// data/cuenta.ts
export interface Cuenta {
  // ...existing fields
  icono: string | null   // NEW
}

// data/categoria.ts
export interface Categoria {
  // ...existing fields
  icono: string | null   // NEW
}

// components/cuentas/cuentas-service.ts (own locally-redeclared Cuenta)
export interface Cuenta {
  // ...existing fields
  icono: string | null   // NEW — fetchActiveCuentas() already uses select('*'), no query change needed
}

// components/categorias/categorias-service.ts
export interface CategoriaConGasto {
  // ...existing fields
  icono: string | null   // NEW — sourced from CATEGORIAS.find(categoriaId)?.icono ?? null
}
```

`syncCuentas`/`syncCategorias` in `catalog-store.ts` call `fetchCuentasFromSupabase`/`fetchCategoriasFromSupabase` internally — both are covered by the same two `select()` widenings above, no separate change needed.

**New service functions:**

```ts
// components/cuentas/cuentas-service.ts
export async function updateCuentaIcono(id: string, icono: string): Promise<Cuenta> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cuenta')
    .update({ icono })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// components/categorias/categorias-service.ts
import type { Categoria } from '@/data/categoria'

export async function updateCategoriaIcono(id: string, icono: string): Promise<Categoria> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categoria')
    .update({ icono })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

No shared generic update function — `cuenta`/`categoria` are different tables with different callers/return types; a generic `updateIcono(table, id, icono)` would need an unsafe string-typed `table` param for zero real reuse benefit (only 2 call sites total).

**`IconPicker`** (`components/ui/icon-picker.tsx`):

```tsx
interface IconPickerProps {
  icono: string | null
  kind: 'cuenta' | 'categoria'
  onSelect: (iconName: string) => Promise<void>
}

export default function IconPicker({ icono, kind, onSelect }: IconPickerProps) {
  // renders ICON_GROUPS as labeled sections of a button grid; each button
  // resolves its own icon via ICON_CATALOG[name]; the currently-selected
  // `icono` gets an `--icon-picker__btn--selected` class; clicking an
  // unselected icon calls onSelect(name) and lets the parent's await drive
  // any loading/disabled state (no internal isSubmitting — kept stateless,
  // matching the callback-only convention)
}
```

**`AutocompleteOption`/`AutocompleteInput`** widening:

```ts
export interface AutocompleteOption {
  id: string
  nombre: string
  icono?: string | null   // NEW — optional since CatalogItem already satisfies this structurally
}

export interface AutocompleteInputProps {
  label: string
  options: AutocompleteOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  kind: 'cuenta' | 'categoria'   // NEW — required, selects resolveIcon's fallback
}
```

Dropdown `<li>` renders `resolveIcon(option.icono, kind)` at 14px before `option.nombre`. `movement-form.jsx` passes `CUENTAS`/`CATEGORIAS` directly as `options` today (no explicit mapping) — structurally compatible with the widened interface with zero change there; only the new `kind` prop needs adding at each of its 4 call sites (3× `kind="cuenta"`, 1× `kind="categoria"`).

**Migration SQL** (`supabase/migrations/20260821090000_add_catalog_icons.sql`):

```sql
-- `cuenta` currently has only SELECT granted (documented TODO in
-- cuentas-service.ts; no prior migration ever touched this table, so its
-- exact RLS policy names are unknown and are NOT redeclared here — only the
-- net-new UPDATE capability this feature requires is added).
ALTER TABLE cuenta ADD COLUMN icono TEXT;

CREATE POLICY cuenta_update_authenticated
  ON cuenta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE ON public.cuenta TO authenticated;

-- `categoria` is assumed SELECT-only under the same reasoning (never
-- verified in source, symmetrical treatment to cuenta). If categoria
-- already grants UPDATE, this GRANT is a safe redundant re-grant — the
-- metas-ahorro design's precedent applies: redundant GRANT costs nothing,
-- a missing one produces a live "permission denied" error.
ALTER TABLE categoria ADD COLUMN icono TEXT;

CREATE POLICY categoria_update_authenticated
  ON categoria FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE ON public.categoria TO authenticated;
```

## Testing Strategy

No automated tests (proposal non-goal). Manual verification via `npm run lint` + `npm run build` + browser walkthrough:

| Scenario | Steps | Expected |
|---|---|---|
| Assign icon to a cuenta | `/cuentas` → expand card → "Editar ícono" → pick from grid | Icon persists, card header updates immediately (no refetch) |
| Assign icon to a categoria | `/categorias` → expand card → "Editar ícono" → pick from grid | Same, `categoria` table |
| Unassigned rows show distinct fallbacks | Load `/cuentas` and `/categorias` with no icons assigned yet | `cuenta` cards show `Wallet`, `categoria` cards show `Tag` — visually distinguishable |
| Icon propagates to movement rows | Assign an icon, create a movement referencing that cuenta/categoria | `movement-list-item.tsx` shows the icon, not the fallback |
| Icon propagates to transfer card | Assign icons to both legs of a transfer | `movement-transfer-card.tsx` shows both icons |
| Icon propagates to `/deudas` | Assign icon to a `tipo='deuda'` cuenta | `deuda-payment-table.tsx` row shows the icon |
| Icon propagates to `/reportes` | Assign icons, check dashboard | `patrimonio-vencimientos.tsx` and `patrimonio-categorias.tsx` show resolved icons |
| Autocomplete dropdown | Open the movement form's cuenta/categoria pickers | Each option row shows its resolved icon |
| RLS/GRANT works live | First `updateCuentaIcono`/`updateCategoriaIcono` call after migration | No "permission denied for table" error |

## Migration / Rollout

Real schema migration — ordered deployment:
1. Apply `20260821090000_add_catalog_icons.sql` against live Supabase.
2. Ship code: `lib/catalogs/icon-catalog.ts`, `IconPicker`, all type-widening and render-site changes, in the same deploy (additive/nullable — safe even mid-rollout).

Day-1 state: every existing row has `icono = NULL`, renders its kind's fallback everywhere until manually assigned. No backfill.

## Open Questions

- [ ] **Apply-time verification required** (same pattern as every prior migration in this project): confirm live `categoria` RLS/grants match the SELECT-only assumption stated above before the migration runs — if `categoria` already has broader grants, the new `GRANT UPDATE`/`CREATE POLICY` statements are still safe (redundant grant, and the new policy only ever *adds* permission, never narrows).
- [ ] Confirm no existing UPDATE policy already named `cuenta_update_authenticated`/`categoria_update_authenticated` on the live schema (unverified from source, same limitation as the RLS question above) — if one exists, drop the duplicate `CREATE POLICY` line before applying.

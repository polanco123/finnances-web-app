## Why

The admin panel shell (archived in `2026-07-16-admin-panel-shell-redesign`) ships a sidebar with a "Cuentas" nav entry marked `comingSoon: true`, rendering a muted "Próximamente" badge and a 5-line `<ComingSoon title="Cuentas" />` stub at `app/(app)/cuentas/page.tsx`. The user wants Cuentas to be a real page: their actual bank/credit accounts with live balances and recent activity per account, so they can check account state without leaving the app or cross-referencing the bank directly.

## What Changes

- Replace the `app/(app)/cuentas/page.tsx` stub with a page that fetches the live `cuenta` table from Supabase (first-ever live query against this table — confirmed via repo-wide grep for `.from('cuenta')`, zero prior matches) and renders one card/section per account.
- Each account card shows `saldo_real` as the current balance, and its 5 most recent `movimiento` rows (`.eq('cuenta_id', id).order('fecha', { ascending: false }).limit(5)`), rendered via the existing `components/movement/movement-list-item.tsx` component unchanged.
- Flip the "Cuentas" sidebar entry in `components/app-shell/sidebar.tsx`'s `NAV_ITEMS` from `comingSoon: true` to a normal functional link (flag removed or set `false`), dropping the `sidebar__link--coming-soon` muted styling and the "Próximamente" badge.

## Non-Goals

- Editing, creating, or deleting accounts — this is a read-only overview page.
- Displaying `saldo_calculado` anywhere on this page — only `saldo_real` is shown.
- Reconstructing or displaying the paired account of a `transferencia` movimiento. `transferencia_id` is not populated by any current app code (confirmed: `crearMovimientoTransferencia()` sets `es_transferencia: true` on both legs but never sets the FK), so pairing data does not exist. Transfer rows show the existing "Transferencia" label via `movement-list-item.tsx`'s current `es_transferencia === true` special-case — nothing new is built for this.
- Pagination or a "view all movimientos" affordance beyond the 5 most recent per account.
- Any change to `data/cuenta.ts` / `lib/catalogs/cuentas.js`. These stay untouched and continue to serve as the static catalog for form dropdowns elsewhere in the app.
- Real-time/live-updating balances. A page load/refresh is sufficient; no websocket or polling requirement.

## Assumptions to Validate

- `cuenta` and `movimiento` have never been queried live from this codebase before this change. Column names (`id, nombre, tipo, saldo_calculado, saldo_real, frecuencia_revision, es_default, activa, limite_credito, dia_corte, dia_pago, created_at` for `cuenta`; `id, monto, descripcion, fecha, hora, cuenta_id, categoria_id, msi_id, transferencia_id, es_transferencia, es_ajuste, fuente, notas, created_at` for `movimiento`) are confirmed only via `docs/PROJECT_DOCUMENTATION.md`, not by inspecting the live schema. Treat as the query's `.select()` field-list basis, but verify against live Supabase if a query error surfaces during implementation.
- RLS/grants on `cuenta` are unverified, since no code has ever queried it live. If a permissions error surfaces during implementation, apply the same fix pattern already documented as a `TODO` in `components/diversion/diversion-service.ts` (a literal `GRANT SELECT, INSERT, UPDATE ON public.fondo_semanal TO authenticated;` comment) — issue the equivalent `GRANT SELECT ON public.cuenta TO authenticated;` (and `public.movimiento` if needed).

## Capabilities

### New Capabilities

- `cuentas-overview`: Read-only page listing all `activa = true` accounts from the live `cuenta` table, each showing its `saldo_real` balance and its 5 most recent `movimiento` rows (via the existing `movement-list-item.tsx` component), reachable from the sidebar's "Cuentas" link.

### Modified Capabilities

- `app-shell-navigation`: the "Placeholder navigation entries for future phases" requirement (`openspec/specs/app-shell-navigation/spec.md`) currently lists Cuentas as one of four non-functional placeholders. This change removes Cuentas from that requirement's scope — it becomes a functional link, following the same pattern already established for Dashboard, Movimientos, and Diversión in the "Functional sidebar navigation links" requirement.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/cuentas/page.tsx` | Modified | Replace `<ComingSoon>` stub with live-data page: fetch `cuenta` (`activa = true`) + per-account `movimiento` (top 5 by `fecha` desc), no user-scoping (neither table has `user_id`) |
| `app/(app)/cuentas/page.css` (or equivalent) | New | Styling for account cards; `.account-pill`/`.account-cards` in `app/(app)/page.css` is a visual reference only (100% mock data there, not a code-reuse target) |
| `components/app-shell/sidebar.tsx` | Modified | `NAV_ITEMS` Cuentas entry (currently line 27): remove/falsify `comingSoon` |
| `components/movement/movement-list-item.tsx` | None | Reused as-is for per-account movimiento rows; no changes |
| `data/cuenta.ts`, `lib/catalogs/cuentas.js` | None | Untouched; remain the static catalog used elsewhere for form dropdowns |

## Resolved Decisions

Answered by the user via a question round prior to this proposal — these are final commitments for spec/design, not open questions:

1. **Data source**: live `cuenta` table via Supabase, not the static `data/cuenta.ts`/`lib/catalogs/cuentas.js` catalog. The static catalog only has `id/nombre/tipo` and is a stale, hand-maintained subset used elsewhere for form dropdowns — insufficient for balances/activity.
2. **Balance field**: `saldo_real` is "current balance" for this page. `saldo_calculado` is a separate internally-derived figure and is never shown here.
3. **Account filter**: only `activa = true` accounts are listed, matching the static catalog's existing filter convention applied to the live query.
4. **Per-account activity**: 5 most recent `movimiento` rows per account, `fecha` descending, scoped by `cuenta_id`. Rendered via the existing `movement-list-item.tsx` unchanged, including its existing `es_transferencia` special-case ("Transferencia" label, no attempt to show the paired account — data doesn't support it).
5. **No user-scoping**: neither `cuenta` nor `movimiento` has a `user_id` column (unlike `fondo_semanal`); new queries against these two tables do not add `.eq('user_id', ...)`. This is single-user at the data-model level for these tables.
6. **Sidebar update**: the Cuentas `NAV_ITEMS` entry's `comingSoon` flag is removed/set `false`, making it a normal functional link with no muted styling or badge.

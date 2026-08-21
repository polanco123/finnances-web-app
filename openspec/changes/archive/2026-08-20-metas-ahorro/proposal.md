# Proposal: Metas de Ahorro (Savings Goals) — Phase 1

## Why

The app tracks accounts, movements, a weekly diversión budget, and now debt payments, but has no concept of a savings goal ("fondo de emergencia", "viaje", "regalo") — no way to declare a target amount and see progress toward it over time. Today that tracking happens outside the app (mentally or in a spreadsheet), with no history of individual contributions/withdrawals and no chart. This is Phase 1 (manual CRUD) of a two-phase idea; Phase 2 (auto-linking real `movimiento` rows to a goal) is explicitly deferred and only noted here as a future-compatible hook.

## What Changes

- New `/metas` route + panel: create/edit/delete savings goals, each with `nombre`, `monto_objetivo`, `monto_inicial` (may be non-zero at creation), optional `fecha_objetivo`.
- New Supabase table `meta` (mirrors the `deuda`/`deuda_pago` pattern): `id UUID PK`, `nombre TEXT NOT NULL`, `monto_objetivo DECIMAL(14,2) NOT NULL`, `monto_inicial DECIMAL(14,2) NOT NULL DEFAULT 0`, `fecha_objetivo DATE NULL`, `activa BOOLEAN NOT NULL DEFAULT TRUE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- New Supabase table `meta_abono` (dated contribution log): `id UUID PK`, `meta_id UUID NOT NULL REFERENCES meta(id)`, `monto DECIMAL(14,2) NOT NULL` (signed — positive = contribution, negative = withdrawal), `fecha DATE NOT NULL`, `nota TEXT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. User can add/edit/delete individual entries.
- Progress computed client-side, no Postgres RPC (matches `fetchCategoriasDelMes`/`fetchPagosDelAnio` convention): `monto_actual = monto_inicial + SUM(meta_abono.monto)`. Status derived from `monto_actual` vs `monto_objetivo` — no `estado` column needed.
- New progress chart: hand-rolled `<div>`-bar component restyled onto `--theme-*` tokens, adapted from `components/patrimonio/patrimonio-sparkline.tsx`/`.css`'s technique, plotting cumulative `monto_actual` over each `meta_abono.fecha`.
- Progress bar (current vs. objetivo) visually patterned after `components/diversion/diversion-progress.tsx`'s `--theme-*` styling only — NOT its weekly-reset semantics; a meta's progress is cumulative and never auto-resets.
- New sidebar entry ("Metas", `lucide-react` `Target` icon) inserted into `NAV_ITEMS` immediately after "Deudas" and before "Categorías" — groups with the other money-management CRUD pages (Cuentas, Deudas) rather than the analysis pages (Categorías, Reportes).

## Non-Goals

- No `movimiento`-to-`meta` linking (Phase 2). Only noted as a future hook: a nullable `meta_id UUID REFERENCES meta(id)` could later be added to `movimiento`, following the precedent already set by `movimiento.transferencia_id` (a nullable FK added after the fact, no rewrite). Not designed or scoped here.
- No auto-sync with any `cuenta.saldo_calculado`/`saldo_real` — goals are fully manual/independent; the user's goal money isn't isolated in one dedicated account in practice.
- No Recharts usage — rejected once already for this exact "progress over time" need in patrimonio's own archived design.md; would create visual/technical inconsistency with the rest of the app's hand-rolled charts.
- No automated test runner — verification is `npm run lint` + `npm run build` + manual browser testing, same as every prior change in this repo.

## Capabilities

### New Capabilities
- `metas-ahorro`: `/metas` panel — create/edit/delete goals (`nombre`, `monto_objetivo`, `monto_inicial`, optional `fecha_objetivo`), add/edit/delete dated `meta_abono` entries, computed progress (`monto_actual`, percentage, "cumplida" state), progress-over-time chart, archive (`activa=false`) instead of hard delete.

### Modified Capabilities
- `app-shell-navigation`: adds a new functional sidebar link ("Metas" → `/metas`), placed after "Deudas" and before "Categorías".

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `app/(app)/metas/page.tsx` | New | Fetches goals + abonos, composes panel |
| `components/metas/metas-service.ts` | New | Supabase calls: CRUD `meta`, CRUD `meta_abono`, client-side progress aggregation (plural folder name, matching `components/deudas/`) |
| `components/metas/*.tsx`, `*.css` | New | Goal card/list, create/edit forms, abono log editor, progress bar (reuses `diversion-progress.tsx` visual pattern, `--theme-*` tokens), chart component (reuses `patrimonio-sparkline.tsx` div-bar technique) |
| `components/app-shell/sidebar.tsx` | Modified | `NAV_ITEMS`: new "Metas" entry (`Target` icon) after "Deudas" |
| `openspec/specs/app-shell-navigation/spec.md` | Modified (delta) | Functional link count increases by one |
| Supabase new tables `meta`, `meta_abono` | New | 2 new migrations; RLS policies + explicit `authenticated` `GRANT` statements required in the same migration file — omitting the grant has caused live "permission denied" incidents in this project multiple times already |

## Resolved Decisions

Product decisions already final (per user, do not re-litigate):

1. **Progress model = dated `meta_abono` log, not a scalar field.** Each row is a signed `monto` + `fecha`; total progress = `monto_inicial + SUM(meta_abono.monto)`. Chosen over a single overwritable field for real history, a progress-over-time chart, error-correctability (edit/delete one entry without losing the rest), and because it's additive toward the out-of-scope Phase 2 instead of requiring a future data-model rewrite.
2. **No link to a real `cuenta`.** Fully manual/independent, no auto-sync from `saldo_calculado`.
3. **`monto_inicial` may be non-zero at creation.**
4. **Phase 1 = manual CRUD only** (goals + abonos); no `movimiento` integration.

Open questions resolved for this proposal:

5. **`fecha_objetivo`: optional, nullable.** Relevant for a goal like "viaje", meaningless for an open-ended "fondo de emergencia" — making it optional serves both without forcing a value. No enforcement of urgency/countdown logic in Phase 1; purely informational if set.
6. **Lifecycle: `activa BOOLEAN` soft-delete/archive, no hard delete, no forced state on 100%.** Mirrors the existing `cuenta.activa` convention (already reused by `deuda-payment-tracking`'s `tipo='deuda' AND activa=true` filter). Reaching or exceeding `monto_objetivo` does NOT auto-archive — an emergency fund goal should keep accepting contributions/withdrawals indefinitely; the UI marks it "cumplida" purely as a derived display state. The user archives (`activa=false`) manually when done; archived goals are excluded from the default `/metas` list, not deleted, preserving `meta_abono` history.
7. **Naming: singular DB tables (`meta`, `meta_abono`), plural component folder (`components/metas/`).** Matches this project's established `deuda`/`deuda_pago` (DB) vs. `components/deudas/` (folder) convention exactly — stated explicitly rather than left implicit.
8. **Navigation: `Target` icon (not `PiggyBank`), inserted after "Deudas" and before "Categorías".** `Target` reads unambiguously as "goal" versus `PiggyBank`'s more generic "savings" connotation; placement groups Metas with the other manual money-management CRUD pages (Cuentas, Deudas) ahead of the analysis-oriented pages (Categorías, Reportes), consistent with how Deudas itself was inserted relative to Cuentas.

## Rollback Plan

Remove the `/metas` route, the `components/metas/` folder, and the `sidebar.tsx` `NAV_ITEMS` addition. The `meta`/`meta_abono` tables can remain in the schema unused (additive, non-breaking) or be dropped via a follow-up migration — nothing else reads them, since Phase 1 has no dependency from any other page.

## Success Criteria

- [ ] `/metas` lists all active goals with computed progress (`monto_inicial + SUM(meta_abono.monto)`) against `monto_objetivo`.
- [ ] User can create a goal with a non-zero `monto_inicial` and an optional `fecha_objetivo`.
- [ ] User can add, edit, and delete individual `meta_abono` entries (including negative/withdrawal amounts) without losing other entries.
- [ ] Progress-over-time chart renders from the `meta_abono` history, styled with `--theme-*` tokens, no Recharts.
- [ ] Archiving a goal (`activa=false`) hides it from the default list but preserves its `meta_abono` history.
- [ ] Sidebar shows a functional "Metas" link (no "Próximamente" badge) between "Deudas" and "Categorías".

# Tasks: Metas de Ahorro (Savings Goals) — Phase 1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300-1500 (1 SQL migration ~40, `metas-service.ts` ~180 [9 functions + 3 interfaces], 6 new component+CSS pairs ~1170 [`meta-card` ~320, `metas-progress` ~140, `metas-progreso-chart` ~180, `meta-abono-form` ~160, `meta-form` ~170, and the page shell folded into Phase D below], `app/(app)/metas/page.tsx`+`.css` ~200, `sidebar.tsx` ~10, `specs/app-shell-navigation/spec.md` delta ~10 [already drafted]) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | **chained PRs**, stacked-to-main — recommended default; confirm with user before first apply if not already decided |
| Chain strategy | **stacked-to-main** — each PR merges directly to main in dependency order (mirrors `deuda-payment-tracking`'s PR 1-5 split) |

Decision needed before apply: **Yes — not yet confirmed with the user.** Unlike `deuda-payment-tracking` (where the user explicitly chose 5 chained PRs on 2026-08-06), no delivery-strategy decision has been recorded for this change yet. The forecast below assumes chained PRs by default since a single-PR delivery would be ~3x the informal 400-line comfortable-review budget.

Calibration against `deuda-payment-tracking`: that change shipped ~700-900 lines across 1 migration, a 7-function service, 4 UI files (2 component+CSS pairs), a page pair, a dashboard-widget diff, and a sidebar diff — and still needed 5 chained PRs. This change is larger: 9 service functions (vs. 7), and critically **6 new component+CSS pairs (12 files)** instead of 2 — a brand-new top-level entity with its own create form, its own dated-log CRUD form, a progress bar, and a chart, none of which `deuda-payment-tracking` needed since debt rows already existed as `cuenta` rows. Expect this to land above `deuda-payment-tracking`'s actual final size, closer to `add-dashboard-patrimonio`'s ~1050-1250 lines.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phase A (migration, operator-applied) + Phase B (`metas-service.ts`) | PR 1 | ~220 lines. Foundation — compiles standalone; live functionality depends on A.2's operator-applied migration |
| 2 | Phase C1: `metas-progress.tsx`/`.css` + `metas-progreso-chart.tsx`/`.css` | PR 2 | ~320 lines. Depends on PR 1's exported types (`MetaConProgreso`, `MetaAbono`) only — no dependency on the forms or the card, could ship independently of Unit 3 |
| 3 | Phase C2: `meta-form.tsx`/`.css` + `meta-abono-form.tsx`/`.css` | PR 3 | ~330 lines. Depends on PR 1's exported types + `crearMeta`/`updateMeta`/`crearAbono`/`updateAbono` signatures; independent of PR 2, could run in parallel |
| 4 | Phase C3: `meta-card.tsx`/`.css` | PR 4 | ~320 lines. Depends on PR 2 (`MetaProgressBar`, `MetaProgresoChart`) and PR 3 (`MetaAbonoForm`) — the accordion card composes all three |
| 5 | Phase D: `app/(app)/metas/page.tsx`/`.css` | PR 5 | ~200 lines. Depends on PR 1 (service) + PR 4 (`MetaCard`) |
| 6 | Phase E (`sidebar.tsx`) + Phase F (spec delta merge) | PR 6 | ~10 code lines + delta merge. Depends on PR 5 — the sidebar link would 404 if `/metas` doesn't exist yet |

## Phase A: Database Migration (`meta`, `meta_abono`)

- [x] A.1 Create `supabase/migrations/20260820120000_add_metas_ahorro.sql` with the exact DDL from design.md's "SQL migration" section verbatim: `CREATE TABLE meta` (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `nombre TEXT NOT NULL`, `monto_objetivo DECIMAL(14,2) NOT NULL`, `monto_inicial DECIMAL(14,2) NOT NULL DEFAULT 0`, `fecha_objetivo DATE`, `activa BOOLEAN NOT NULL DEFAULT TRUE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`); `CREATE TABLE meta_abono` (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `meta_id UUID NOT NULL REFERENCES meta(id)`, `monto DECIMAL(14,2) NOT NULL`, `fecha DATE NOT NULL`, `nota TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`); `CREATE INDEX idx_meta_abono_meta_fecha ON meta_abono (meta_id, fecha ASC)`. In the same file, add `ALTER TABLE meta ENABLE ROW LEVEL SECURITY` + 4 `authenticated` policies (`meta_select_authenticated`, `meta_insert_authenticated`, `meta_update_authenticated`, `meta_delete_authenticated`) and `ALTER TABLE meta_abono ENABLE ROW LEVEL SECURITY` + 4 matching policies for `meta_abono`, all verbatim per design.md. Do not paraphrase or reorder statements.
- [x] A.2 **Do not skip this** — in the same file, add `GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta, public.meta_abono TO authenticated;` as a single combined statement covering both tables. This project has hit live "permission denied for table ..." errors every time a migration omitted the explicit GRANT (`patrimonio_snapshot`, `deuda_pago`) — include it here from the start, not as a hotfix.
- [x] A.3 **Operator action, live Supabase**: user applied `20260820120000_add_metas_ahorro.sql` against the live Supabase project (confirmed 2026-08-20).
- [x] A.4 **Operator/manual verify**: no "permission denied" on live `crearMeta`/`crearAbono` — confirmed via the user's manual browser walkthrough (create/edit/archive goal, add/edit/delete abono all worked against the live tables).

## Phase B: Service Layer

- [x] B.1 Create `components/metas/metas-service.ts` importing `createClient` from `@/lib/supabase/client` locally inside each function (never module-level), matching `deudas-service.ts`/`cuentas-service.ts` convention.
- [x] B.2 Export `interface Meta { id: string; nombre: string; montoObjetivo: number; montoInicial: number; fechaObjetivo: string | null; activa: boolean; createdAt: string }`, `interface MetaAbono { id: string; metaId: string; monto: number; fecha: string; nota: string | null; createdAt: string }`, and `interface MetaConProgreso extends Meta { montoActual: number; porcentaje: number; cumplida: boolean }`.
- [x] B.3 Implement `fetchActiveMetas(): Promise<Meta[]>` — `SELECT * FROM meta WHERE activa=true ORDER BY nombre ASC`, map snake_case columns to camelCase, throw on error.
- [x] B.4 Implement `fetchAbonosPorMetas(metaIds: string[]): Promise<MetaAbono[]>` — `SELECT * FROM meta_abono WHERE meta_id IN (:metaIds) ORDER BY fecha ASC`, one bounded query for all goals' abonos.
- [x] B.5 Implement `computeProgreso(meta: Meta, abonos: MetaAbono[]): MetaConProgreso` — pure function, no Supabase call, per design.md's exact algorithm: `montoActual = meta.montoInicial + abonos.reduce((sum, a) => sum + a.monto, 0)`; `porcentaje = meta.montoObjetivo > 0 ? (montoActual / meta.montoObjetivo) * 100 : 0`; `cumplida = montoActual >= meta.montoObjetivo`. Caller MUST pre-filter `abonos` to this meta's id.
- [x] B.6 Implement `crearMeta(nombre: string, montoObjetivo: number, montoInicial: number, fechaObjetivo: string | null): Promise<Meta>` — INSERT into `meta`, `activa=true` by default.
- [x] B.7 Implement `updateMeta(id: string, updates: Partial<Pick<Meta, 'nombre' | 'montoObjetivo' | 'montoInicial' | 'fechaObjetivo'>>): Promise<Meta>`.
- [x] B.8 Implement `archivarMeta(id: string): Promise<Meta>` — `UPDATE meta SET activa = false WHERE id`, soft-delete only; no hard `DELETE` is ever issued on `meta`.
- [x] B.9 Implement `crearAbono(metaId: string, monto: number, fecha: string, nota: string | null): Promise<MetaAbono>`, `updateAbono(id: string, updates: Partial<Pick<MetaAbono, 'monto' | 'fecha' | 'nota'>>): Promise<MetaAbono>`, and `deleteAbono(id: string): Promise<void>` — `DELETE FROM meta_abono WHERE id`, the only hard delete in this domain per spec's "individually deleted" requirement.

## Phase C: UI Components

### Phase C1: Progress bar + chart (no dependency on forms/card)

- [x] C1.1 Create `components/metas/metas-progress.tsx` — `MetaProgressBarProps { montoActual: number; montoObjetivo: number; cumplida: boolean }`. Width per design.md: `widthPct = montoObjetivo > 0 ? Math.max(0, Math.min(100, (montoActual / montoObjetivo) * 100)) : 0`; label always shows the true `montoActual`/`porcentaje` (can be negative or >100%), never clamped in the label text.
- [x] C1.2 Create `components/metas/metas-progress.css` — `--theme-*` tokens; `.metas-progress__fill--cumplida` (`--theme-color-success`), default fill (`--theme-color-accent`), `.metas-progress__label--negative` (`--theme-color-error`); dark-mode rules matching `cuentas-card.css`/`diversion-progress.css` convention.
- [x] C1.3 Create `components/metas/metas-progreso-chart.tsx` — `MetaProgresoChartProps { montoInicial: number; abonos: MetaAbono[] }`. Per design.md's chart algorithm: sort `abonos` by `fecha` ascending internally (any input order accepted), accumulate `running = montoInicial + monto` per point, reuse `patrimonio-sparkline.tsx`'s min/max normalization + 6% floor + last-bar-highlight technique. 0 points → empty state; 1 point → single bar at 50% height (range=0 fallback).
- [x] C1.4 Create `components/metas/metas-progreso-chart.css` — `.metas-progreso-chart__bar`, `--theme-*` tokens (NOT the isolated `--ink`/`--up`/`--down` patrimonio palette — this page is a normal CRUD page, per design.md's explicit rejection).

### Phase C2: Forms (no dependency on progress bar/chart/card)

- [x] C2.1 Create `components/metas/meta-form.tsx` — create/edit form for a `meta` (`nombre`, `monto_objetivo`, `monto_inicial`, `fecha_objetivo`), styled on `diversion-budget-edit.tsx`'s edit-in-place numeric-input pattern (closest existing form-input precedent for a brand-new top-level entity). No `cuenta`/`movimiento` selector field anywhere in this form, per spec's Phase-1 non-goal requirement.
- [x] C2.2 Create `components/metas/meta-form.css` — `--theme-*` tokens, dark-mode rules.
- [x] C2.3 Create `components/metas/meta-abono-form.tsx` — inline add/edit form for a single `meta_abono` (`monto` — signed, `fecha` — required, `nota` — optional), same `diversion-budget-edit.tsx`-style input pattern. No `cuenta`/`movimiento` selector field, per spec's Phase-1 non-goal requirement.
- [x] C2.4 Create `components/metas/meta-abono-form.css` — `--theme-*` tokens, dark-mode rules.

### Phase C3: Accordion card (depends on C1 + C2)

- [x] C3.1 Create `components/metas/meta-card.tsx` — `MetaCardProps { meta: MetaConProgreso; abonos: MetaAbono[]; onUpdateMeta: (id: string, updates: Partial<Meta>) => Promise<void>; onArchivar: (id: string) => Promise<void>; onCrearAbono: (metaId: string, monto: number, fecha: string, nota: string | null) => Promise<void>; onUpdateAbono: (id: string, updates: Partial<MetaAbono>) => Promise<void>; onDeleteAbono: (id: string) => Promise<void> }`. `useState(expanded)` + `ChevronDown` pattern mirroring `cuentas-card.tsx`: collapsed shows `nombre` + `MetaProgressBar` + percentage; expanded reveals `MetaProgresoChart`, the abono log (list), and an inline `MetaAbonoForm` for adding a new entry. Each abono list row gets its own edit/delete affordance wired to `onUpdateAbono`/`onDeleteAbono`.
- [x] C3.2 Create `components/metas/meta-card.css` — `.meta-card__chevron--expanded` (BEM-ish, matching `cuenta-card__chevron--expanded`), `--theme-*` tokens, dark-mode rules matching `cuentas-card.css`.

## Phase D: Page Composition

- [x] D.1 Create `app/(app)/metas/page.tsx` — `'use client'`, `Suspense`-wrapped, fetch-on-mount sequential fetch mirroring `app/(app)/cuentas/page.tsx`'s shape: `fetchActiveMetas()` first, then `fetchAbonosPorMetas(metas.map(m => m.id))`; group abonos by `meta_id` (`Map`) and run `computeProgreso(meta, abonos)` per goal to build `MetaConProgreso[]`; render one `MetaCard` per goal; loading/error/empty states.
- [x] D.2 In `page.tsx`, add a "+ Nueva meta" toggle at the page top revealing `MetaForm` in create mode; wire its submit to `crearMeta(...)` and prepend the result to local `metas[]` state (no refetch).
- [x] D.3 In `page.tsx`, wire `MetaCard`'s callbacks: `onUpdateMeta` → `updateMeta(...)`, `onArchivar` → `archivarMeta(...)` (filters the goal out of local `metas[]` state), `onCrearAbono`/`onUpdateAbono`/`onDeleteAbono` → `crearAbono`/`updateAbono`/`deleteAbono`, patching local `abonos[]` state in place on success — no refetch of the full list per any of these actions.
- [x] D.4 Create `app/(app)/metas/page.css` — page layout using `--theme-*` tokens (this route is a normal app page, like `/cuentas` and `/deudas`, not `.patrimonio-page`-isolated), list spacing, empty-state styling.

## Phase E: Sidebar

- [x] E.1 Modify `components/app-shell/sidebar.tsx` — add `Target` to the `lucide-react` import list; insert `{ href: '/metas', label: 'Metas', icon: Target }` into `NAV_ITEMS` immediately after the `/deudas` entry and before the `/categorias` entry, per design.md's sidebar diff verbatim. Do not reorder any other existing entry.

## Phase F: Spec Delta Confirmation

- [ ] F.1 Confirm `openspec/changes/2026-08-20-metas-ahorro/specs/app-shell-navigation/spec.md` (already drafted in this change) merges cleanly into `openspec/specs/app-shell-navigation/spec.md` at archive time — no further authoring needed here, this task is a checkpoint, not new work.

## Phase G: Manual Verification (no automated test runner in this project)

Mirrors design.md's Testing Strategy table. Verification is `npm run lint` + `npm run build` + the manual scenarios below — this page uses `--theme-*` tokens (not the isolated `/reportes`/`/cuentas`-only palette), so verification confirms dark/light mode actually responds correctly via `next-themes`, mirroring `cuentas-card.css`'s existing behavior. No isolated-token grep check applies here.

- [x] G.1 `npm run lint` passes with zero errors on all new/modified files (verified in `sdd-verify`, and again against baseline `main` via `git stash` to confirm the 18 remaining errors are pre-existing/unrelated).
- [x] G.2 `npm run build` passes with zero errors (verified in `sdd-verify`; `/metas` listed as a static route).
- [ ] G.3 create a goal with `nombre="Viaje"`, non-zero `monto_inicial`, and a `fecha_objetivo` — not individually itemized; user confirmed goal creation works generally during manual walkthrough (2026-08-20), but this exact combination wasn't specifically isolated. Low-risk spot-check if ever revisited.
- [ ] G.4 create a goal without `fecha_objetivo` — not individually itemized, same as G.3.
- [ ] G.5 edit `monto_objetivo` preserves abono history — user confirmed "editar meta" works generally; abono-count-preserved wasn't explicitly re-counted.
- [ ] G.6 archive preserves `meta_abono` rows in DB (verify via Supabase Table Editor) — user confirmed the goal disappears from `/metas` on archive; did not separately confirm via Table Editor that the abono rows remain.
- [x] G.7 edit/delete one abono leaves others unaffected — confirmed during manual walkthrough (2026-08-20), including the delete-confirmation dialog added after review.
- [ ] G.8 negative abono lowers progress within positive range — user added a negative abono during the walkthrough and confirmed the total updated; the exact numeric example wasn't isolated.
- [ ] G.9 fully negative progress renders 0% width + red label — not individually itemized; code path verified by `sdd-verify` (`computeProgreso`/`MetaProgressBar` logic), not re-confirmed live with this exact scenario.
- [ ] G.10 cumplida doesn't block further abonos — not individually itemized live; code path verified by `sdd-verify`.
- [ ] G.11 chart plots out-of-order `fecha` entries correctly — not exercised live; `sdd-verify` confirmed the ascending-sort logic in code.
- [x] G.12 no `cuenta`/`movimiento` selector on either form — confirmed by inspection (`sdd-verify` grep) and implicit in the user's manual walkthrough of both forms.
- [x] G.13 dark/light theme toggle on `/metas` responds via `--theme-*` — confirmed during manual walkthrough (2026-08-20).
- [x] G.14 sidebar "Metas" link navigates correctly, positioned between "Deudas" and "Categorías", no "Próximamente" badge — confirmed during manual walkthrough (2026-08-20).

# Archive Report: catalog-icons

**Change ID**: 2026-08-21-catalog-icons
**Status**: ARCHIVED
**Date**: 2026-08-24
**Mode**: OpenSpec (filesystem merge + archive folder move)

## Overview

This change has been successfully implemented, verified, and archived. It introduces per-item visual identity for `cuenta` and `categoria` rows via a nullable `icono` field resolved against a curated `lucide-react` icon set, an inline `IconPicker` on the existing `/cuentas` and `/categorias` card views, and distinct fallback icons (`Wallet` / `Tag`) when `icono` is unset. The icon renders at every catalog display site across the app: cards, movement rows, transfer cards, the movement form's autocomplete, `deuda-payment-table.tsx`, and patrimonio's próximo-vencimiento and categorías-del-mes displays.

## Specs Synced

| Domain | Action | Changes |
|--------|--------|---------|
| `catalog-item-icons` | Created | 6 requirements + 12 scenarios defining the curated icon allow-list, first-time assignment, changing an assigned icon, distinct type fallbacks, no other editable field via the picker, and icon rendering at non-movement render sites |
| `catalog-caching` | Modified | "Catalog initialization on app mount" and "localStorage cache structure" requirements widened to include `icono` in both Supabase `select`s and the cached JSON shape; added a new round-trip scenario for `null` `icono` values |
| `cuentas-overview` | Modified | "Read-only page" requirement renamed to "Read-only page except icon assignment", narrowing the constraint to permit icon assignment as the sole mutation; added a new scenario confirming icon assignment doesn't expose other fields |
| `movement-display` | Modified (ADDED requirement) | New "Catalog icon resolution in movement rows" requirement with 3 scenarios covering icon rendering in `movement-list-item.tsx` and merged/unmerged `movement-transfer-card.tsx` |

**Files created in openspec/specs/**:
- `openspec/specs/catalog-item-icons/spec.md` — new, full spec (97 lines, 6 requirements, 12 scenarios)

**Files merged into openspec/specs/**:
- `openspec/specs/catalog-caching/spec.md` — existing file updated (2 requirement blocks widened, 1 new scenario added)
- `openspec/specs/cuentas-overview/spec.md` — existing file updated (1 requirement replaced with a narrower version + 1 new scenario)
- `openspec/specs/movement-display/spec.md` — existing file updated (1 new requirement + 3 scenarios appended)

## Artifacts Present

- proposal.md (defines scope, non-goals, capabilities, resolved decisions, rollback plan, success criteria)
- design.md (technical approach, migration DDL, curated icon list, type-widening plan, component design)
- specs/catalog-item-icons/spec.md (new spec, merged into main)
- specs/catalog-caching/spec.md (delta spec, merged into main)
- specs/cuentas-overview/spec.md (delta spec, merged into main)
- specs/movement-display/spec.md (delta spec, merged into main)
- tasks.md (all implementation tasks A–E checked; operator/manual and checkpoint tasks with credible completion evidence)
- verify-report.md (PASS WITH WARNINGS — 0 CRITICAL, only non-blocking hygiene/cosmetic notes)

## Implementation Summary

### Phase A: Database Migration
- `supabase/migrations/20260821090000_add_catalog_icons.sql` adds nullable `icono TEXT` to `cuenta` and `categoria`, with RLS UPDATE policies and explicit `GRANT UPDATE` for both tables
- Operator applied the migration to live Supabase and confirmed no permission errors on first icon assignment

### Phase B: Icon Catalog
- `lib/catalogs/icon-catalog.ts` — curated ~40-icon `Record<string, LucideIcon>` grouped by theme, plus distinct `Wallet`/`Tag` fallbacks, all statically imported (no dynamic string→component resolution)

### Phase C: Type Widening + Service Layer
- Widened `CatalogItem`, `data/cuenta.ts`'s `Cuenta`, `data/categoria.ts`'s `Categoria`, `components/cuentas/cuentas-service.ts`'s `Cuenta`, and `components/categorias/categorias-service.ts`'s `CategoriaConGasto` to include `icono` (actual scope: 7 interfaces + 1 value literal, one more than design.md's initial estimate)
- Added `updateCuentaIcono`/`updateCategoriaIcono` service functions following each host file's existing conventions

### Phase D: IconPicker
- New shared `components/ui/icon-picker.tsx` + `.css` — popover/grid picker restricted to the curated set, wired into `cuentas-card.tsx` and `categorias-card.tsx` via an inline-toggle affordance

### Phase E: Render Sites
- E1: `movement-list-item.tsx`, `movement-transfer-card.tsx`, `autocomplete-input.tsx` (5 real consumers, `diversion-form.tsx` fix included)
- E2: `cuentas-card.tsx`, `categorias-card.tsx` card integration
- E3: `deuda-payment-table.tsx`, `patrimonio-vencimientos.tsx`, `patrimonio-categorias.tsx`

### Phase F: Spec Delta Confirmation
- Confirmed all 4 spec deltas merge cleanly (no-op checkpoints, now executed as part of this archive)

### Phase G: Manual Verification
- `npm run lint` and `npm run build` both pass with zero new errors (18 pre-existing errors, identical to `main` baseline)
- User manually verified icon assignment/propagation across all render sites live in the browser

## Verification Status

**Build/Lint**: PASS
- Zero new lint errors introduced by this change
- TypeScript compilation successful; all 20 routes generated

**Spec Compliance**: PASS
- Curated-set constraint confirmed (picker only renders `ICON_GROUPS`)
- Distinct `Wallet`/`Tag` fallbacks confirmed excluded from the selectable catalog
- `cuentas-overview` confirmed to expose no UI for `nombre`/`tipo`/`limite_credito`/`dia_pago` editing
- `movement-display` icon resolution confirmed at both a list-card site and a compact-row site
- `catalog-caching` confirmed `icono` flows through `CatalogItem` and both Supabase selects

**Design Conformance**: PASS
- Migration SQL matches design.md's DDL exactly, including both `CREATE POLICY`/`GRANT UPDATE` statements
- `icon-catalog.ts`'s 40 curated names match design.md's list exactly

**Convention Conformance**: PASS
- No `user_id` column/filter anywhere in the migration or service functions
- Every Supabase-calling function uses a per-function local `createClient()`

## Hygiene Notes

Non-blocking items noted in verify-report:
1. `tasks.md` checkbox state was stale relative to actual completion evidence (A.2/A.3, F.1–F.4, several G items) — reconciled before archive.
2. `IconPicker`'s `--theme-*` styling renders inside `cuentas-card.tsx`'s isolated-palette accordion — a deliberate, already-accepted token-system mix for this shared cross-domain primitive. Purely cosmetic, non-blocking, no action required.

## Task Completion

| Phase | Status |
|-------|--------|
| A (migration DDL + RLS + GRANT + operator apply) | Done |
| B (icon-catalog.ts) | Done |
| C (type widening + service functions) | Done |
| D (IconPicker) | Done |
| E (render site integration) | Done |
| F (spec delta checkpoint) | Confirmed |
| G (lint/build + manual verification) | Done |

All implementation tasks verified complete. No blocking issues.

## Source of Truth Updated

The following specs now reflect the new behavior and serve as authoritative references:
- `openspec/specs/catalog-item-icons/spec.md` — defines all icon storage, curation, picker, and fallback behavior
- `openspec/specs/catalog-caching/spec.md` — updated to reflect `icono` in the cache shape and Supabase selects
- `openspec/specs/cuentas-overview/spec.md` — updated to reflect icon assignment as the sole permitted mutation
- `openspec/specs/movement-display/spec.md` — updated to reflect icon resolution in movement rows

The change folder has been moved to `openspec/changes/archive/2026-08-21-catalog-icons/` to mark the SDD cycle as complete.

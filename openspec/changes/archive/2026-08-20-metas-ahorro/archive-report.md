# Archive Report: metas-ahorro

**Change ID**: 2026-08-20-metas-ahorro  
**Status**: ARCHIVED  
**Date**: 2026-08-21  
**Mode**: OpenSpec (filesystem merge + archive folder move)

## Overview

This change has been successfully implemented, verified, and archived. It introduces Phase 1 of the savings goals feature (`/metas` panel), including CRUD operations on savings goals, dated contribution/withdrawal logs, progress tracking, and a progress-over-time chart.

## Specs Synced

| Domain | Action | Changes |
|--------|--------|---------|
| `metas-ahorro` | Created | 10 requirements + 24 scenarios defining goal creation, editing, archiving, abono CRUD, client-side progress computation, cumplida state, charting, and Phase 1 non-goals |
| `app-shell-navigation` | Modified | Updated "Functional sidebar navigation links" requirement from 5 links to 7 links (added Deudas and Metas); added 2 new scenarios for Deudas and Metas activation and positioning |

**Files created in openspec/specs/**:
- `openspec/specs/metas-ahorro/spec.md` — new, full spec (144 lines, 10 requirements)

**Files merged into openspec/specs/**:
- `openspec/specs/app-shell-navigation/spec.md` — existing file updated with new requirement text and scenarios

## Artifacts Present

- proposal.md (defines scope, non-goals, capabilities, rollback plan, success criteria)
- design.md (technical approach, architecture decisions, data flow, file changes, interfaces, SQL migration, testing strategy)
- specs/metas-ahorro/spec.md (new spec with 10 requirements)
- specs/app-shell-navigation/spec.md (delta spec, merged into main)
- tasks.md (all implementation tasks A–E checked; operator/manual tasks with completion evidence; one checkpoint task F.1)
- verify-report.md (PASS WITH WARNINGS — 0 CRITICAL, only non-blocking hygiene notes already fixed)

## Implementation Summary

### Phase A: Database Migration
- Created `supabase/migrations/20260820120000_add_metas_ahorro.sql` with `meta` and `meta_abono` tables, indexes, RLS policies, and explicit GRANT statements for authenticated users
- Operator applied migration to live Supabase (verified 2026-08-20)

### Phase B: Service Layer
- Created `components/metas/metas-service.ts` with 9 exported functions (fetchActiveMetas, fetchAbonosPorMetas, crearMeta, updateMeta, archivarMeta, crearAbono, updateAbono, deleteAbono, computeProgreso) and 3 interfaces (Meta, MetaAbono, MetaConProgreso)

### Phase C: UI Components
- `metas-progress.tsx` + `.css` — progress bar component with cumulative semantics and negative-value handling
- `metas-progreso-chart.tsx` + `.css` — per-abono cumulative bar chart (hand-rolled div bars, no Recharts)
- `meta-form.tsx` + `.css` — create/edit form for savings goals
- `meta-abono-form.tsx` + `.css` — inline add/edit form for dated contributions/withdrawals
- `meta-card.tsx` + `.css` — accordion card composing all components, mirrors cuentas-card.tsx pattern

### Phase D: Page Composition
- Created `app/(app)/metas/page.tsx` with fetch-on-mount sequential pattern, Suspense wrapper, and local state management
- Added "+ Nueva meta" toggle revealing create form; wired CRUD callbacks to service layer

### Phase E: Sidebar Navigation
- Modified `components/app-shell/sidebar.tsx` to add "Metas" entry (`Target` icon) immediately after "Deudas" and before "Categorías"

### Phase F: Spec Delta Confirmation
- Confirmed `app-shell-navigation/spec.md` delta merges cleanly (no further authoring needed)

### Phase G: Manual Verification
- `npm run lint` and `npm run build` both pass with zero new errors
- User manually verified create/edit/archive goal, add/edit/delete abono, dark/light theme toggle, and sidebar navigation during live walkthrough (2026-08-20)

## Verification Status

**Build/Lint**: PASS  
- Zero lint errors in any components/metas or app/(app)/metas file
- TypeScript compilation successful; `/metas` listed as static route in build output

**Spec Compliance**: PASS  
- All 10 requirement groups verified against actual code logic
- Migration SQL byte-for-byte identical to design.md specification
- Service interfaces match design.md Interfaces/Contracts section exactly
- All 7 scenarios for Deudas and Metas navigation added to app-shell-navigation spec

**Convention Conformance**: PASS  
- No user_id column in migration; no user_id filtering in service layer
- Every service function calls `createClient()` locally (never module-scope)
- Page uses app-wide `--theme-*` tokens (not isolated patrimonio palette)
- Sidebar correctly positioned per spec: Metas after Deudas, before Categorías

**Live Operation**: VERIFIED  
- User confirmed via live browser walkthrough that goal/abono CRUD works end-to-end (2026-08-20)
- No "permission denied" errors on first crearMeta or crearAbono calls (implies migration + RLS + GRANT are correct)

## Hygiene Notes

Two non-blocking hygiene items noted in verify-report and already resolved:
1. Tasks.md checkbox state was stale relative to actual completion evidence (A.3, A.4, G.1–G.14). Checkboxes reconciled before archive.
2. Stale TODO comment in metas-service.ts (now that live verification is complete). Comment removed before archive.

Both were fixed before this archive report was written.

## Task Completion

| Phase | Status |
|-------|--------|
| A (migration DDL + RLS + GRANT + operator apply) | ✓ Done |
| B (service layer) | ✓ Done |
| C (UI components) | ✓ Done |
| D (page composition) | ✓ Done |
| E (sidebar) | ✓ Done |
| F (spec delta checkpoint) | ✓ Confirmed |
| G (manual verification) | ✓ Done |

All implementation tasks verified complete. No blocking issues.

## Next Phase

This is Phase 1 (manual CRUD only). Phase 2 is scoped as future work and noted in proposal.md:
- Auto-linking real `movimiento` rows to a `meta` (skipped Phase 1)
- Planned as a future compatible hook with a nullable `meta_id` on `movimiento` table

No follow-up changes needed for the metas-ahorro domain at this time.

## Source of Truth Updated

The following specs now reflect the new behavior and serve as authoritative references:
- `openspec/specs/metas-ahorro/spec.md` — defines all metas-ahorro CRUD and charting capabilities
- `openspec/specs/app-shell-navigation/spec.md` — updated to reflect 7 functional sidebar links including Metas

The change folder has been moved to `openspec/changes/archive/2026-08-20-metas-ahorro/` to mark the SDD cycle as complete.

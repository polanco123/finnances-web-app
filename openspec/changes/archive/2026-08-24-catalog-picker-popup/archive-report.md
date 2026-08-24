# Archive Report: catalog-picker-popup

**Change ID**: 2026-08-24-catalog-picker-popup
**Status**: ARCHIVED
**Date**: 2026-08-24
**Mode**: OpenSpec, reduced pipeline (proposal → apply → archive only — `sdd-spec`/`sdd-design`/`sdd-tasks` explicitly skipped per user request)

## Overview

Replaces `AutocompleteInput`'s inline, type-to-filter dropdown with a full popup picker (`CatalogPickerPopup`) for selecting a cuenta/categoria — tap-to-select icon grid instead of typing, faster and more intuitive especially on mobile. Public prop contract of `AutocompleteInput` (`label`, `options`, `value`, `onChange`, `placeholder?`, `kind`) is unchanged, so all 5 real consumers (`movement-form.jsx` ×4, `diversion-form.tsx` ×1) required zero code changes.

Because the pipeline skipped spec/design/tasks, `proposal.md` itself was written at design-doc depth (component contracts, exact state machine, exact Browser History API sequence) and carries an appended "## Implementation Notes" section serving as this change's complete implementation and verification record — there is no separate `design.md`, `tasks.md`, spec deltas, or `verify-report.md`, and that is correct for this change, not a gap.

## Capabilities

None — per the proposal's own "Capabilities" section, this change touches only `components/ui/` and has no corresponding entry in `openspec/specs/`. No spec merge was needed or performed.

## Artifacts Present

- `proposal.md` — scope, non-goals, resolved decisions (component split, History API sequence, cancel semantics, mobile/desktop behavior), rollback plan, success criteria, plus appended Implementation Notes covering the initial apply and two user-requested post-apply refinements.

## Implementation Summary

**Files created:**
- `components/ui/catalog-picker-popup.tsx` — the popup: icon grid, desktop search box, all History API back-button integration (single exit point via `popstate`, `requestClose()` routing X/backdrop/Escape/select through `history.back()`).
- `components/ui/catalog-picker-popup.css` — mobile 90vh/90vw overlay, desktop centered 520px/640px modal, reusing `deuda-marcar-pagado-modal.css`'s fade/scale-in convention and `icon-picker.css`'s tile-grid convention (own scoped class names, no cross-component coupling).

**Files modified:**
- `components/ui/autocomplete-input.tsx` — internals rewritten (readonly field opens the popup on focus instead of an inline dropdown); exported types/props unchanged.
- `components/ui/autocomplete-input.css` — removed dead dropdown-list rules.

**Post-apply refinements (user-tested, both applied and verified):**
1. Mobile single-column list layout (`@media (max-width: 767px)` override: `grid-template-columns: auto`, tiles switch to a horizontal icon+label row) instead of the multi-column grid.
2. Desktop search input receives autofocus on popup mount (`.focus()` in a mount-only effect) — a no-op on mobile since the input is `display: none` there and hidden elements aren't focusable, so no breakpoint branching was needed in JS.

## Verification Status

**Build/Lint**: PASS — `npm run lint`/`npm run build` clean after every change (initial apply + both refinements), zero new errors.

**Design conformance**: PASS — History API sequence, mobile/desktop breakpoint mechanism (CSS-only, no JS media-query hook, matching this project's existing precedent), and component split all match the proposal exactly, confirmed by inline code review.

**Manual verification**: user tested directly — popup open/close via X, backdrop, Escape, and the device back button; mobile list styling; desktop search box and autofocus. Confirmed working.

## Task Completion

No `tasks.md` exists for this change (reduced pipeline). Equivalent phase summary:

| Phase | Status |
|-------|--------|
| Proposal (design-doc depth) | Done |
| Apply (single pass) | Done |
| Post-apply refinements (2, user-requested) | Done |
| Manual verification | Done, confirmed by user |

No blocking issues at any point.

## Source of Truth Updated

No `openspec/specs/` files were touched — this change has no persistent spec footprint by design.

The change folder has been moved to `openspec/changes/archive/2026-08-24-catalog-picker-popup/` to mark the cycle as complete.

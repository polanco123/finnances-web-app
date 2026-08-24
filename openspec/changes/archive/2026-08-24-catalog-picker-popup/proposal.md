# Proposal: Catalog Picker Popup (replace inline autocomplete dropdown)

> **Reduced pipeline note (explicit user request)**: this change skips `sdd-spec`/`sdd-design`/`sdd-tasks`. The path is proposal → apply → archive. Because there is no separate `design.md`, the "What Changes" section below is written at design-doc depth (component contracts, exact state machine, exact Browser History API sequence) so an apply agent can implement directly from this file with no further design work. This intentionally exceeds this repo's normal ~450-word proposal budget — that budget assumes a following design phase, which does not exist this cycle.

## Why

Registering a movement (or a diversión expense) today means typing into `AutocompleteInput` (`components/ui/autocomplete-input.tsx`) to filter a small anchored dropdown — slow and unintuitive on mobile, and it doesn't showcase the per-item icons now available via `resolveIcon` (from the archived `catalog-icons` change). The user wants tap-to-select instead of type-to-filter: focus opens a full popup of the option list as an icon grid. This is purely a picking-UX change — no data model, no options-source change.

## What Changes

### Component split (public contract unchanged)

`AutocompleteInput`'s exported prop contract stays exactly `{ label, options: AutocompleteOption[], value: string, onChange: (id: string) => void, placeholder?, kind: 'cuenta' | 'categoria' }`. Only its internals change — **zero code changes** at any of the 5 call sites (`movement-form.jsx` ×4, `diversion-form.tsx` ×1, confirmed via grep, count unchanged from the brief).

- `components/ui/autocomplete-input.tsx` (**modified**): drop the typing-filter/keyboard-nav internals (`inputValue`, `filtered`, `highlightIndex`, `handleKeyDown`, `handleClickOutside` — backdrop-click supersedes click-outside). New internal state: `pickerOpen: boolean`. The field becomes `readOnly` (prevents the mobile OS keyboard from popping up on tap — there is nothing to type anymore) and its displayed text is `selectedOption?.nombre ?? ''` normally, forced to `''` while `pickerOpen` is true (the "value visually clears on focus" requirement — the popup itself covers the field on mobile, but on desktop the field remains visible behind the backdrop, so this matters there). `onFocus` → `setPickerOpen(true)`. Renders `<CatalogPickerPopup>` only while `pickerOpen`.
- `components/ui/catalog-picker-popup.tsx` (**new**): the overlay itself — backdrop, header (label + X), desktop-only search input, icon grid, empty state, and all History API logic (below). Props: `{ options: AutocompleteOption[], value: string, kind: 'cuenta' | 'categoria', label: string, onSelect: (id: string) => void, onClose: () => void }`.
- `components/ui/catalog-picker-popup.css` (**new**): styling, following `deuda-marcar-pagado-modal.css`'s modal conventions (backdrop blur, fade/scale-in keyframes, `--theme-*` tokens, dark-mode overrides) and `icon-picker.css`'s tile-grid conventions, adapted for this component's own class names (no shared/renamed classes, to avoid cross-component CSS coupling).
- `components/ui/autocomplete-input.css` (**modified**): delete the now-dead `.autocomplete-input__list`/`__item*` dropdown rules; keep `.autocomplete-input` wrapper, add a `cursor: pointer` affordance on the now-`readOnly` field.
- `components/movement/movement-form.jsx`, `components/diversion/diversion-form.tsx`: **no changes**.

### Browser History integration — exact sequence (new ground, no prior precedent in this repo)

Single exit point, single source of truth: **only the `popstate` listener ever flips `pickerOpen` to `false`.** The X button, the backdrop, and option selection never call `onClose()` directly — they all call `history.back()`, which triggers `popstate`, which then calls `onClose()`. This guarantees exactly one `pushState` and exactly one consuming `back()` per open/close cycle, so a later real back-button press never silently consumes an orphaned entry.

```
// CatalogPickerPopup — runs once per mount (only mounted while pickerOpen === true)
useEffect(() => {
  history.pushState({ catalogPicker: true }, '')       // 1. reserve a history slot for this popup

  function handlePopState() {
    onClose()                                           // 3. the ONLY place pickerOpen becomes false
  }
  window.addEventListener('popstate', handlePopState)
  return () => window.removeEventListener('popstate', handlePopState)
}, [])

function requestClose() {
  history.back()                                        // 2. never call onClose() here directly
}                                                        //    — always route through popstate (step 3)

onXClick        = () => requestClose()
onBackdropClick = () => requestClose()
onOptionClick   = (id) => { onSelect(id); requestClose() }  // select-then-close, no separate confirm step
```

Flows:
- **Open**: input `onFocus` → `pickerOpen = true` → popup mounts → `pushState`.
- **Close via X / backdrop / select**: `requestClose()` → `history.back()` → browser fires `popstate` → `handlePopState` → `onClose()` → `pickerOpen = false` → popup unmounts (listener cleaned up).
- **Close via device back button / gesture**: browser fires `popstate` natively (no `history.back()` call needed, the browser already performed the navigation) → same `handlePopState` → same result. No divergent code path.
- **Cancel semantics**: closing without a tap never calls `onSelect`/`onChange` — the parent's `cuentaId`/`categoriaId` state was never mutated, so the field's restored display text is simply whatever it already was. No explicit "revert" logic exists or is needed.

Known limitation (accepted, not mitigated this cycle): if the popup unmounts through a path other than this sequence (e.g., the host page unmounts entirely from client-side navigation while the popup is open), the pushed history entry isn't popped, leaving one stale entry. Low risk — the popup already blocks all page interaction via the backdrop, so this requires deliberately navigating away (e.g., browser tab close) while it's open.

### Mobile vs. desktop

- **Breakpoint**: reuse `movement-form.css`'s existing `@media (max-width: 767px)` — pure CSS, matching this project's only responsive-layout precedent. Confirmed via grep: zero `matchMedia`/`innerWidth`/`useMediaQuery` usage anywhere in this codebase — a JS breakpoint hook would be new machinery this project has never needed, so it's rejected in favor of CSS.
- **Search input structural difference**: rendered unconditionally in the DOM, hidden via `display: none` under the mobile breakpoint. `display: none` elements are natively excluded from the tab order and accessibility tree per spec, so no extra `tabIndex`/`aria-hidden` handling is required to keep it non-interactive on mobile — this resolves the "structural vs. style" concern without new JS. On mobile the filtering `searchTerm` state simply never receives input (nothing can type into a hidden field), so the grid always shows the full option list there.
- **Mobile popup**: 90vh / 90vw, centered overlay (not edge-to-edge), rounded corners, no search box visible — pure tap grid.
- **Desktop popup**: centered fixed modal, `max-width: 520px`, `max-height: 640px` with internal scroll on the grid region only (header + search stay fixed). 520px comfortably fits ~4 columns of ~100px tiles with padding — wider than `deuda-marcar-pagado-modal.css`'s 380px (a single-field confirm dialog) since this popup hosts a grid, not one input.
- Both breakpoints reuse `deuda-marcar-pagado-modal.css`'s fade + scale-in keyframes (renamed/scoped to this component), `role="dialog"` `aria-modal="true"`, and Escape-to-close.

### Grid content

Flat grid (no theme-grouping — these are the user's actual cuentas/categorías, not curated icon names), `grid-template-columns: repeat(auto-fill, minmax(88px, 1fr))`. Each tile: `resolveIcon(option.icono, kind)` icon (~24-28px) + `option.nombre` label, selected tile gets `icon-picker__btn--selected`-style border/color per existing convention. Filtered by `searchTerm` (desktop only) against `nombre`, case-insensitive substring — same matching logic the old dropdown used. Empty states: "No hay {cuentas|categorías} disponibles" (zero options) or "Sin resultados para “{searchTerm}”" (search yields nothing).

## Non-Goals

- No changes to `movement-form.jsx`'s submit logic or any other page's own picker-like UI (`IconPicker` itself, `meta-card.tsx`'s inline pattern) beyond the 2 `AutocompleteInput` consumers.
- No changes to what options are available — same `options` arrays, same data source, only presentation/selection mechanics change.
- No new automated tests — verification stays `npm run lint` + `npm run build` + manual browser testing (desktop + mobile viewport), same as every prior change here.
- No slide-from-bottom sheet animation — reuses the existing fade/scale-in pattern for both breakpoints, to stay scoped.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — no live `openspec/specs/` capability files exist in this repo (specs stay embedded per archived change folder, none promoted to a persistent tree); this proposal intentionally skips spec/design/tasks per explicit user request.

## Resolved Decisions

1. Component split: `AutocompleteInput` keeps its exact public contract; all popup logic (including History API) lives in a new `CatalogPickerPopup`.
2. History API: single exit point via `history.back()` → `popstate` → `onClose()`; device back button and in-app close buttons converge on the same listener, never two code paths.
3. Cancel = no `onChange` call, nothing more — parent state (and therefore displayed value) is simply never mutated.
4. Mobile: 90vh/90vw, no search box (structurally hidden via CSS, not conditional render). Desktop: centered 520px/640px modal with search box.
5. Breakpoint via CSS media query (`max-width: 767px`, matching `movement-form.css`), not a JS hook — no precedent for JS media-query logic exists in this codebase.
6. Field becomes `readOnly` to suppress the mobile virtual keyboard, since typing is no longer part of the interaction model.

## Rollback Plan

Revert `autocomplete-input.tsx`/`.css` to their pre-change versions and delete `catalog-picker-popup.tsx`/`.css`. No data model, no Supabase, no call-site changes involved — fully self-contained to `components/ui/`.

## Success Criteria

- [ ] Focusing any of the 5 `AutocompleteInput` fields opens a full popup icon grid instead of the old inline dropdown; field visually clears while open.
- [ ] Mobile popup: 90vh/90vw, no search box, tap selects and closes immediately.
- [ ] Desktop popup: centered ~520px modal with a working search/filter box.
- [ ] X button, backdrop click, and device/browser back button all close the popup correctly, and a subsequent back-button press after any of the first two never "silently" consumes a stale history entry.
- [ ] Closing without selecting leaves the field's prior value untouched.
- [ ] `movement-form.jsx` and `diversion-form.tsx` require zero code changes.
- [ ] `npm run lint` and `npm run build` pass.

## Implementation Notes

**Files created:**
- `components/ui/catalog-picker-popup.tsx`
- `components/ui/catalog-picker-popup.css`

**Files modified:**
- `components/ui/autocomplete-input.tsx` (full rewrite of internals; exported `AutocompleteOption`/`AutocompleteInputProps` unchanged)
- `components/ui/autocomplete-input.css` (removed dead `.autocomplete-input__list`/`__item*` rules; kept wrapper; added `cursor: pointer` on the input)

**Verification:**
- Pre-implementation check confirmed the proposal's "zero call-site changes" claim: `movement-form.jsx` (4 call sites) and `diversion-form.tsx` (1 call site) both pass `{ label, options, value, onChange, kind, placeholder? }` exactly matching `AutocompleteInputProps` — **no changes needed to either file**, as predicted.
- `npm run lint`: zero errors/warnings in any new or modified file (one initial `Unused eslint-disable directive` warning on `catalog-picker-popup.tsx`'s Escape-key effect was fixed by removing the unneeded disable comment; all other lint errors/warnings reported by the run are pre-existing and unrelated to this change, e.g. `.opencode/skills/**/*.cjs` `require()` errors, `app/(app)/page.tsx` unused `formatDate`, `tailwind.config.ts` `require()`, `sidebar.tsx` `<img>` warning).
- `npm run build`: succeeded (Next.js 16.2.10, Turbopack) after `rm -rf .next dist` before and after.
- No deviations from the proposal's design: History API sequence, mobile/desktop breakpoints, empty-state copy, and grid/tile styling were all implemented exactly as specified. Class names in `catalog-picker-popup.css` are fully scoped to this component (`.catalog-picker__*`), not shared/imported from `deuda-marcar-pagado-modal.css` or `icon-picker.css`, per the proposal's explicit no-cross-component-coupling requirement — only the visual conventions (fade/scale-in keyframes, `--theme-*` tokens, dark-mode overrides, grid `minmax(88px, 1fr)`) were reused.
- No live-browser verification was performed by the implementing agent (auth-gated pages, no browser access from that context) — the user tested manually and requested two follow-up refinements, both applied directly and verified with `npm run lint`/`npm run build` after each:
  1. **Mobile list layout**: user found via inspector that a single-column list (not the multi-column grid) reads better on narrow screens. Added a `@media (max-width: 767px)` override in `catalog-picker-popup.css`: `.catalog-picker__grid { grid-template-columns: auto; }` and `.catalog-picker__tile { flex-direction: row; justify-content: flex-start; padding: var(--theme-spacing-2) var(--theme-spacing-5); }` — icon + label render in a horizontal row per item instead of a stacked tile. Desktop grid layout unchanged.
  2. **Desktop search autofocus**: the search input now receives focus automatically when the popup mounts (`searchInputRef.current?.focus()` in a mount-only `useEffect` in `catalog-picker-popup.tsx`), so desktop users can start typing immediately. No conditional/breakpoint logic needed — `.focus()` on a `display: none` element (the search input on mobile) is a spec-guaranteed no-op, so the same code path safely does nothing on mobile.
- Final state: 6/6 success criteria implemented in code; the user has manually exercised the popup (open/close via multiple paths, mobile list styling, desktop search+autofocus) and confirmed it works as intended.

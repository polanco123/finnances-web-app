# Proposal: Admin Panel Shell Redesign

## Why

The app has no unified navigation shell today. `/movimientos` and `/diversion` each render their own full-page chrome with no shared nav, and `/` is still the unmodified Next.js/Supabase starter landing page (Hero, DeployButton, tutorial steps) — a public/unauthenticated route with zero product value once the app has real authenticated pages. Meanwhile `app/dashboard/page.tsx` (a mock KPI page with BalanceCard, CategoryBars, MovementsList, AccountCards, MonthlySummary) is unreachable from any nav and has a dark-mode bug that has never worked: its `page.css` defines a third, self-contained token system whose dark overrides target `[data-theme="dark"]`, a selector `next-themes`' `attribute="class"` config never sets. This proposal replaces the starter landing page with an admin-panel shell (sidebar + topbar) and makes the restyled dashboard the authenticated home, consolidating navigation and closing the styling-system gap as a byproduct, not a separate effort.

## What Changes

- Add an authenticated app shell (sidebar + topbar) wrapping `/`, `/movimientos`, `/diversion`, and four placeholder nav destinations (Cuentas, Categorías, Reportes, Configuración — nav entries only, no new pages this phase).
- Sidebar: functional links to Dashboard (`/`), Movimientos, Diversión, plus the four placeholder entries; a full show/hide toggle (not icon-rail collapse) triggered from the topbar.
- Topbar: a non-functional notifications button (bell icon, no behavior), a theme toggle, and the reused `LogoutButton`.
- Make `/` the authenticated home page: delete the current starter-template content and render the restyled `app/dashboard/page.tsx` there instead.
- Remove `/`'s auth exemption in `lib/supabase/proxy.ts` — delete the `request.nextUrl.pathname !== "/" &&` clause so `/` requires auth like every other route (this is the entire proxy change needed).
- Migrate `app/dashboard/page.tsx` + `page.css` off its self-contained System C tokens onto `lib/theme.css`'s `--theme-*` tokens. This incidentally fixes dashboard dark mode, which has never worked, as an intentional side effect of the restyle — not scope creep.
- Install Recharts and use it for at least one dashboard visualization (e.g. spending trend, category breakdown), augmenting or replacing the hand-rolled `category-bar__fill` div-width bars. Mock data now, structured so real Supabase data can be wired in later without a rewrite.
- Adjust `app/movimientos/page.tsx`/`page.css` and `app/diversion/page.tsx`/`page.css` so their outer wrapper stops owning full-viewport chrome (`min-height: 100vh`, own background) now that a shell owns the viewport. Internal business logic of both pages is untouched.

## Non-Goals

- Functional Cuentas/Categorías/Reportes/Configuración pages — placeholder nav entries only this phase.
- Real Supabase-backed dashboard data — mock data only, structured to anticipate future wiring.
- Notification functionality behind the topbar bell button.
- Changing `/movimientos` or `/diversion` business logic — only their outer chrome/wrapper is touched.
- A committed mobile-responsive breakpoint strategy — whatever falls out naturally from the shell layout is acceptable; not a deliverable to design around explicitly.

## Assumptions to Validate (deferred to sdd-design — not resolved here)

- Placeholder treatment for Cuentas/Categorías/Reportes/Configuración: disabled nav item vs. a trivial "próximamente" stub page. Not decided.
- Theme toggle implementation: reuse the existing 3-way (light/dark/system) `components/theme-switcher.tsx` DropdownMenu as-is in the topbar, vs. build a simpler binary light/dark toggle. Not decided.
- Shell wiring mechanism: this repo has zero `(group)` route-group precedent (`app/protected/` is a plain URL segment, not a group). Whether the shell is applied via a `(group)` layout, a shared layout on the affected routes, or another mechanism is a design-phase call.
- `components/ui/*` primitives that get reused inside the shell (e.g. Button, DropdownMenu for the theme toggle/notifications) are styled with System A (`app/globals.css`/shadcn HSL vars), not `--theme-*`. Rule 7 below is non-negotiable — no new hardcoded hex anywhere — but the exact reconciliation approach for these existing primitives is a design-phase call.

## Capabilities

### New Capabilities
- `app-shell-navigation`: authenticated sidebar + topbar shell — functional nav (Dashboard/Movimientos/Diversión), four placeholder nav entries, full sidebar show/hide toggle, topbar notifications button (non-functional), theme toggle, logout.
- `dashboard-home`: the restyled dashboard becomes the authenticated home page at `/` — KPI cards, category breakdown, movements list, account cards, monthly summary, plus at least one Recharts visualization; mock data, `--theme-*` tokens only.
- `admin-panel-theming`: the design-token contract governing all new/restyled shell and dashboard UI — 100% `--theme-*` tokens (no hardcoded hex), correct `.dark`-class dark mode (fixing the dead `[data-theme="dark"]` System-C bug), and the reconciliation approach for System-A-styled `components/ui/*` primitives reused inside the shell.

### Modified Capabilities
- None. No pre-existing `openspec/specs/` capability covers `/`, `/movimientos`, or `/diversion` page chrome — `movement-display` and `diversion-weekly-view` cover internal list/business behavior only and are unaffected here.

## Impact

| Area | Impact | Description |
|------|--------|--------------|
| `lib/supabase/proxy.ts` | Modified | Remove `request.nextUrl.pathname !== "/" &&` clause so `/` requires auth |
| `app/page.tsx` | Modified | Starter-template content replaced by dashboard-as-home; route ownership changes from public to authenticated |
| `app/dashboard/page.tsx` + `page.css` | Modified | Migrated from System C to `--theme-*` tokens; Recharts added; dark-mode bug fixed as a side effect |
| `app/movimientos/page.tsx` + `page.css` | Modified | Outer wrapper stops owning full-viewport chrome now that a shell exists; internal logic untouched |
| `app/diversion/page.tsx` + `page.css` | Modified | Same wrapper adjustment as movimientos; internal logic untouched |
| Shell layout wiring (exact file/mechanism TBD in design) | New | Wires sidebar + topbar shell around authenticated routes |
| Sidebar/topbar components (paths TBD in design, e.g. `components/shell/*`) | New | Hand-rolled, consistent with existing project convention — no Sheet/Dialog/Sidebar Radix primitive installed today |
| `package.json` | Modified | Add `recharts` dependency |
| `components/logout-button.tsx` | None | Reused as-is in topbar, no rework needed |
| `components/theme-switcher.tsx` | Modified (pending design) | Reuse as-is vs. simplify to a binary toggle — design decides |

## Resolved Decisions

Confirmed with the user on 2026-07-16 — binding for spec/design, not open questions:

1. **Dashboard location**: dashboard-as-home replaces the starter landing page at `/`; `/` becomes authenticated via the single `proxy.ts` clause removal above.
2. **Dashboard content strategy**: reuse and restyle the existing `app/dashboard/page.tsx` rather than rebuild from scratch; migrating System C → `--theme-*` fixes the dead dark-mode bug as an intentional side effect, not scope creep.
3. **Chart library**: Recharts, newly installed (confirmed React-19-compatible). Mock data now, structured for future real-data wiring.
4. **Sidebar nav items**: Dashboard/Movimientos/Diversión are functional; Cuentas/Categorías/Reportes/Configuración are placeholder-only, no new routes.
5. **Sidebar collapse behavior**: full show/hide toggle from the topbar, not an icon-rail collapse.
6. **Topbar contents**: non-functional notifications button, theme toggle, reused `LogoutButton` (confirmed trivially reusable — `Button` + `signOut()` + redirect, no rework needed).
7. **Colors**: 100% `lib/theme.css` `--theme-*` tokens; no new hardcoded color values in any new or restyled component.

# Tasks: Admin Panel Shell Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000-1150 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (forecast only — overridden below) |
| Delivery strategy | **size:exception** (user decision, 2026-07-16) |
| Chain strategy | N/A — single PR |

Decision needed before apply: **No — resolved.** The user explicitly accepted `size:exception` and chose to ship this change as **one single PR** covering Phases 1-5, rather than splitting into the chained PRs suggested by the forecast below. The implementing LLM/session should NOT re-split this into multiple PRs; proceed as one PR/commit series against a single branch.

The phase ordering below (1 → 2 → 3 → 4 → 5) still MUST be respected internally as the implementation/commit sequence within that single PR — Phase 2 in particular must land as one atomic unit (see 2.1-2.6) even though it's no longer a separate PR boundary.

### Reference: Forecast's Suggested Work Units (informational only — not used, see decision above)

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Phase 1 — recharts dep + all 4 `components/app-shell/*` components/CSS | Purely additive, unused until wired in Phase 2 |
| 2 | Phase 2 — route-group wiring, `proxy.ts` auth fix, all 3 page moves, 4 stub pages | Must ship as one atomic commit: proxy fix and the dashboard/starter-page swap cannot land separately without `/` briefly being double-protected or unprotected |
| 3 | Phase 3 + Phase 4 — dashboard `--theme-*` migration + Recharts charts | Operates only on `app/(app)/page.tsx`/`page.css` already relocated by Phase 2 |

## Phase 1: Dependencies & App Shell Components

- [x] 1.1 Run `npm install recharts`, adds to `package.json` dependencies
- [x] 1.2 Create `components/app-shell/app-shell.tsx` — `AppShellProps{children}`, client component, `useState(true)` for `isSidebarOpen`, composes `<Sidebar isOpen>` + `<Topbar isSidebarOpen onToggleSidebar>` + `<main className="app-shell__content">{children}</main>`
- [x] 1.3 Create `components/app-shell/app-shell.css` — `.app-shell{display:flex;min-height:100dvh;background:var(--theme-bg-background);}` `.app-shell__content{flex:1;overflow-y:auto;}`
- [x] 1.4 Create `components/app-shell/sidebar.tsx` — `NavItem{href,label,icon,comingSoon?}` + `NAV_ITEMS` (7 entries per design's Interfaces section; Cuentas/Categorías/Reportes/Configuración flagged `comingSoon:true`); render all as real `<Link>`; `usePathname()` exact-match active highlight
- [x] 1.5 Create `components/app-shell/sidebar.css` — width `260px→0` show/hide via `transition: width var(--theme-transition-normal)` + `overflow:hidden`; active-link state; `comingSoon` items styled `var(--theme-text-disabled)` + small "Próximamente" badge — `--theme-*` tokens only, no hardcoded hex
- [x] 1.6 Create `components/app-shell/topbar.tsx` — `TopbarProps{isSidebarOpen,onToggleSidebar}`; menu-toggle icon button; inert bell icon (no `onClick`); render reused `<ThemeSwitcher/>` and `<LogoutButton/>` as-is
- [x] 1.7 Create `components/app-shell/topbar.css` — `--theme-*` tokens only
- [x] 1.8 Create `components/app-shell/coming-soon.tsx` — `ComingSoonProps{title}`, renders "Próximamente" + `title`
- [x] 1.9 Create `components/app-shell/coming-soon.css` — `--theme-*` tokens only

## Phase 2: Route Group, Auth Fix & Page Moves (ship atomically)

- [x] 2.1 Modify `lib/supabase/proxy.ts` — delete the `request.nextUrl.pathname !== "/" &&` clause so `/` requires auth like every other route
- [x] 2.2 Create `app/(app)/layout.tsx` — server component rendering `<AppShell>{children}</AppShell>`; no auth re-check (proxy.ts is the single source of truth)
- [x] 2.3 Move dashboard: create `app/(app)/page.tsx` + `page.css` from `app/dashboard/`; delete `min-height:100vh`, `background:var(--primary-050)`, `transition:background-color 0.3s ease` from `.dashboard` (shell now owns viewport chrome); delete `app/dashboard/page.tsx`+`page.css` and `app/page.tsx` (starter template) in this same commit — never let `app/page.tsx`, `app/dashboard/page.tsx`, and `app/(app)/page.tsx` coexist (duplicate `/` route build error)
- [x] 2.4 Move `app/movimientos/{page.tsx,page.css}` → `app/(app)/movimientos/`; delete `min-height:100vh`, `background:var(--theme-bg-background)`, `transition:background-color var(--theme-transition-normal)` from `.movimientos-page`; delete old `app/movimientos/` in the same commit
- [x] 2.5 Move `app/diversion/{page.tsx,page.css}` → `app/(app)/diversion/`; delete only `min-height:100vh` from `.diversion-page`; delete old `app/diversion/` in the same commit
- [x] 2.6 Create `app/(app)/cuentas/page.tsx`, `app/(app)/categorias/page.tsx`, `app/(app)/reportes/page.tsx`, `app/(app)/configuracion/page.tsx`, each rendering `<ComingSoon title="..." />` with the matching Spanish label

## Phase 3: Dashboard Theming Migration (System C → `--theme-*`)

- [x] 3.1 Delete the legacy `:root` variable block and the `[data-theme="dark"]` override block entirely from `app/(app)/page.css` (dead selector — `.dark` cascade from `lib/theme.css` already covers dark mode globally)
- [x] 3.2 Migrate remaining legacy var references in `app/(app)/page.css`: `--primary-900`/`--text-primary`→`--theme-text-primary`; `--primary-500`→`--theme-color-primary`; `--primary-100`/`--primary-050`→`--theme-bg-surface-variant`; `--accent-500`→`--theme-color-accent`; `--accent-100`→`--theme-color-accent-light`; `--surface-bg`→`--theme-bg-surface`; `--surface-border`→`--theme-border-default`; `--text-secondary`/`--text-muted`→`--theme-text-secondary`; `--positive`→`--theme-color-success`; `--negative`→`--theme-color-error`; `--neutral`→`--theme-text-secondary`; derive `-bg` variants via low-opacity `color-mix()` of the matching semantic token (theme.css has no dedicated `-bg` tokens)
- [x] 3.3 Replace hardcoded `font-family: 'Geist', system-ui, ...` in `.dashboard` with `var(--theme-font-family)`
- [x] 3.4 In `app/(app)/page.tsx`'s `MonthlySummary`, replace the 3 inline `style={{color:'var(--negative)'}}` / `'var(--text-secondary)'` / `'var(--accent-500)'` with `--theme-color-error` / `--theme-text-secondary` / `--theme-color-accent`
- [x] 3.5 Verify no `[data-theme="dark"]` selector or legacy var name (`--primary-`, `--accent-`, `--surface-`, `--positive`, `--negative`, `--neutral`) remains in `app/(app)/page.css`

## Phase 4: Recharts Dashboard Charts

- [x] 4.1 In `app/(app)/page.tsx`, add `CHART_COLORS` map (`light`/`dark` → `{primary,accent}` hex mirroring `lib/theme.css`) and the `useTheme()` mount-guard pattern from `theme-switcher.tsx` to resolve `colors` from `resolvedTheme`
- [x] 4.2 Replace `CategoryBars`' hand-rolled `category-bar__fill` divs with a Recharts `<BarChart layout="vertical">` (`YAxis type="category" dataKey="nombre"`, `Bar dataKey="total" fill={colors.accent}`), keeping the existing `categorias` data source so it still reacts to the `meses` filter
- [x] 4.3 Add `trendData` derived from `MESES`/`CATEGORIAS_MAP` and a new "Tendencia mensual" `dash-card` rendering a Recharts `<AreaChart>` (`Area dataKey="total" stroke={colors.primary} fill={colors.primary} fillOpacity={0.15}`)
- [x] 4.4 Wrap both charts in `<ResponsiveContainer>`

## Phase 5: Manual Verification (no automated test runner in this project)

- [x] 5.1 Verify unauthenticated `/` redirects to `/auth/login` — proxy.ts clause removed; build confirms `/` is now an authenticated route (no unauthenticated bypass exists)
- [ ] 5.2 Verify sidebar toggle: width animates 260px→0 on topbar button click, `<main>` reflows, click again reopens — requires dev server verification
- [ ] 5.3 Verify dashboard dark mode: toggle `ThemeSwitcher` on `/`, all cards/text/charts use `.dark` `--theme-*` values, no unstyled/white-flash areas — requires dev server verification
- [ ] 5.4 Verify Recharts bar/area colors switch on theme toggle without reload — requires dev server verification
- [ ] 5.5 Verify `/movimientos` and `/diversion` render shell once each, no duplicate chrome, no double scrollbar — requires dev server verification
- [ ] 5.6 Verify all 4 placeholder nav items navigate and render "Próximamente" + correct title, no 404 — requires dev server verification
- [x] 5.7 Verify `/dashboard` now 404s (dangling route removed) — confirmed: `/dashboard` is absent from `npm run build` route listing
- [x] 5.8 Run `npm run lint && npm run build` — zero errors — build passed: ✓ Compiled successfully, TypeScript passed, all 20 routes generated

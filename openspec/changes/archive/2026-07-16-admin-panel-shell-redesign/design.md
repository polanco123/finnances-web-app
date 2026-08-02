# Design: Admin Panel Shell Redesign

## Technical Approach

Wire the shell with a Next.js route group `app/(app)/layout.tsx` — the idiomatic way to share layout without adding a URL segment, and a first for this repo (no prior `(group)` precedent existed). `app/auth/*` and `app/protected/*` stay outside the group untouched — `app/protected/` is out of scope for this change entirely and is not modified. The group wraps a client `AppShell` composing hand-rolled `Sidebar` + `Topbar` + `<main>` content, matching the project's 100%-hand-rolled component convention (no new Radix dependency). The dashboard becomes the home route by **physically moving** `app/dashboard/{page.tsx,page.css}` into `app/(app)/page.tsx`/`page.css` — `app/dashboard/` is deleted, not kept as a duplicate route (it was already unreachable from nav). The starter-template `app/page.tsx` is deleted outright; its content does **not** move anywhere. `/movimientos` and `/diversion` move into the group with their internal logic untouched, only their outer-wrapper CSS trimmed. The shell's `<main>` becomes the single owner of viewport height/background; per-page wrappers keep only padding/max-width.

## Architecture Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Shell wiring | Route group `app/(app)/layout.tsx` | Per-page duplicated `<AppShell>` JSX; pathname-gating in root `layout.tsx` | Zero URL-segment cost, Next.js-idiomatic, auth routes excluded automatically by living outside the group |
| Dashboard/home placement | Physically move+rename `app/dashboard/{page.tsx,page.css}` → `app/(app)/page.tsx`/`page.css`; delete `app/dashboard/` and `app/page.tsx` entirely | Keep `/dashboard` alive rendering the same shared component as `/` | Single authenticated home; a lingering duplicate route serves no purpose (already unreachable from nav) and risks drift |
| Viewport chrome ownership | `.app-shell__content` owns `min-height`/background; page wrappers keep only padding/max-width | Keep per-page `min-height:100vh`, override via CSS specificity in shell | One source of truth avoids double-background paint and override wars across 3 page.css files |
| Sidebar/topbar implementation | Hand-rolled `components/app-shell/*` (tsx+css) | `npx shadcn add sidebar/sheet` + new `@radix-ui/react-dialog` dep | Matches 100% of existing custom components; avoids a 4th styling system (shadcn defaults target System A) |
| Sidebar toggle state | Local `useState(true)` in `AppShell` | Context, URL param, localStorage | No cross-page persistence requirement (proposal Non-Goals) |
| Sidebar hide animation | Animate sidebar wrapper `width: 260px → 0` + `overflow: hidden`, `transition: width var(--theme-transition-normal)` | `display:none` (no transition); `transform:translateX(-100%)` (leaves layout gap, doesn't reclaim space) | "Full show/hide" (not icon-rail) implies reclaiming layout space; width transitions are universally supported |
| Placeholder nav destinations | Real stub routes under `(app)` rendering shared `ComingSoon` | Disabled/non-clickable nav `<span>` | Real `<Link>` navigation avoids faking disabled-link focus/hover/aria states |
| Placeholder nav visual treatment | Real, fully clickable `<Link>` styled with `--theme-text-disabled` (muted) instead of `--theme-text-primary`, plus a small "Próximamente" badge/pill next to the label | Identical styling to functional links (no visual cue); fully `aria-disabled`/non-interactive control | `app-shell-navigation` spec's "Placeholder entries are visually distinguishable" requirement mandates a distinct visual state; muted color + badge satisfies that while the link stays real/navigable (keeps the a11y benefit from the destination decision above) |
| Topbar theme toggle | Reuse `components/theme-switcher.tsx` as-is | New binary `--theme-*`-styled toggle | Introduces zero new hardcoded hex (rule 7 satisfied — its only "non-theme" token is `text-muted-foreground`, an HSL var, not a literal); avoids net-new component for a cosmetic-only gain. Independent design-phase call (proposal Assumption #2), made without waiting on `admin-panel-theming` spec finalization |
| `/` auth | Remove `request.nextUrl.pathname !== "/" &&` clause in `proxy.ts` | New allowlist elsewhere / matcher change | Matches exploration's confirmed minimal, single-clause fix |
| Recharts color wiring | Static JS color map keyed by `resolvedTheme` (from `next-themes`), values mirroring `lib/theme.css` hex | `getComputedStyle` read in a `useEffect` | Fewer moving parts, no SSR guard beyond the existing mount-guard pattern already used in `theme-switcher.tsx`; re-renders correctly since `resolvedTheme` change triggers React re-render |
| Chart types | `<BarChart>` horizontal (category on Y-axis) for "Top categorías — gasto"; `<AreaChart>` for monthly spend trend over `MESES` | Pie/donut for categories | Horizontal bars fit long Spanish labels ("Préstamo / Crédito") better than a pie legend; area is the idiomatic shape for a time trend |

## Data Flow

    app/layout.tsx (root, ThemeProvider attribute="class")
      │
      ├─ app/auth/*        ── NOT wrapped by shell (public)
      ├─ app/protected/*   ── untouched, out of scope
      │
      └─ app/(app)/layout.tsx ──▶ AppShell (client, useState isSidebarOpen=true)
            │
            ├─ Sidebar(isOpen) ── Link × 7, usePathname() exact-match highlight
            │     / (Dashboard) · /movimientos · /diversion · /cuentas · /categorias · /reportes · /configuracion
            │
            ├─ Topbar(isSidebarOpen, onToggleSidebar)
            │     ├─ Menu icon button ──▶ setIsSidebarOpen(v => !v)
            │     ├─ Bell icon (non-functional, no onClick)
            │     ├─ ThemeSwitcher (reused as-is)
            │     └─ LogoutButton (reused as-is)
            │
            └─ <main className="app-shell__content"> {children} </main>
                  ├─ /              ──▶ DashboardContent (mock data + Recharts BarChart/AreaChart)
                  ├─ /movimientos   ──▶ MovimientosContent (Supabase fetch, logic unchanged)
                  ├─ /diversion     ──▶ DiversionContent (Supabase fetch, logic unchanged)
                  └─ /cuentas|/categorias|/reportes|/configuracion ──▶ ComingSoon(title)

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `app/(app)/layout.tsx` | Create | Server component rendering `<AppShell>{children}</AppShell>`; no auth re-check (proxy.ts is single source of truth) |
| `app/(app)/page.tsx` + `page.css` | Move (from `app/dashboard/`) | Content migrated System C → `--theme-*`; Recharts added; `min-height`/background removed from `.dashboard` |
| `app/(app)/movimientos/page.tsx` + `page.css` | Move (from `app/movimientos/`) | Internal fetch/render logic untouched; `.movimientos-page` loses `min-height`/`background`/transition |
| `app/(app)/diversion/page.tsx` + `page.css` | Move (from `app/diversion/`) | Internal logic untouched; `.diversion-page` loses `min-height` |
| `app/(app)/cuentas/page.tsx` | Create | Stub: `<ComingSoon title="Cuentas" />` |
| `app/(app)/categorias/page.tsx` | Create | Stub: `<ComingSoon title="Categorías" />` |
| `app/(app)/reportes/page.tsx` | Create | Stub: `<ComingSoon title="Reportes" />` |
| `app/(app)/configuracion/page.tsx` | Create | Stub: `<ComingSoon title="Configuración" />` |
| `app/page.tsx` | Delete | Starter-template content (Hero, DeployButton, tutorial steps) removed entirely, not moved |
| `app/dashboard/page.tsx` + `page.css` | Delete | Superseded by `app/(app)/page.tsx`; `/dashboard` now 404s intentionally |
| `app/movimientos/page.tsx` + `page.css` | Delete | Superseded by `app/(app)/movimientos/` |
| `app/diversion/page.tsx` + `page.css` | Delete | Superseded by `app/(app)/diversion/` |
| `components/app-shell/app-shell.tsx` + `.css` | Create | Composing wrapper; owns `isSidebarOpen` state |
| `components/app-shell/sidebar.tsx` + `.css` | Create | Nav list, `usePathname()` active-match |
| `components/app-shell/topbar.tsx` + `.css` | Create | Toggle button, bell, ThemeSwitcher, LogoutButton |
| `components/app-shell/coming-soon.tsx` + `.css` | Create | Shared placeholder, reused ×4 |
| `lib/supabase/proxy.ts` | Modify | Remove `/` auth exemption clause |
| `package.json` | Modify | Add `recharts` dependency |
| `components/theme-switcher.tsx`, `components/logout-button.tsx` | None | Reused as-is, no changes |

## CSS Collision Fix — Worked Example (`app/movimientos/page.css` → `app/(app)/movimientos/page.css`)

Before:
```css
.movimientos-page {
  min-height: 100vh;
  background: var(--theme-bg-background);
  padding: var(--theme-spacing-6) var(--theme-spacing-4);
  transition: background-color var(--theme-transition-normal);
}
```
After:
```css
.movimientos-page {
  padding: var(--theme-spacing-6) var(--theme-spacing-4);
}
```
Pattern-match for the others: `app/diversion/page.css` — delete only `min-height: 100vh;` from `.diversion-page` (it never set its own background). `app/(app)/page.css` (ex-dashboard) — delete `min-height: 100vh;`, `background: var(--primary-050);`, and `transition: background-color 0.3s ease;` from `.dashboard`, alongside the token-name migration (`--primary-050`→ n/a, `--text-primary`→`var(--theme-text-primary)`, `font-family` literal → `var(--theme-font-family)`).

The shell owns the removed rules:
```css
/* components/app-shell/app-shell.css */
.app-shell { display: flex; min-height: 100dvh; background: var(--theme-bg-background); }
.app-shell__content { flex: 1; overflow-y: auto; }
```

## Interfaces / Contracts

```ts
interface AppShellProps { children: React.ReactNode }

interface SidebarProps { isOpen: boolean }
interface NavItem { href: string; label: string; icon: LucideIcon; comingSoon?: boolean }
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/diversion', label: 'Diversión', icon: Gamepad2 },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet, comingSoon: true },
  { href: '/categorias', label: 'Categorías', icon: Tags, comingSoon: true },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, comingSoon: true },
  { href: '/configuracion', label: 'Configuración', icon: Settings, comingSoon: true },
]
// Sidebar renders each NavItem as a real <Link>; when comingSoon is true it
// applies a muted text style (--theme-text-disabled) and appends a small
// "Próximamente" badge, satisfying the spec's visual-distinction requirement
// without disabling navigation.

interface TopbarProps { isSidebarOpen: boolean; onToggleSidebar: () => void }
interface ComingSoonProps { title: string }

// app/(app)/page.tsx chart section
const CHART_COLORS: Record<'light' | 'dark', { primary: string; accent: string }> = {
  light: { primary: '#1976d2', accent: '#ff6f00' }, // mirrors lib/theme.css :root
  dark:  { primary: '#42a5f5', accent: '#ffa726' }, // mirrors lib/theme.css .dark
}
const trendData = [...MESES].reverse().map((m) => ({
  mesLabel: m.label,
  total: (CATEGORIAS_MAP[m.value] ?? []).reduce((s, c) => s + c.total, 0),
}))
// <ResponsiveContainer><BarChart data={categorias} layout="vertical">
//   <YAxis type="category" dataKey="nombre" /><XAxis type="number" />
//   <Bar dataKey="total" fill={colors.accent} radius={[0,4,4,0]} />
// </BarChart></ResponsiveContainer>
// <ResponsiveContainer><AreaChart data={trendData}>
//   <XAxis dataKey="mesLabel" /><YAxis />
//   <Area type="monotone" dataKey="total" stroke={colors.primary} fill={colors.primary} fillOpacity={0.15} />
// </AreaChart></ResponsiveContainer>
```
`colors` resolves via existing `useTheme()` mount-guard pattern from `theme-switcher.tsx`: `const { resolvedTheme } = useTheme()`, then `CHART_COLORS[resolvedTheme === 'dark' ? 'dark' : 'light']`.

## Testing Strategy

| Scenario | Steps | Expected |
|---|---|---|
| Unauthenticated `/` redirect | Clear session, visit `/` | Redirect to `/auth/login` |
| Sidebar toggle | Click topbar menu button | Sidebar width animates 260px→0, `<main>` reflows to full width; click again reopens |
| Dashboard dark mode (bug-fix regression) | Toggle `ThemeSwitcher` to dark on `/` | Cards/text/background use `.dark` `--theme-*` values, no unstyled/white-flash areas |
| Recharts recolor on theme toggle | Toggle theme while on `/` | Bar/Area chart strokes/fills switch to dark-mode hex without reload |
| `/movimientos` nested chrome | Visit `/movimientos` | Sidebar+topbar render once, no duplicate chrome, no double scrollbar |
| `/diversion` nested chrome | Visit `/diversion` | Same as above |
| Placeholder pages reachable | Click each of the 4 placeholder nav items | Navigates, renders "Próximamente" + title, no 404 |
| `/dashboard` intentionally removed | Visit `/dashboard` directly | 404 (confirms no dangling duplicate route) |

## Migration / Rollout

No Supabase schema/RLS migration — purely frontend routing + CSS + one middleware clause. Ship as a single pass (no feature flag), per proposal's explicit scope; the visual change is comprehensive by design and staging it would leave the app in a half-migrated, harder-to-review state. `app/protected/` is unaffected and left as-is — it is not part of this change's scope.

## Open Questions

None. All items flagged "deferred to sdd-design" in the proposal are resolved above.

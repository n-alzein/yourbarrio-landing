# Admin Dashboard UI Audit

## Summary

The admin dashboard works functionally, but the visual system is heavier than the operational dashboard it wants to be. The current screen uses stacked bordered panels, boxed sidebar items, a tall fixed top navbar, and full-width sections that give every module similar weight. This makes the page feel dense and less scannable than a calmer Vercel-style dashboard.

The first pass should stay scoped to `/admin` and keep the dark theme. The goal is to reduce visual noise, preserve contrast, use YourBarrio purple only for selected/accent states, and make the dashboard read as an operational overview: key metrics first, urgent work next, then trend and audit context.

Validation: `npm run lint` passed on 2026-05-10.

## Files Inspected

- `app/admin/page.tsx` - admin dashboard route, metric cards, pending verification preview, data loading.
- `app/admin/layout.tsx` - admin authorization, shell wiring, sidebar/status composition.
- `app/admin/_components/AdminShellClient.tsx` - fixed admin navbar, desktop sidebar, content container.
- `components/nav/AdminNavbar.tsx` - fixed top admin navbar.
- `app/admin/_components/AdminSidebar.tsx` - signed-in panel plus vertical nav wrapper.
- `app/admin/_components/AdminNav.tsx` - admin navigation item list, badges, icons, logout.
- `app/admin/_components/AdminTopBar.tsx` - alternate top bar component; currently not used by `app/admin/layout.tsx`.
- `app/admin/_components/AdminPage.tsx` - shared admin page spacing wrapper.
- `app/admin/_components/AdminUserSignupsChart.tsx` - signups chart card.
- `app/admin/_components/RecentAuditActivity.tsx` - recent audit table and pagination.
- `app/admin/_components/AdminStatusStack.tsx` and `app/admin/_components/StatusStack.tsx` - warning/support banners.
- `app/admin/_components/AdminTableToolbar.tsx` - shared toolbar pattern used elsewhere in admin.
- `app/admin/_components/AccountsList.tsx` - admin table/list style reference.
- `app/admin/verification/page.tsx` - canonical verification queue page.
- `app/admin/verification/_components/VerificationQueueTableClient.tsx` - reusable reference for pending verification table behavior.
- `app/globals.css` - admin root CSS, navbar/sidebar globals, dashboard utility classes and theme guardrails.
- `package.json` - standard validation scripts.

## Current Structure

The admin shell is composed by `app/admin/layout.tsx`. It authorizes the admin, fetches impersonation and pending verification count, then renders `AdminShellClient` with expanded and collapsed sidebar content.

`AdminShellClient` creates:

- A fixed 80px `AdminNavbar` at the top.
- A fixed desktop sidebar starting below the navbar, either `w-64` or `w-16`.
- A main content area with `max-w-7xl`, `px-4/6/8`, `pt-4/5`, and nested `space-y-6`.
- A mobile right-side drawer for the same sidebar content.

The dashboard page itself renders, in order:

1. Flash messages.
2. Header with `Dashboard` and a short description.
3. Five metric cards in `sm:grid-cols-2 lg:grid-cols-5`.
4. Full-width pending verification preview section.
5. Full-width signups chart section.
6. Full-width recent audit activity table.

Most dashboard surfaces use `rounded-lg border border-neutral-800 bg-neutral-900 p-4`. The metric card is a local `StatCard` inside `app/admin/page.tsx`; there is no reusable admin card primitive yet.

## Main UI Problems

- The top navbar is visually oversized for an admin tool. `components/nav/AdminNavbar.tsx` uses `h-20`, a large desktop logo slot (`md:h-32 md:w-32` inside an 80px bar), and centered uppercase `ADMIN ACCOUNT`, which competes with the page title.
- The sidebar feels boxed-in. `AdminNav` gives every nav item a border and `bg-neutral-900`, so inactive items look like selected buttons instead of quiet navigation rows.
- There is no active nav state in `AdminNav`. Every item has similar weight, so the current section is not visually anchored.
- The signed-in and role blocks are also boxed. `AdminSidebar` adds a bordered signed-in card, and `AdminNav` adds a bordered purple role card, increasing stacked panel noise.
- Page spacing is double-stacked. `AdminShellClient` has `space-y-6`, while `AdminPage` has `space-y-8`, making vertical rhythm loose and inconsistent.
- Dashboard sections all use the same card treatment. Metrics, pending work, chart, and audit table all receive similar borders/backgrounds, so hierarchy is unclear.
- The metric cards are compact in size but visually blunt: no grouping, no trend/context slot, and all five have equal neutral treatment even when some represent attention states.
- Pending verifications are rendered as separate bordered link cards. This is less scannable than a compact operational list/table and makes each row feel heavier than the action it represents.
- The chart card is full-width and `h-72`, which can dominate the page even when signups data is sparse.
- Recent audit activity uses a full table with prominent row borders and long timestamp strings. It reads as a database table instead of a quick activity feed.
- Purple/indigo is currently used for the role chip rather than reserved for active navigation or the highest-value dashboard accent.
- Global dashboard classes in `app/globals.css` include light business-dashboard utilities that are not clearly separated from admin dashboard primitives, so future admin polish could drift.

## Recommended Dashboard Structure

Borrow the clarity, not the exact visuals, of Vercel dashboards:

1. Compact shell
   - Reduce admin navbar height from 80px to a more operational 56-64px.
   - Keep the brand small and stable.
   - Move admin identity/role into a subdued right-side account area or sidebar footer, not a prominent page-level badge.

2. Calmer sidebar
   - Use flat nav rows with transparent default background.
   - Remove borders from inactive nav items.
   - Add a strong active state only for the current route: subtle purple tint, left accent rail or filled row, and higher text contrast.
   - Keep badges compact; pending verification badge should appear only when count is positive.

3. Dashboard title row
   - Use a single row above content: title, short description, and maybe a small "Last updated" or primary operational link.
   - Avoid another large boxed header.

4. Metrics row
   - Replace the local `StatCard` with a reusable `AdminMetricCard`.
   - Use four or five compact cards with consistent height, smaller labels, larger values, and optional subdued helper text.
   - Treat attention metrics (`Open moderation flags`, `Open support tickets`, pending verification count if added) with small status accents, not full warning backgrounds.

5. Needs attention section
   - Put pending verifications, moderation flags, and support tickets into a top operational section.
   - For this first pass, start with pending verifications because the data is already present.
   - Use a compact table/list with columns: Business, Location, Submitted, Status, Action.

6. Secondary analytics section
   - Make the signups chart a half-width or two-column panel on desktop.
   - Reduce height to around 180-220px.
   - Add a small summary value above the chart so the panel has value when bars are low.

7. Recent activity section
   - Pair recent audit activity beside the chart on desktop, or below it on smaller screens.
   - Prefer feed-like rows with compact metadata over a dense four-column table on the dashboard.
   - Keep the full audit table on `/admin/audit`.

Suggested desktop layout:

```text
Title row
Metric cards
Needs attention / Pending verifications
Two-column row:
  User signups chart
  Recent audit activity
```

## Component-Level Recommendations

### Admin Shell

Before: `AdminShellClient` uses an 80px fixed navbar, a strongly bordered sidebar, and nested page wrappers with separate vertical spacing.

After:

- Introduce admin-specific shell tokens/classes, for example `--admin-nav-h: 64px`, `--admin-bg`, `--admin-surface`, `--admin-border-subtle`.
- Keep the dark background, but use `bg-neutral-950` for the page and `bg-white/[0.02]` or `bg-neutral-900/40` for surfaces.
- Reduce the main content vertical spacing to one source of truth, preferably in `AdminPage`.

### Sidebar and Navigation

Before: every sidebar item is a bordered `bg-neutral-900` button-like row; role and identity are separate bordered cards.

After:

- Use route-aware active state in `AdminNav`, likely via a small client nav item component using `usePathname()`.
- Inactive item: transparent background, no border, `text-neutral-400`, hover `bg-white/[0.04]`.
- Active item: `bg-[rgba(110,52,255,0.14)]`, `text-neutral-50`, optional left rail or icon color.
- Move role/account context to a quieter footer area or single compact line.
- Keep collapsed icons but remove inactive borders there too.

### Top Header

Before: `AdminNavbar` is tall and brand-heavy for an internal dashboard.

After:

- Reduce height to 56-64px.
- Use smaller logo dimensions that do not overflow the bar.
- Replace centered `ADMIN ACCOUNT` with a subtle right-side label or remove it entirely when sidebar already communicates admin context.
- Avoid black-on-black buttons; mobile menu button should retain visible contrast.

### Dashboard Metrics

Before: local `StatCard` in `app/admin/page.tsx`, five equal bordered cards.

After:

- Extract `AdminMetricCard` under `app/admin/_components/`.
- Support `label`, `value`, `helper`, `tone`, and optional `href`.
- Use consistent padding (`p-3` or `p-4`) and one subtle border/background recipe.
- Consider grouping attention metrics or adding a small status dot instead of making every metric visually identical.

### Pending Verification Preview

Before: full-width section with individual bordered link cards and only business name, city, relative time.

After:

- Rename the dashboard section to `Needs attention`.
- Render pending verifications as a compact table/list with clear columns and one small `Review` action per row.
- Show up to 5 rows on the dashboard, with `View queue` linking to `/admin/verification`.
- Reuse formatting and action patterns from `VerificationQueueTableClient` where practical, but avoid bringing the full queue complexity into the dashboard.

### User Signups Chart

Before: full-width `h-72` chart with grid, legend, and two bright series.

After:

- Reduce height to 180-220px on dashboard.
- Use fewer visual lines: softer grid, no heavy legend if labels can be inline.
- Keep colors accessible but calmer; reserve purple for dashboard accent if changing series colors.
- Add an empty/low-data treatment so a mostly blank chart does not still consume major vertical space.

### Recent Audit Activity

Before: full-width table with long UTC timestamp strings and row borders.

After:

- Dashboard version should be an activity feed or compact list.
- Show action, target, actor, and relative time; keep exact timestamp in `title`.
- Link to `/admin/audit` for the full table.
- Reduce page controls on the dashboard. Pagination is useful on the audit page, but a dashboard preview can show the latest 5-8 records plus `View all`.

### Shared Admin Components

Create or standardize:

- `AdminSection` - header, description, optional action, subtle surface.
- `AdminMetricCard` - reusable compact stat card.
- `AdminDataList` or `AdminPreviewTable` - low-density dashboard lists.
- `AdminBadge` - consistent status/role/verification badges.
- `AdminButton` or class recipe - primary, secondary, danger, ghost button treatments for dark admin.

These should live in `app/admin/_components/` initially. Avoid broad global CSS until the admin dashboard pattern is proven.

## Low-Risk Implementation Plan

1. Add route-aware active nav state.
   - Low risk because it is presentational and contained to admin nav.
   - Use a small client wrapper if needed; do not change nav destinations or permissions.

2. Soften sidebar item styling.
   - Remove borders/backgrounds from inactive nav items.
   - Keep active and hover states clear.
   - Keep badge count behavior unchanged.

3. Reduce dashboard card weight.
   - Extract `AdminMetricCard`.
   - Update only `app/admin/page.tsx` to use it.
   - Keep all existing dashboard queries and displayed values unchanged.

4. Convert pending verification preview into a compact `Needs attention` list.
   - Keep the same data source: `listPendingBusinessVerifications({ status: "pending", from: 0, to: 9 })`.
   - Limit displayed rows on the dashboard to 5 or 6.
   - Keep `/admin/verification` as the full workflow.

5. Make the chart secondary.
   - Reduce `AdminUserSignupsChart` height via a prop such as `compact`.
   - Use compact mode only on `/admin` to avoid unintended changes elsewhere.

6. Make recent audit activity a dashboard preview.
   - Either add a compact prop to `RecentAuditActivity` or create `RecentAuditPreview`.
   - Keep the current API and audit page behavior unchanged.

7. Tighten shell spacing only for admin dashboard if broad layout changes feel risky.
   - Start by adjusting `AdminPage` usage or a dashboard-specific wrapper.
   - Defer global admin shell height changes if other admin pages depend on current spacing.

## Higher-Risk Changes

- Changing `AdminShellClient` navbar height affects every admin page and support-mode offset behavior.
- Replacing `AdminNavbar` or sidebar structure can affect mobile drawer interactions and logout flow.
- Moving shared styles into `app/globals.css` can unintentionally affect business dashboard classes because dashboard utility names are shared.
- Refactoring verification actions into the dashboard could change operational behavior; dashboard should link to the queue rather than duplicate full approval/suspension workflows.
- Removing audit pagination from `RecentAuditActivity` directly could affect expectations if the component is reused later; prefer a separate preview component or a prop.

## Before / After Guidance

- Before: all sidebar links look like bordered buttons.
  After: inactive links are quiet rows; active link owns the selected treatment.

- Before: dashboard is a vertical stack of heavy cards.
  After: dashboard is a compact hierarchy: metrics, needs attention, then secondary context.

- Before: pending verification rows are separate cards.
  After: pending verification rows are operational list/table rows with clear `Review` actions.

- Before: signups chart spans the page and uses 288px height.
  After: signups chart is a secondary panel around 180-220px tall, with low-data handling.

- Before: recent audit is a full table preview with pagination.
  After: dashboard shows a short activity feed; `/admin/audit` remains the full table.

- Before: purple/indigo is used for role presentation.
  After: purple is reserved for active navigation, primary focus, and selective accent.

## Follow-Up Implementation Prompt

Implement the first-pass admin dashboard UI cleanup from `docs/audits/admin-dashboard-ui-audit.md`.

Scope:

- Only update the admin dashboard and shared admin shell/nav components needed for that page.
- Keep runtime behavior, data queries, links, permissions, and server actions unchanged.
- Keep the dark theme and YourBarrio purple accent, but use the accent selectively.
- Do not redesign other admin pages beyond shared nav/shell changes that are necessary and low-risk.

Target changes:

- Add a route-aware active state to admin sidebar navigation.
- Make inactive sidebar nav items flatter and calmer.
- Extract a reusable `AdminMetricCard`.
- Rework `/admin` into a clearer layout: title row, compact metrics, `Needs attention` pending verification list, compact signups chart, compact recent audit preview.
- Keep `/admin/verification` as the full verification workflow.
- Prefer component-local Tailwind changes over broad global CSS changes unless a token is clearly admin-specific.

Validation:

- Run `npm run lint`.
- Manually inspect the `/admin` dashboard at desktop and mobile widths.
- Confirm no dashboard counts, links, approval actions, or audit fetching behavior changed.

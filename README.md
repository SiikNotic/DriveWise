# DriveWise

Mileage tracking, GPS trip tracking, vehicle cost calculation, earnings
tracking, delivery offer analysis, expense tracking, tax mileage reports and
performance analytics for gig delivery drivers (DoorDash, Uber Eats,
Grubhub, Instacart, etc).

This is the **architecture phase**: a monorepo skeleton with the web
dashboard scaffolded, shared domain logic, and the initial Supabase schema.
Screens beyond a Dashboard/Settings placeholder, and the actual mobile app,
are intentionally not built yet — see [What's implemented vs.
planned](#whats-implemented-vs-planned).

## Monorepo layout

```
apps/
  web/       Next.js dashboard (App Router, TypeScript, Tailwind, shadcn/ui)
  mobile/    Mobile tracking layer — architecture documented, not yet
             scaffolded. See apps/mobile/README.md.
packages/
  shared/    Domain types, Supabase Database types, and the calculation
             functions (offer analyzer, vehicle cost, mileage rates,
             distance) used by both apps — no UI code.
  config/    Shared tsconfig base.
supabase/
  migrations/  SQL schema + RLS policies.
  config.toml  Local Supabase CLI config.
```

Package manager: **pnpm** workspaces (`pnpm-workspace.yaml`). No Turborepo
yet — one buildable app doesn't need a task orchestrator; add one when a
second app is actually building.

## Web vs. mobile: why the split

- **`apps/web`** is a Next.js dashboard: viewing trips, running the reports,
  managing vehicles/expenses/settings, analyzing a pasted delivery offer.
  Nothing in it depends on being able to track GPS in the background.
- **`apps/mobile`** is where GPS trip tracking actually happens. A browser
  tab cannot reliably keep recording location once a phone is locked or the
  OS backgrounds it — there's no web API that changes that. Reliable
  background GPS needs a native app using `expo-location` +
  `expo-task-manager` (iOS `UIBackgroundModes: location`, Android foreground
  service). See `apps/mobile/README.md` for the full design.

Both apps import `@drivewise/shared` for domain types and calculations, so a
mile or a dollar computed on one platform is computed the same way on the
other.

## Data: local-first, sync when online

The mobile tracking layer treats the network as unreliable by default, not
as an edge case:

1. GPS samples and computed trip distance/duration are written to on-device
   storage first — this never depends on connectivity.
2. A `client_id` (UUID, generated on-device) is attached to every
   locally-created row, before it has ever touched the network.
3. When online, a sync engine pushes pending rows to Supabase, which upserts
   on `(user_id, client_id)`. A dropped connection and retry re-sends the
   same envelope and lands on the same row — no duplicates.
4. Local rows are marked synced once Supabase confirms the write, and are
   kept locally for a retention window afterward rather than deleted
   immediately, in case the confirmation itself was what got lost.

The envelope/status types for this are in
`packages/shared/src/types/sync.ts` (`SyncEnvelope`, `SyncQueueItem`,
`SyncStatus`). `apps/web` doesn't need this queue today (it doesn't record
GPS), but it's shared so the mobile app doesn't invent its own contract
later.

### What stays local vs. what reaches Supabase

- **Local only, unless a driver opts in**: raw high-frequency GPS points.
- **Always synced (once online)**: vehicles, `user_settings`, trips
  (aggregated distance/duration + a simplified route polyline), delivery
  offers, expenses. See `supabase/migrations/` for the exact columns.

## Supabase

- `supabase/migrations/20260918021136_init_schema.sql` — `vehicles`,
  `user_settings`, `trips`, `trip_points`, `delivery_offers`, `expenses`.
  Every table has RLS enabled with owner-only policies
  (`auth.uid() = user_id`, `to authenticated`, `with check` on updates so a
  row's `user_id` can't be reassigned). A trigger creates a default
  `user_settings` row when a user signs up.
- `supabase/migrations/20260918021257_storage_receipts.sql` — a private
  `receipts` Storage bucket (for expense photos), with owner-scoped
  policies keyed on the file path's `<user_id>/...` prefix.
- `packages/shared/src/types/database.ts` — hand-written `Database` type
  matching the migrations above. Once a real project exists, regenerate it
  with `npx supabase gen types typescript --local` (or `--project-id`) and
  diff against this file rather than letting them drift apart.
- No project is provisioned and no credentials are committed anywhere in
  this repo. `apps/web/.env.example` lists the two client-side env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) —
  copy it to `.env.local` and fill in your own project's values. Until
  those are set, `apps/web` still runs; it just skips the Supabase session
  refresh in `proxy.ts` (see the guard in
  `apps/web/src/lib/supabase/proxy.ts`).

## Internationalization (English / Español)

`apps/web` uses [`next-intl`](https://next-intl.dev) with locale-prefixed
routes (`/en/...`, `/es/...`). All UI strings live in
`apps/web/messages/{en,es}.json` — no hardcoded interface text in
components. The language switcher lives on the Settings page
(`apps/web/src/components/settings/language-switcher.tsx`) and just
navigates to the same path under the other locale; `next-intl` persists the
choice in a cookie. Adding a third language means: add the locale to
`apps/web/src/i18n/routing.ts`, add `messages/<locale>.json`, add it to the
switcher — no routing or component changes.

## Design system

`apps/web/src/app/[locale]/design-system` is a reference page (not a product
screen — it's not linked from the app's real navigation) showing every token
and reusable component. Open it at `/en/design-system` once the app is
running.

**Brand direction:** premium fintech precision + automotive-dashboard
confidence — warm graphite neutrals (never pure black/white), one amber
accent used sparingly, tight-but-not-bubbly radii. Deliberately not a
generic SaaS/AI-dashboard look, not an Everlance clone, not delivery-app
branding.

- **Tokens** (`apps/web/src/app/globals.css`): every color pair was checked
  programmatically (a WCAG relative-luminance `contrast()` helper) against
  real ratios — body text ≥16:1, semantic text colors ≥4.5:1, focus ring
  ≥3:1 — rather than eyeballed; see the comments at the top of the file for
  the exact numbers. The 8-hue categorical chart palette and the
  good/warning/serious/critical status palette are a validated reference
  palette (fixed hue order, checked for colorblind-safe separation), reused
  rather than invented from scratch.
- **Financial color language**: gains/losses reuse the status palette
  (`--positive`/`--negative`) instead of ad-hoc greens/reds — a metric going
  up isn't always "good" (cost per mile going up is bad), so
  `MetricCard`'s `isIncreaseGood` prop decides the color, not the arrow
  direction alone.
- **Components added**: shadcn/ui-style primitives (`select`, `tabs`,
  `dialog`, `tooltip`, `badge`, `skeleton`, `alert`, `sonner` toast, a
  Recharts-based `chart`) hand-written to shadcn's conventions — `ui.shadcn.com`
  is unreachable from this sandbox's network policy, so the CLI couldn't
  fetch them; `npx shadcn@latest add <component>` will work normally once
  network access allows it, against the existing `components.json`.
- **Product components** (`apps/web/src/components/finance`,
  `.../patterns`): `MetricCard` (the KPI tile for net/gross earnings,
  miles, cost/earnings per mile, earnings per hour — exactly one "hero"
  size per view per the dataviz skill's stat-tile contract), `StatusBadge`
  (every status ships an icon *and* a label — never color alone),
  `StateMessage` (one implementation backing both `EmptyState` and
  `ErrorState`, since they only differ in default icon/tone),
  `EarningsTrendChart` / `EarningsByPlatformChart` (single-series emphasis
  vs. fixed-order categorical, per the dataviz skill's form-selection rules).
- **Dark/light mode**: `next-themes`, toggled from Settings
  (`ThemeSwitcher`), independently re-validated for contrast rather than an
  automatic CSS invert.
- **Navigation**: a top bar (tablet/desktop) and a fixed bottom tab bar
  (phones, hidden at `sm:` and up) sharing one `NAV_ITEMS` source of truth —
  the standard gig-driver-app pattern (thumb reach), not a hamburger menu.

## Next.js 16 note

This project was scaffolded on Next.js 16, which renamed `middleware.ts` /
`export function middleware` to **`proxy.ts`** / `export function proxy`.
`apps/web/src/proxy.ts` composes two concerns under that one entry point:
locale routing (`next-intl`) and Supabase session-cookie refresh — see the
comments there for why they're combined instead of being two files.

## Getting started

```bash
pnpm install
pnpm dev          # runs apps/web on http://localhost:3000
pnpm build        # builds apps/web
pnpm lint         # eslint across workspaces
pnpm typecheck    # tsc --noEmit across workspaces
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in your own
Supabase project's URL and publishable key to enable the Supabase client.

## Deploying (GitHub → Vercel)

1. Push this repo to GitHub (already set up as a git repository).
2. In Vercel, "Import Project" from the GitHub repo.
3. Set **Root Directory** to `apps/web`. Vercel auto-detects the Next.js
   framework preset and, because `pnpm-workspace.yaml` lives at the repo
   root, installs workspace dependencies (including `@drivewise/shared`)
   from there automatically — no custom install command needed.
4. Add the environment variables from `apps/web/.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in
   the Vercel project's Environment Variables settings, for Production,
   Preview, and Development.
5. Push to a branch to get a Preview Deployment; push/merge to the
   production branch to deploy to production.

No Vercel project has been created and no tokens are stored in this repo —
this is a checklist for whoever connects the GitHub repo to Vercel.

## What's implemented vs. planned

**Implemented:**
- Monorepo structure, shared package with domain types + calculations.
- `apps/web`: Next.js + TypeScript + Tailwind + shadcn/ui design system
  (tokens, Button/Card/Input/Label/Select/Tabs/Dialog/Tooltip/Badge/
  Skeleton/Alert/Toast/Chart, plus DriveWise's own MetricCard/StatusBadge/
  StateMessage/chart components — see [Design system](#design-system)),
  bilingual EN/ES routing, light/dark mode, a Dashboard placeholder and a
  working Settings page (language + theme switchers).
- Supabase schema + RLS policies + Storage bucket, validated against a
  local Postgres instance (table creation, triggers, and cross-user RLS
  isolation were all exercised manually — see migration files for details).
- Supabase browser/server/proxy client helpers, gated so the app still
  runs before a project is linked.

**Planned, not yet built (intentionally — see the task instructions this
was built against):**
- The actual `apps/mobile` Expo app (architecture documented in
  `apps/mobile/README.md`).
- Trip list/detail, live GPS tracking UI, vehicle CRUD, expense CRUD,
  delivery offer analyzer form, tax mileage reports, performance analytics.
- Supabase Auth screens (login/signup) and route protection in `proxy.ts`
  (currently it only refreshes the session cookie; see the comment in
  `apps/web/src/lib/supabase/proxy.ts`).
- A provisioned Supabase project and Vercel deployment (both require
  credentials only the project owner can create).

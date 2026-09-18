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

A project (`drivewise`, `us-east-1`) is provisioned under the connected
Supabase organization, with every migration below applied and security
advisors clean (`get_advisors` reports zero findings — see git history for
the two rounds of hardening: pinning `search_path` and revoking public
`EXECUTE` on the `SECURITY DEFINER` trigger function).

- `supabase/migrations/20260918021136_init_schema.sql` — `vehicles`,
  `user_settings`, `trips`, `trip_points`, `delivery_offers`, `expenses`.
  Every table has RLS enabled with owner-only policies
  (`auth.uid() = user_id`, `to authenticated`, `with check` on updates so a
  row's `user_id` can't be reassigned). A trigger creates a default
  `user_settings` row when a user signs up.
- `supabase/migrations/20260918021257_storage_receipts.sql` — a private
  `receipts` Storage bucket (for expense photos), with owner-scoped
  policies keyed on the file path's `<user_id>/...` prefix.
- `supabase/migrations/20260918061415_add_profiles.sql` — `profiles`
  (first/last name, phone, country, state — email and preferred language
  are not duplicated here; email lives in `auth.users`, preferred language
  is `user_settings.language`), RLS owner-only, and the signup trigger
  extended to seed it from `auth.signUp`'s `options.data`.
- `supabase/migrations/20260918061506_harden_functions.sql` +
  `20260918061548_fk_indexes.sql` — advisor-driven hardening (pinned
  `search_path`, revoked public `EXECUTE`) and missing FK indexes.
- `packages/shared/src/types/database.ts` — hand-written `Database` type
  matching the migrations above. Regenerate the authoritative version with
  `npx supabase gen types typescript --project-id bfuxkvarriuidrsbjjig` and
  diff against this file rather than letting them drift apart.
- No credentials are committed anywhere in this repo.
  `apps/web/.env.example` lists the two client-side env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); the
  real values are in `apps/web/.env.local` (gitignored). Until they're set,
  `apps/web` still runs; it just skips the Supabase session refresh in
  `proxy.ts` (see the guard in `apps/web/src/lib/supabase/proxy.ts`).

## Authentication

Supabase Auth, via `@supabase/ssr` (browser/server/proxy clients already
described above). Sign up, login, logout, password recovery, session
persistence, and a per-user profile are all implemented.

- **Sign up / login / logout**: `apps/web/src/lib/auth/actions.ts` (Server
  Actions) + `apps/web/src/app/auth/signout/route.ts` (a POST route
  handler, per Supabase's current documented pattern — logout is a plain
  HTML form post, not a Server Action). Passwords are never touched by our
  code beyond passing them straight to `supabase.auth.signUp` /
  `signInWithPassword` over TLS — Supabase hashes and stores them; nothing
  here stores or logs a password.
- **Password recovery / reset**: `requestPasswordResetAction` calls
  `resetPasswordForEmail` and always reports success either way (never
  reveals whether an address has an account). The reset link lands on
  `apps/web/src/app/auth/confirm/route.ts`, which verifies the token
  (`supabase.auth.verifyOtp`) and redirects to `/reset-password`, where
  `updateUser({ password })` sets the new one using the session that
  `verifyOtp` just established.
- **Required one-time Supabase Dashboard step**: this repo's tooling can
  create the project, run migrations, and check advisors, but Auth email
  templates are dashboard/Management-API-only config with no MCP tool
  exposed for it. Supabase's default templates use `{{ .ConfirmationURL }}`,
  which does not hit `/auth/confirm` — under **Authentication → Email
  Templates** in the dashboard, change:
  - **Confirm signup** → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`
  - **Reset Password** → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}`

  Also confirm **Authentication → URL Configuration → Redirect URLs**
  allows your dev/prod origins (e.g. `http://localhost:3000/**`).
- **Session persistence**: cookie-based via `@supabase/ssr`, refreshed on
  every request by `proxy.ts` (`supabase.auth.getClaims()` — never
  `getSession()` server-side, per Supabase's current guidance on trusting
  the embedded user object).
- **Protected routes**: `apps/web/src/app/[locale]/(app)/layout.tsx`
  redirects to `/login` when there's no session; the inverse guard on
  `apps/web/src/app/[locale]/(auth)/layout.tsx` redirects a signed-in
  visitor away from login/sign-up. This is a UX convenience, not the
  security boundary — RLS on the tables is what actually protects the
  data, verified directly (two test users, cross-user reads/writes both
  correctly rejected).
- **Profile**: first/last name, phone, country, state (Settings page,
  `components/settings/profile-form.tsx`), all through
  `public.profiles`, RLS-scoped to the owner. Preferred language reuses
  the existing `user_settings.language` (Settings' language switcher) —
  not duplicated. Email changes aren't self-serve yet (shown read-only
  with a note); country/state options are `packages/shared/src/constants/regions.ts`.

### What's been verified, and how

`pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass clean for
`@drivewise/web` and `@drivewise/shared`. Beyond that, two different layers
were tested against the real, running app:

- **HTTP-level, against a real production build** (`next build && next
  start`, requests via `curl`): an unauthenticated request to every
  protected route (`/`, `/settings`, `/design-system`) correctly 307s to
  `/login`; `/login`, `/sign-up`, `/forgot-password`, and `/reset-password`
  render fully in both `en` and `es` with no untranslated strings (this
  caught and fixed a real bug — the country dropdown's "United States" /
  "Other" options were hardcoded English; they're now
  `settings.profile.countries.*` translation keys — US state names are
  deliberately left as-is in both locales, since that's how US/PR Spanish
  speakers actually refer to them); `POST /auth/signout` and `GET
  /auth/confirm` (with a deliberately invalid token) both resolve to a
  redirect rather than a crash, confirming Supabase Auth network/API
  failures are surfaced as ordinary `{ error }` results, not uncaught
  exceptions.
- **Database-level, against the live Supabase project** (via SQL, see
  below): the `handle_new_user` trigger, and RLS's owner-only isolation
  (cross-user read/insert/update all rejected, cascading delete works).

**Not testable from this sandbox**: actually clicking through sign up →
receive email → confirm → log in → log out with a real account. This
sandbox's outbound network policy blocks direct HTTPS to `*.supabase.co`
(confirmed via the proxy's own diagnostics — Supabase's MCP tools still
work because they run through Anthropic's infrastructure, not this
sandbox's egress), so the actual Auth API calls can't be exercised
end-to-end here. This isn't a gap in what's been checked, just in where —
the code path, the database-level security boundary, and the rendered
pages are all verified for real; the one thing left is a manual click-
through once this runs somewhere with normal internet access (a deploy, or
your own machine), plus the one-time email template change above, which
this sandbox also can't perform.

## Vehicle Profile

Full CRUD for the vehicles a driver uses for deliveries, plus an operating
cost-per-mile breakdown built from the driver's own inputs.

- **Fields**: nickname, year, make, model, trim (optional), fuel type, MPG,
  fuel price, insurance monthly cost, maintenance/depreciation/other cost
  per mile, and an "estimated monthly miles" figure used only to spread
  insurance's monthly bill across miles. All the cost fields are editable
  any time — see `packages/shared/src/calculations/vehicle-cost.ts`.
- **The math**: fuel cost/mile = fuel price ÷ MPG; insurance's per-mile
  allocation = monthly cost ÷ estimated monthly miles; maintenance,
  depreciation, and other cost/mile pass through unchanged (they're already
  per-mile figures the driver enters); total = the sum of all five. Verified
  against the worked example in the task spec (fuel $0.12 + maintenance
  $0.10 + depreciation $0.18 + insurance $0.07 = $0.47/mile) — see
  `CostBreakdown`'s live preview in the add/edit form.
- **Not a tax figure**: every cost display carries a disclaimer
  (`vehicles.cost.disclaimer`) that these are the driver's own operating-cost
  estimates, not official tax/deduction numbers — that distinction was an
  explicit requirement, not a nice-to-have.
- **Screens**: `/vehicles` (list), `/vehicles/new` (add), `/vehicles/[id]`
  (details + cost breakdown + edit/delete/set-active), `/vehicles/[id]/edit`.
  All under the `(app)` route group, so they inherit the same auth guard as
  everything else.
- **Active vehicle**: reuses `user_settings.default_vehicle_id` (already
  part of the schema from the initial migration) rather than adding a
  second, competing "is this vehicle active" concept — `setActiveVehicleAction`
  double-checks vehicle ownership before pointing a user's settings at it,
  since RLS alone would let a user point their *own* settings row at
  someone else's vehicle ID without that extra check (it just wouldn't let
  them read that vehicle's data — still worth closing).
- **Migration**: `supabase/migrations/20260919010000_vehicle_operating_costs.sql`
  adds the cost columns, drops the now-redundant `is_active` and
  `cost_per_mile_override_usd` columns from the original schema (nothing
  used them yet), and makes MPG required. RLS policies are unchanged from
  the initial schema (owner-only select/insert/update/delete) — this
  migration only touches columns, not access rules.
- **Tested**: `pnpm typecheck`/`lint`/`build` all pass. The cost formula was
  verified against the spec's worked example in isolation. Full CRUD + RLS
  isolation was verified directly against the live database (two test
  users created via SQL, since the Auth API itself isn't reachable from
  this sandbox — see the note under Authentication): create, read, update,
  and delete all correctly scoped to the owner; a cross-user update/delete/
  set-active attempt affects zero rows; deleting a vehicle that was the
  active one correctly nulls `default_vehicle_id` via the existing
  `on delete set null` foreign key. Test users and their data were deleted
  afterward. All new routes were also checked over HTTP against a real
  production build: unauthenticated requests to every vehicle route
  redirect to `/login`, exactly like the rest of the app.
- **A bug this work turned up and fixed, unrelated to vehicles**: testing
  the vehicle pages at runtime (not just `next build`, which doesn't
  exercise every dynamic route) surfaced a real, pre-existing defect on the
  design-system reference page — `MetricCard` (a Client Component) was
  receiving lucide icon *components* and an `onClick` function as props
  directly from a Server Component, which Next.js's Server/Client boundary
  doesn't allow (functions and component references aren't serializable
  across it; rendered elements are). Fixed by changing `MetricCard`'s
  `icon` prop to accept a rendered element (`icon={<BanknoteIcon />}`
  instead of `icon={BanknoteIcon}`) and moving the one interactive
  `ErrorState` demo into its own small Client Component. Confirmed fixed by
  re-running the same production build and checking the server log for
  every `(app)` route.

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
  bilingual EN/ES routing, light/dark mode.
- A provisioned Supabase project (see [Supabase](#supabase)) with the full
  schema + RLS policies + Storage bucket applied and verified.
- Full Supabase Auth (see [Authentication](#authentication)): sign up,
  login, logout, password recovery/reset, session persistence, protected
  routes, and a user profile.
- Full Vehicle Profile CRUD (see [Vehicle Profile](#vehicle-profile)): add/
  edit/delete/list/view vehicles, an operating cost-per-mile breakdown, and
  a per-user active-vehicle selection.
- Settings page: profile fields, language switcher, theme switcher.

**Planned, not yet built:**
- The actual `apps/mobile` Expo app (architecture documented in
  `apps/mobile/README.md`).
- Trip list/detail, live GPS tracking UI, expense CRUD, delivery offer
  analyzer form, tax mileage reports, performance analytics, and a real
  Dashboard (currently a placeholder).
- A Vercel deployment (requires credentials only the project owner can
  create).

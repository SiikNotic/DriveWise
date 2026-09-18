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
- `apps/web`: Next.js + TypeScript + Tailwind + shadcn/ui (base components:
  Button, Card, Input, Label, Separator), bilingual EN/ES routing, a
  Dashboard placeholder and a working Settings page with a functional
  language switcher.
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

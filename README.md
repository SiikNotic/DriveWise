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
as an edge case — see [Mileage Tracking](#mileage-tracking) for the full
architecture. In short:

1. GPS samples and computed trip distance/duration are written to on-device
   storage first — this never depends on connectivity.
2. A `client_id` (UUID, generated on-device) is attached to every
   locally-created row, before it has ever touched the network.
3. When online, a sync engine pushes pending rows to Supabase, which upserts
   on `(user_id, client_id)`. A dropped connection and retry re-sends the
   same envelope and lands on the same row — no duplicates.
4. Local rows are marked synced once Supabase confirms the write, and stay
   in local storage afterward rather than being deleted immediately.

The envelope/status types for the app-wide sync contract (vehicles,
settings, expenses, offers) are in `packages/shared/src/types/sync.ts`
(`SyncEnvelope`, `SyncQueueItem`, `SyncStatus`). Trip recording has its own,
more detailed local-recording model, since it's the one entity with a live
in-progress state — see `packages/shared/src/types/trip-recording.ts`.

### What stays local vs. what reaches Supabase

- **Always local, never synced**: per-point retry/backoff bookkeeping (how
  many attempts, when to retry next) — meaningless once off the recording
  device. See `StoredTrip` vs. `Trip`.
- **Synced once a trip is completed**: the trip's aggregated distance,
  duration, and (currently) every raw GPS point recorded for it. The
  schema keeps points in their own table specifically so a future
  driver-facing privacy toggle could stop syncing them without a schema
  change — see the comment on `trip_points` in the init migration.
- **Always synced (once online) for everything else**: vehicles,
  `user_settings`, delivery offers, expenses. See `supabase/migrations/`
  for the exact columns.

## Mileage Tracking

The core feature: local-first GPS trip recording, built as a stack of
platform-agnostic abstractions so a native Android/iOS client can reuse the
entire recording/filtering/sync engine and only supply its own GPS and
storage implementations.

### The abstraction layers, and why they're split this way

```
apps/web (platform-specific)          packages/shared (platform-agnostic)
──────────────────────────            ────────────────────────────────────
BrowserLocationProvider       impl →  LocationProvider (interface)
IndexedDbTripStore            impl →  TripStore (interface)
SupabaseSyncTransport         impl →  SyncTransport (interface)
useTripRecorder (React hook)  wires → TripRecorder, SyncQueue (engine)
```

- **`LocationProvider`** (`types/gps.ts`) — "however this platform gets GPS
  fixes." `BrowserLocationProvider` wraps `navigator.geolocation`; a native
  client wraps its own SDK. Nothing above this interface knows which one is
  running.
- **`TripStore`** (`types/trip-recording.ts`) — "however this platform
  persists trips/points on-device." `IndexedDbTripStore` is the web
  implementation; a native client would implement the same interface over
  SQLite. The one invariant every implementation must uphold: a row is
  never deleted (except an explicit driver-initiated discard) until
  `markSyncStatus` records "synced" — that's what "local data survives
  until sync is confirmed" means in code.
- **`SyncTransport`** (`tracking/sync-queue.ts`) — "however this platform
  talks to the backend." `SupabaseSyncTransport` is the web implementation.
- **`TripRecorder`** and **`SyncQueue`** (`tracking/`) — the actual engine,
  built only against the three interfaces above. This is the one piece of
  code a native client reuses completely unchanged.

Changing the GPS provider, the local storage backend, or the sync
transport later is "write one new class," not "rewrite the app" — that
was the explicit design goal.

### Recording flow

`Start Tracking` → `TripRecorder.start()`:
1. Requests location permission, creates a `StoredTrip` (`status:
   "tracking"`) and writes it to `TripStore` immediately.
2. Opens the GPS watch. Every incoming fix goes through two independent
   checks before anything else happens to it:

**1. Is the fix trustworthy?** (`calculations/gps-filter.ts`)
   - **Insufficient accuracy** → rejected if the reported uncertainty
     radius exceeds 50m (a fix with no reported accuracy is let through,
     rather than assuming every provider reports it).
   - **Absurd GPS jump** → rejected if the implied speed from the last
     accepted fix exceeds ~134 mph, or the fix's timestamp isn't after the
     previous one. This catches multipath/urban-canyon teleports without
     needing a map or road network.

**2. Is a trustworthy fix worth writing to storage?** (same file) — this is
the actual battery/storage/point-count control, since a live GPS watch can
emit far more fixes than are useful to keep:
   - Written once the vehicle has moved ≥20m from the last written point,
     **or** every ≥30s regardless (a heartbeat, so idle time like a red
     light still contributes to duration), **or** on a sharp turn (≥30°
     bearing change), so route shape isn't lost between sparse points.
   - After 3 consecutive heartbeat-only points with no real movement,
     heartbeats stop until the vehicle actually moves again — a long stop
     (waiting on a pickup) doesn't accumulate points forever.
   - Every trustworthy fix still updates the live distance/duration and
     the "last known position" used for the next fix's plausibility check,
     whether or not it gets written to storage.

Distance accumulates via the Haversine formula over *accepted* fixes only
(`calculations/distance.ts`); duration is wall-clock time since the trip's
last resume, minus time spent paused — never a naive incrementing counter,
so it stays correct across tab backgrounding.

**Pause** stops the GPS watch (saves battery) and freezes the duration
clock. **Resume** restarts both from exactly where they left off. **Stop**
finalizes the trip (`status: "completed"`, `syncStatus: "pending_sync"`)
— a trip is never pushed to Supabase before this point, so an in-progress
recording never has partial/changing data mid-sync.

### Tolerance to real-world interruptions

- **Internet loss**: recording never touches the network — GPS, filtering,
  and storage all happen purely on-device. Sync just waits.
- **Temporary GPS loss / a bad fix**: surfaced as a status (`searching` /
  `weak`), never auto-pauses or auto-stops the trip. Only the driver's own
  pause/stop does that.
- **Unexpected close / suspended app**: every state change (start, pause,
  resume, a captured point) is written to `TripStore` before that call
  resolves — there is no in-memory-only state to lose. On relaunch,
  `TripRecorder.recoverActiveTrip()` finds anything left `"tracking"` and
  demotes it to `"paused"` rather than silently resuming GPS collection
  after an unknown gap (how long was the app closed? did the vehicle
  move?) — the driver sees it and explicitly taps Resume, which reopens
  the GPS watch cleanly from now.
- **Duplicate sync after a retry**: every trip and point carries a
  `client_id` generated on-device at creation; Supabase upserts on
  `(user_id, client_id)`, so re-pushing the same data after a dropped
  connection is a no-op, not a duplicate. `SyncQueue` also tracks its own
  retry count and an exponential backoff window per trip (capped at 15
  min) so a failing sync doesn't hammer the server.

### What this is honestly not

This is a **web tab**, not a background service. Browsers throttle or
fully suspend `watchPosition` once a tab is backgrounded, the screen
locks, or the OS sleeps the device — no web API changes that on any
platform. `BrowserLocationProvider`'s own doc comment says this explicitly,
and the tracking UI shows the same disclaimer while recording. Reliable
background tracking (recording a trip while the phone is locked in a
driver's pocket) requires a native Android/iOS app with the platform's own
background-location APIs (a foreground service +
`ACCESS_BACKGROUND_LOCATION` on Android; "Always" authorization + a
background mode entitlement on iOS) — which is exactly what the
`LocationProvider` abstraction above is designed to plug in later, without
touching `TripRecorder`, `SyncQueue`, or any UI built on top of them.

### Verified

`pnpm typecheck`/`lint`/`build` all pass. The recording/filtering/sync
engine was exercised directly (compiling `packages/shared` and running it
under Node against fake `LocationProvider`/`TripStore`/`SyncTransport`
implementations that script a full trip): a low-accuracy fix and an
implausible GPS jump are both rejected without moving the odometer; a slow
drift of many small real fixes produces measurably fewer stored points
than raw fixes (proving the capture throttling); pause freezes duration
and stops the GPS watch, resume continues both correctly; stop finalizes
the trip as `completed`/`pending_sync`; and `SyncQueue` correctly marks a
failed push `sync_error` with a backoff window, skips retrying before that
window elapses, succeeds on retry, and never re-pushes an already-synced
trip. What wasn't tested here, and can't be from this sandbox: an actual
browser GPS permission prompt and real `watchPosition` fixes, and the
authenticated dashboard UI end-to-end — the same live-browser limitation
noted under Authentication above.

## Dashboard

Answers four questions immediately, in this order: how much did I make,
how much did I drive, how much did it cost, how much did I *really* earn.
Deliberately no charts — a driver checking this between deliveries needs
numbers, not something to interpret.

- **Visual hierarchy** (`components/dashboard/dashboard-metrics.tsx`): net
  earnings is the one hero tile (per the dataviz skill's "exactly one hero
  per view" rule); earnings/hour, earnings/mile, miles, vehicle cost, gross
  earnings, and expenses follow at equal weight, in that order — matching
  the priority the task itself specified, not an arbitrary grid order.
- **"Today" is the driver's local day, not the server's.** Trip and expense
  totals are fetched and bucketed in the browser (`dashboard-metrics.tsx`
  uses the Supabase browser client, not a Server Component), because a
  server in `iad1` computing "today" in UTC would silently shift which
  trips count as "today" for anyone driving outside that timezone. Expense
  dates (`incurred_on`) are a plain SQL `date` with no timezone attached at
  all, so they're compared directly.
- **Vehicle cost** for the period is miles driven × the *active* vehicle's
  total operating cost per mile (see [Vehicle Profile](#vehicle-profile)) —
  computed server-side once at page load, since it only changes when the
  driver edits a vehicle or changes their active one.
- **Earnings per mile/hour are net, not gross** — deliberately. The whole
  premise of DriveWise's "how much did I *really* earn" question is that
  gross pay overstates what driving is worth; showing gross-based rates
  here would undercut the same message the hero tile leads with.
- **Current tracking status** lives in `TrackingPanel` itself (already
  built for [Mileage Tracking](#mileage-tracking)) rather than as a
  separate card, since duplicating a second "trip in progress" display
  next to the one that already has Start/Pause/Stop would just be
  confusing. It now also shows live $/mile and $/hour — computed against
  an optional "expected pay" the driver can enter while tracking (there's
  no live earnings source otherwise; delivery-offer pay entry is separate,
  future work). Nothing here is fabricated: with no expected pay entered,
  both read as "—", never a guessed number.
- **Weekly summary** is a plain rolling 7-day total (including today) in a
  compact stat row, not a second dashboard's worth of tiles.
- **A real gap, made honest rather than hidden**: gross earnings and
  expenses can only reflect data a driver has actually entered. Since
  Expense CRUD and the delivery-offer pay flow are both still "planned,
  not yet built" (see below), those numbers legitimately read $0.00 until
  either ships — this dashboard reads real data, including the real
  absence of it, rather than showing placeholder figures. The one bridge
  built now: stopping a trip has an optional Earnings/Tips field (see
  Mileage Tracking's stop flow), so gross/net earnings have at least one
  real path to a nonzero number today.

**Verified**: typecheck/lint/build clean; every `(app)` route (including
this one) was re-checked over HTTP against a real production build for
the same Server/Client-boundary class of bug the Vehicle Profile work
caught on the design-system page — none found here. The aggregation
queries and local-day bucketing logic were reviewed against the schema
directly (`trips.ended_at` is `timestamptz`, `expenses.incurred_on` is a
bare `date` — confirmed in the migrations) rather than assumed. Actually
loading the dashboard with a real, authenticated session and real trip
history is the one thing this sandbox can't do — the same limitation
noted throughout this README.

## Delivery Offer Analyzer

DriveWise's main differentiating feature: before a driver taps Accept on a
gig-platform offer, they can run it through a fast, transparent breakdown
that accounts for their own vehicle's real operating cost — not just the
platform's advertised pay.

- **Five inputs, nothing else** (`components/offers/offer-form.tsx`): offer
  payout, delivery miles and estimated time are required; return miles and
  extra wait time are optional. There is no "Analyze" button — the entire
  breakdown recomputes on every keystroke (the same live-preview pattern as
  the Vehicle Profile's cost form), because the task's explicit requirement
  is a driver being able to enter an offer in a few seconds, often while a
  timer on the platform's own app is running.
- **Uses the driver's actual active vehicle**, not a generic estimate: the
  page server-fetches the active vehicle (same `user_settings.default_vehicle_id`
  pattern as the Dashboard) and its full operating-cost breakdown via the
  existing `calculateVehicleOperatingCost` — no separate cost model was
  built for this feature, it reuses Vehicle Profile's exactly. If no active
  vehicle is set, a warning banner says so and the estimate proceeds with
  $0 vehicle cost rather than silently guessing.
- **`analyzeDeliveryOffer`** (`packages/shared/src/calculations/offer-analyzer.ts`)
  computes gross payout, total miles (delivery + return), total time
  (estimated + extra wait), vehicle cost, estimated net, gross **and** net
  $/mile, and gross **and** net $/hour — verified against the spec's worked
  example ($9.50 offer, 4.2 mi, 28 min, 2 mi return, $0.47/mi cost → $2.91
  vehicle cost, $6.59 net, exactly).
- **Never a single collapsed verdict.** The explicit requirement was "no
  utilices únicamente dollars-per-mile" — so the analysis produces two
  *independent* booleans, `meetsHourlyTarget` and `meetsPerMileTarget`,
  each shown as its own `StatusBadge` ("Meets your minimum hourly target" /
  "Below your minimum hourly target", and the same for per-mile). An offer
  can clear one bar and miss the other; the UI shows both, never merges
  them into one accept/reject signal.
- **Not a verdict at all.** There is no Accept/Reject recommendation
  anywhere in the UI — only the numbers and the two factor badges, plus an
  explicit disclaimer ("This is an estimate to help you decide — not a
  recommendation to accept or decline this offer."), matching the same
  "these are estimates" framing established by the Vehicle Profile's own
  cost disclaimer.
- **The two thresholds are driver-configurable**, not hardcoded: added as
  `user_settings.min_hourly_earnings_usd` / `min_per_mile_earnings_usd`
  (default $20/hr, $1/mi). They're editable from Settings and, since the
  driver shouldn't have to leave the analyzer to change what "worth it"
  means to them, inline on the Offer Analyzer page itself
  (`components/offers/thresholds-form.tsx`, one Server Action, two render
  sites).
- **A full, step-by-step calculation trail** is always visible (never
  collapsed behind a toggle) below the headline numbers — total miles,
  total time, vehicle cost, estimated net, and all four $/mile and $/hour
  figures, each as its own labeled row, so a driver can see exactly how
  the final numbers were derived rather than trusting a black box.
- **Optional Accept/Decline** buttons record the driver's decision into the
  pre-existing `delivery_offers` table (it anticipated this feature from
  the initial schema). This is deliberately the *only* thing built against
  that table — no offers list/history page exists yet, matching the same
  scope discipline applied to Trip list/detail (see below): recording is
  implemented, browsing past decisions is not.

**Verified**: the core formula was checked against the spec's worked
example by hand and by an isolated Node script before wiring it into the
UI; typecheck/lint/build clean; every `(app)` route including `/offers`
re-checked against a production build with no runtime/RSC errors.

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
- Full Mileage Tracking engine (see [Mileage Tracking](#mileage-tracking)):
  local-first GPS recording with start/pause/resume/stop, GPS filtering and
  battery/storage-efficient point capture, crash/suspend recovery, and an
  idempotent sync queue.
- A real Dashboard (see [Dashboard](#dashboard)): today's net/gross
  earnings, vehicle cost, miles, earnings per mile/hour, a rolling 7-day
  summary, and the live tracking status — no charts, exact priority order.
- The Delivery Offer Analyzer (see
  [Delivery Offer Analyzer](#delivery-offer-analyzer)): a fast, transparent,
  multi-factor breakdown of any delivery offer against the driver's real
  vehicle cost and their own configurable $/hour and $/mile targets — never
  a single collapsed verdict.
- Settings page: profile fields, language switcher, theme switcher, Offer
  Analyzer targets.
- A live deployment on Vercel (see [Deploying](#deploying-github--vercel)).

**Planned, not yet built:**
- The actual `apps/mobile` Expo app (architecture documented in
  `apps/mobile/README.md`) — the native `LocationProvider`/`TripStore`
  implementations Mileage Tracking's abstractions are designed for.
- Trip list/detail (browsing past trips — recording them is implemented),
  expense CRUD, an offers list/history page (analyzing and recording a
  decision is implemented — see
  [Delivery Offer Analyzer](#delivery-offer-analyzer)), tax mileage
  reports, performance analytics.

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
  mobile/    Expo/React Native app — background GPS trip tracking.
             See apps/mobile/README.md (implemented; not yet compiled to an APK).
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
  service) — implemented; see `apps/mobile/README.md` for what's actually
  there and the one remaining step (compiling it to an APK) it can't do
  unattended.

Both apps import `@drivewise/shared` for domain types and calculations, so a
mile or a dollar computed on one platform is computed the same way on the
other.

## Offline-First Architecture

The app must keep working with no internet connection at all, not just
degrade gracefully — this governs trips (see
[Mileage Tracking](#mileage-tracking)) and expenses (see
[Expense Tracking](#expense-tracking)) end to end: every create/edit/delete
for either one writes to on-device storage first and never blocks on a
network round trip.

**Local database.** Each syncable domain gets its own IndexedDB database in
the browser (`drivewise-tracking` for trips/points,
`drivewise-expenses` for expenses), written through a small
platform-abstraction interface (`TripStore`, `ExpenseStore` in
`packages/shared/src/types/`) rather than talked to directly outside of one
`IndexedDb*Store` class per domain — the same interface a native mobile
client would implement over SQLite instead, unchanged by everything above
it (`TripRecorder`, the forms, `SyncQueue`).

**Sync status — one 5-state model for every syncable record**
(`SyncStatus` in `packages/shared/src/types/sync.ts`):

| State | Meaning |
| --- | --- |
| `local` | Just created on-device; not yet queued for a sync attempt (a trip is `local` for its whole tracking/paused lifetime — nothing to push until it's complete). |
| `pending` | Queued and eligible; waiting for connectivity or its backoff window. |
| `syncing` | A push is in flight right now. |
| `synced` | The server has confirmed this exact record, by `clientId`. |
| `failed` | The last attempt errored; the queue retries it automatically once its backoff window elapses. |

**Sync queue.** One generic class, `SyncQueue<T>`
(`packages/shared/src/tracking/sync-queue.ts`), implements the whole
`local -> pending -> syncing -> synced/failed` state machine once; trips
and expenses each supply their own `SyncableStore` (IndexedDB) and
`SyncTransport` (`push(item)`, over the Supabase browser client) rather
than reimplementing retry/backoff/idempotency per domain. It's drained
immediately on mount, on a 30s interval, and whenever the browser's
`online` event fires — from more than one place per domain (e.g. both the
Dashboard's tracking hook and the Trips list run the trip queue), so a
pending record doesn't wait for a specific page to be open to sync.

**Retry mechanism.** A failed push is retried with exponential backoff
(`min(baseBackoffMs * 2^(attempt-1), maxBackoffMs)`, default base 15s,
cap 15 min) — see `SyncQueue.recordFailure`. A record stuck in `syncing`
for more than `STALE_SYNCING_MS` (2 minutes) is treated as abandoned (the
tab that started the push closed or crashed mid-flight) and retried too —
safe because every transport's `push` is required to be idempotent.

**Idempotency.** Every syncable record gets a `clientId` (UUID) the moment
it's created on-device, before it has ever touched the network. The server
table has `unique (user_id, client_id)`, and every push is a Postgres
`upsert(..., { onConflict: "user_id,client_id" })` — pushing the same
record twice (a genuine retry, or a reclaimed stale `syncing` state) always
lands on the same row. This is the one mechanism the "no duplicados"
requirement rests on; it isn't something the queue itself has to reason
about, only rely on.

**Conflict handling.** Rather than a runtime merge/CRDT algorithm, conflicts
are prevented by construction: a record is mutated locally (IndexedDB) only
before its first successful sync; once `synced`, every further edit or
delete goes straight to the Server Action / Supabase row directly (see
`trip-source.ts` and `expense-source.ts`'s dual dispatch — `syncStatus`
alone decides which path an edit takes). There is never a local shadow copy
drifting against a server row that's also being written from elsewhere, so
there is no last-write-wins clock to get wrong.

**No data loss.** A local row is never deleted (outside an explicit
driver-initiated delete/discard) until `markSyncStatus` has recorded
`"synced"` — the same invariant `TripStore`'s original doc comment states,
now shared by `ExpenseStore` too.

**What's local-only vs. synced**: retry bookkeeping (attempt count,
backoff, last error) is meaningless once off the device that's trying to
sync and is never sent to Supabase — a row that exists in `trips` or
`expenses` at all is, by construction, already synced. Raw GPS points are
the one payload that's genuinely large; they're kept in their own table
(`trip_points`) so a future privacy toggle could stop syncing them without
a schema change — see that table's comment in the init migration.
Attaching a receipt photo to an expense is the one action that still
requires connectivity (see [Expense Tracking](#expense-tracking)'s scope
note) — the expense record itself never does.

**Verified**: `packages/shared/src/tracking/sync-queue.test.ts` exercises
the real `SyncQueue` (not a mock of it) against a fake in-memory store —
idempotent re-runs, exponential backoff timing, backoff-window
enforcement, and stale-`syncing` reclamation — via `pnpm test`. See
[Live-tested: the offline scenario](#live-tested-the-offline-scenario)
below for what was and wasn't verified end-to-end against the live
deployment and database.

### Live-tested: the offline scenario

The full interactive script (open the app, go offline, record a trip,
close the tab, reopen it, come back online, watch it sync, confirm one
row) needs a real browser driving the real deployed app against the real
Supabase project. The build environment this was developed in restricts
outbound network access to a small allow-list (package registries, the
Anthropic API) and blocks direct connections to `*.vercel.app` and
`*.supabase.co` — so a browser automation tool running there can't reach
either. What follows is what could and couldn't be checked given that
constraint, stated plainly rather than glossed over:

**Actually run against the live project:**
- **Idempotency at the database, with real rows, not a simulation.** Using
  the same `client_id` DriveWise itself generates on-device, two separate
  `insert ... on conflict (user_id, client_id) do update` statements were
  issued back-to-back against the production `trips` and `expenses`
  tables — reproducing exactly what `SyncQueue` does on a retry after a
  dropped acknowledgment. Both pushes returned the *same* row `id`, and a
  `count(*)` for that `client_id` was `1` in both tables. This is the
  actual mechanism the task's step 8 ("verify only one record exists")
  depends on, exercised directly, not inferred from reading the code. The
  test rows were deleted afterward.
- **Protected routes reject unauthenticated access on the live deployment**,
  fetched directly from `https://drivewise-roan.vercel.app` (not
  localhost): `/en`, `/en/trips`, `/en/expenses`, `/en/analytics`,
  `/en/reports`, `/en/vehicles`, `/en/offers` all server-redirected to
  `/en/login` with no client-side gap.
- **No untranslated strings and full EN/ES key parity**: the rendered
  `/en/login` and `/es/login` payloads embed the complete message bundle
  for the active locale; a script diffing `messages/en.json` against
  `messages/es.json` found 480/480 keys present in both, with zero keys
  missing in either direction. (The 5 keys with identical EN/ES values are
  the brand name and words that are genuinely the same in Spanish, e.g.
  "Personal" — not missed translations.)
- **No 5xx responses or server-side runtime errors** on any of the above
  routes, and zero runtime error clusters reported for the project in the
  hour surrounding this work (`get_runtime_errors`).
- **Static horizontal-overflow audit**: no fixed pixel widths
  (`w-[…px]`/`min-w-[…px]` above small popover sizes) and no raw `<table>`
  markup anywhere in `apps/web/src`, which is the usual source of
  accidental horizontal scroll on a 320px viewport; list views use
  card layouts instead of tables.

**Not run, and why**: the parts of the script that require an
authenticated session driving real forms in a real browser — sign up,
start/stop a GPS trip, toggle the browser offline, close and reopen the
tab, add an expense, watch the sync-status badge move through
`local → pending → syncing → synced`, resize the viewport across the six
breakpoints and watch for scrollbars, exercise Settings/logout — could not
be executed from this environment for the network reason above.
`packages/shared/src/tracking/sync-queue.test.ts` covers the queue's own
retry/backoff/idempotency logic in isolation (see above), and the
database-level check above covers the specific "no duplicates" guarantee,
but neither one drives the actual UI. Running the interactive script
end-to-end — ideally with a Playwright session that has real network
access to the deployed app — is the one piece of this task still owed.

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

## Trip History

Browsing and managing the trips Mileage Tracking already records — the
"planned, not yet built" list/detail view from earlier turns.

- **List** (`/trips`, `components/trips/trips-list.tsx`): Today / This week /
  This month / All trips tabs, using the same "the driver's local day, not
  the server's" bucketing as the Dashboard. Each row shows date, start/end
  time, duration, miles, vehicle, purpose, and sync status.
- **The list is a merge of two sources that never overlap**
  (`lib/trips/trip-source.ts`): trips still only in IndexedDB (not yet
  synced — `pending_sync`/`sync_error`) and trips already synced to
  Supabase. A trip is in exactly one list at a time: the background
  `SyncQueue` (already built for Mileage Tracking) marks a local trip
  "synced" the moment it pushes successfully, at which point it drops out
  of the local list and appears in the Supabase one on the next fetch.
  Idempotency (**no duplicar viajes durante sincronización**) was already
  guaranteed at the sync-engine level via `unique (user_id, client_id)` +
  upsert (see Mileage Tracking) — this feature only had to consume that
  correctly, not re-solve it.
- **No trip is ever lost while offline**: `listCompletedTrips` (new
  `TripStore` method) returns every completed trip on-device regardless of
  sync state, so a trip recorded with no connection shows up immediately
  with a "Pending sync" badge — never silently missing until it happens to
  sync. The Trips list also runs its own `SyncQueue.runOnce()` on mount, on
  a 30s interval, and on the browser's `online` event (mirroring
  `useTripRecorder`'s own polling), so pending trips flip to "Synced" live
  even if the driver never visits the Dashboard in that session.
- **Detail** (`/trips/[clientId]`, routed by the client-generated id since
  that's the one identifier stable across both backends): total miles,
  duration, average speed, start/end time, vehicle, an estimated vehicle
  cost (using *that trip's own* assigned vehicle's cost/mile, not
  necessarily the currently-active one), and business miles. Editing the
  purpose or deleting a trip dispatches to a Server Action once synced, or
  straight to IndexedDB while still local — the same dual-backend pattern
  as the list, kept in one place (`trip-source.ts`) rather than duplicated
  per component.
- **Route rendering** (`components/trips/trip-route-map.tsx`): a real
  interactive Mapbox map (street tiles, pan/zoom, start/end pins, the
  recorded route as a line) via `mapbox-gl`, gated on
  `NEXT_PUBLIC_MAPBOX_TOKEN` — `mapbox-gl` only ever loads client-side
  (it reads `window` at import time) via `next/dynamic`, and only when a
  token is actually configured. Without one, it falls back to
  `components/trips/route-map.tsx`: a dependency-free SVG polyline plot of
  the trip's recorded GPS points (equirectangular-corrected so it isn't
  stretched) — no basemap, but the points are already available
  client-side (from `trip_points`, synced or local) without a network
  call, so it still works fully offline on its own.
- **Offline is shown explicitly**, not just implied: a banner reads "You're
  offline — recent trips are saved on this device and will sync
  automatically" whenever `navigator.onLine` is false, in addition to each
  trip's own sync-status badge.

**Scope boundary**: manually adding a trip (no GPS recording) is not built
— the "Add trip manually" button visible in earlier i18n scaffolding stays
unwired. This feature is about browsing and managing trips Mileage
Tracking already recorded, not a second way to create one.

**Verified**: typecheck/lint/build clean; `/trips` and `/trips/[clientId]`
re-checked against a production build (redirect to login when
unauthenticated, no runtime/RSC errors) alongside every other `(app)`
route.

## Analytics

Daily/Weekly/Monthly performance, built entirely from real recorded data —
no placeholder or estimated figures anywhere in this feature.

- **Two kinds of metric, deliberately scoped differently**
  (`lib/analytics/aggregate.ts`): "activity" metrics (Miles, Average trip
  distance, Average trip duration) count *every* completed trip regardless
  of purpose — that's how far the driver actually drove. Everything
  earnings/cost-related (Gross/Net earnings, Vehicle costs, Business miles,
  Earnings per mile/hour, Net earnings per mile) is scoped to **business**
  trips only, matching the Dashboard's existing convention: a personal or
  commute trip has no gig pay to count, and letting it dilute the cost/rate
  math would misrepresent what driving for work actually earns.
- **Vehicle costs** use the same `calculateVehicleOperatingCost` as every
  other feature (Vehicle Profile, Dashboard, Offer Analyzer) — business
  miles × the active vehicle's real cost/mile, never a separate estimate.
- **Comparison, not just a snapshot**: each tab compares the current period
  to the immediately preceding equal-length one — today vs. yesterday,
  this rolling 7 days vs. the 7 before that (same convention as the
  Dashboard's own week), this calendar month vs. last. Rendered through
  `MetricCard`'s existing delta affordance (already built with comparison
  in mind), colored by whether an increase is actually good for that
  metric — an increase in Vehicle costs or Total expenses is red, not
  green, the same principle already established for cost-per-mile.
- **Two trend charts, not a wall of decoration**: net earnings and net
  earnings per mile over time (14 days / 8 weeks / 6 months, depending on
  the active tab) — chosen because they directly answer "how much do I
  earn" and "how is my efficiency changing," the two things the task asked
  the driver be able to see change over time. No third or fourth chart was
  added just to fill space; both reuse one generic `TrendChart` component
  rather than duplicating the same Recharts setup twice.
- **No invented data**: Total expenses reads real Supabase `expenses` rows
  — since Expense CRUD is still "planned, not yet built" (see below), this
  legitimately reads $0.00 for every driver today, the same honest-gap
  approach already taken on the Dashboard rather than fabricating a
  plausible-looking number.
- All aggregation happens client-side, over one bounded 7-month fetch of
  trips/expenses (enough to cover the longest trend window plus its own
  comparison period), computed in the browser against the driver's local
  clock — consistent with the Dashboard and Trips list's own "the driver's
  local day, not the server's" principle, so period boundaries never shift
  for someone outside the deployment's timezone.

**Verified**: the aggregation is pure, dependency-free functions
(`computeMetrics`/`computeAnalytics`) exercised by hand against constructed
trip/expense fixtures before wiring into the UI; typecheck/lint/build
clean; `/analytics` re-checked against a production build alongside every
other `(app)` route.

## Expense Tracking

Fuel, maintenance, repairs, insurance, tolls, parking, car wash, and other
driving costs — a fixed initial taxonomy of 8 categories
(`ExpenseCategory` in `packages/shared/src/types/expense.ts`), matching
what the task specified rather than the broader set an earlier turn had
scaffolded (`vehicle_payment`/`phone_plan`/`supplies`/`parking_tolls` were
dropped, `repairs`/`tolls`/`parking`/`car_wash` added) — a clean migration
since no Expense CRUD UI had ever shipped against the old values.

- **Server-rendered CRUD** (`/expenses`, `/expenses/new`, `/expenses/[id]/edit`),
  the same pattern as Vehicle Profile — unlike Trips, an expense has no
  offline/local-first recording concern (it's entered after the fact, not
  captured live by a GPS engine), so there's no IndexedDB layer here.
- **Receipts use Supabase Storage's private `receipts` bucket**, which
  already existed from the very first migration (`20260918021257_storage_receipts.sql`)
  with exactly the RLS this feature needed: every object's path is
  `<user_id>/<filename>`, and `select`/`insert`/`update`/`delete` policies
  all check `(storage.foldername(name))[1] = auth.uid()`. **A user
  cannot access another user's receipts** — enforced by Postgres RLS on
  `storage.objects` itself, not by application code that could have a
  bug. `getReceiptSignedUrlAction` adds a second, defense-in-depth check
  (the path's own prefix must match the caller's `uid`) before ever asking
  Storage for a signed URL, but the real guarantee is the RLS policy.
- **"Tomar o subir recibos"**: the receipt `<input type="file">` sets
  `accept="image/*"` and `capture="environment"` — on a phone browser this
  opens the rear camera directly, while still letting the driver pick an
  existing photo instead. No native camera API or `apps/mobile` code was
  needed for this on web.
- **Monthly totals and category totals** are computed server-side from the
  same fetched expense list the history view already renders — no separate
  aggregation endpoint, since expense volume per driver is small enough
  that summing in the page component is simply the right amount of
  engineering.
- **`is_tax_deductible` is deliberately not exposed** in the form, even
  though the column exists (default `true`) from the original schema.
  Surfacing a per-expense "is this tax deductible?" toggle would assert a
  jurisdiction-specific tax judgment DriveWise has no basis to make — see
  the same concern addressed more fully in [Reports](#reports).

**Verified**: `get_advisors` re-run after the category migration (only the
pre-existing, unrelated leaked-password-protection warning); typecheck/
lint/build clean; every expense route re-checked against a production
build.

## Reports

Mileage, expense, and earnings reports over any date range — filterable by
vehicle and trip type, exportable as CSV, and explicitly **not** tax
advice.

- **One shared filtered dataset, three tabs**: date range, vehicle, and
  trip-type (Business/Personal/Commute/All) filters apply uniformly
  (`lib/reports/aggregate.ts`'s `filterTrips`/`filterExpenses`) before any
  tab-specific view renders — picking "Business" correctly zeroes out
  Personal/Commute miles in the summary rather than the summary and the
  detail table quietly using two different filtered sets. Only the date
  range triggers a new Supabase fetch; vehicle and trip-type narrow
  client-side against the already-fetched range.
- **The six requested totals** (business/personal/commute miles, total
  expenses, total vehicle operating cost, gross/net earnings) always show
  together regardless of which report tab is active — Mileage, Expense,
  and Earnings differ only in which detail table and CSV export follow the
  same summary.
- **Vehicle operating cost is computed per-trip, from that trip's own
  assigned vehicle** — not the currently active one. A report spanning
  multiple vehicles needs each vehicle's real cost/mile
  (`calculateVehicleOperatingCost`, keyed by `vehicle_id` into a lookup
  map), the same function every other feature uses, never a second cost
  model. It stays scoped to business trips, matching the Dashboard's and
  Analytics' existing "vehicle cost only counts against the earnings it
  produced" convention — one definition of vehicle cost everywhere in the
  app, not three different ones per feature.
- **No jurisdiction-specific tax assumptions.** The one mileage-adjacent
  figure this feature shows — business miles × the driver's own configured
  `standardMileageRateUsd` — is labeled "Reference calculation," not
  "Deduction," and every place it appears carries an explicit disclaimer:
  *"This is an informational reference, not tax advice. Mileage and
  deduction rules vary by jurisdiction — verify what applies to you before
  filing anything."* Nothing in this feature computes or claims a specific
  deduction amount, an eligibility determination, or which method applies
  in the driver's jurisdiction.
- **Built to add a second calculation method later without restructuring**:
  `computeMileageReference` takes an explicit `MileageReferenceMethod`
  union (currently just `"standard_mileage_rate"`) and switches on it,
  specifically so an `"actual_expenses"` method (business-use % × real
  vehicle costs) can be added as a second case later — every caller
  already passes the method explicitly rather than assuming one.
- **CSV export**, not PDF — a plain client-side CSV builder (no library
  dependency) exports whichever tab is currently active, scoped to the
  same filtered rows the screen shows. No "Export PDF" was built despite
  early i18n scaffolding suggesting one; only what actually works ships.

**Verified**: `computeReportSummary` checked by hand against a constructed
multi-vehicle, multi-purpose fixture (same rigor as Analytics'
`computeMetrics`) before wiring into the UI; typecheck/lint/build clean;
`/reports` re-checked against a production build.

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
  With eight destinations now, the phone tab bar shows only the four a
  driver reaches for most while working (Dashboard/Trips/Offers/Vehicles,
  `MOBILE_PRIMARY_HREFS`) plus a "More" tab that opens the rest
  (Analytics/Expenses/Reports/Settings) in a dialog, rather than shrinking
  eight equal-width tabs past a reliable tap target. The desktop top bar
  still renders every item directly (`flex-wrap`, so it degrades to a
  second line rather than overflowing on narrower tablet widths).

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
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_MAPBOX_TOKEN`) in the Vercel project's Environment
   Variables settings, for Production, Preview, and Development.
5. Push to a branch to get a Preview Deployment; push/merge to the
   production branch to deploy to production.

A Vercel project is live at this point (see the badge/link in the intro).

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
- Trip History (see [Trip History](#trip-history)): a Today/This week/This
  month/All trips list and a per-trip detail view (route rendering, edit
  classification, delete), merging trips still local-only with ones already
  synced so nothing recorded is ever missing or duplicated.
- The Delivery Offer Analyzer (see
  [Delivery Offer Analyzer](#delivery-offer-analyzer)): a fast, transparent,
  multi-factor breakdown of any delivery offer against the driver's real
  vehicle cost and their own configurable $/hour and $/mile targets — never
  a single collapsed verdict.
- Analytics (see [Analytics](#analytics)): Daily/Weekly/Monthly performance
  across 11 real metrics, period-over-period comparison, and two trend
  charts — no invented or placeholder figures anywhere in it. Its "Total
  expenses" metric now reads real data, since Expense Tracking shipped
  after it.
- Full Expense Tracking (see [Expense Tracking](#expense-tracking)):
  add/edit/delete/history, monthly and category totals, and receipt
  photos in a private Supabase Storage bucket with RLS that already
  prevented cross-user access before this feature ever consumed it.
- Reports (see [Reports](#reports)): Mileage/Expense/Earnings reports over
  any date range, filterable by vehicle and trip type, exportable as CSV —
  explicitly labeled as informational, never tax advice.
- The Delivery Offer Analyzer (see
  [Delivery Offer Analyzer](#delivery-offer-analyzer)): a fast, transparent,
  multi-factor breakdown of any delivery offer against the driver's real
  vehicle cost and their own configurable $/hour and $/mile targets — never
  a single collapsed verdict.
- Settings page: profile fields, language switcher, theme switcher, Offer
  Analyzer targets.
- A live deployment on Vercel (see [Deploying](#deploying-github--vercel)).

**Planned, not yet built:**
- Compiling `apps/mobile` into an installable APK — the app itself
  (background GPS tracking, local SQLite storage, sync, auth, trip list) is
  implemented; see `apps/mobile/README.md`'s "Getting the APK" section for
  the `eas build` command needed to actually produce the binary.
- Manually adding a trip with no GPS recording (see
  [Trip History](#trip-history)'s scope note), an offers list/history page
  (analyzing and recording a decision is implemented — see
  [Delivery Offer Analyzer](#delivery-offer-analyzer)), PDF export for
  Reports (CSV is implemented — see [Reports](#reports)), a second
  mileage-reference calculation method (the system is structured for one —
  see [Reports](#reports)).

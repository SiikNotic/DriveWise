# DriveWise Mobile — Tracking Layer

**Status: architecture only.** This app is not scaffolded yet. This document
describes the planned design so the next increment can implement it against
an agreed shape instead of guessing.

## Why this has to be a native app, not the web dashboard

A browser tab cannot be trusted to keep recording GPS once a driver locks
their phone, switches apps, or the OS decides to suspend the tab to save
battery — every mobile OS aggressively kills background browser work, and
there is no web API that overrides that. Nothing in `apps/web` should ever
imply otherwise. Reliable background location requires a real mobile app
using the platform's background-execution APIs:

- **iOS**: `UIBackgroundModes: location`, which keeps the process alive for
  location updates while backgrounded, plus explicit "Always" location
  permission (not just "While Using").
- **Android**: a foreground service with a persistent notification, plus the
  `ACCESS_BACKGROUND_LOCATION` permission (requested only after "while in
  use" is already granted, per Play Store policy).

## Planned stack

- **Expo (React Native + TypeScript)** — one codebase for iOS and Android,
  with config plugins for the background-location entitlements above.
- **`expo-location` + `expo-task-manager`** — GPS sampling and the
  background task definition that keeps running after the app is backgrounded.
- **`expo-sqlite`** (or a thin wrapper) — the on-device database. Every trip
  and GPS point is written here first, synchronously, before anything ever
  touches the network.
- **`@drivewise/shared`** (the same package `apps/web` uses) — domain types
  (`Trip`, `TripPoint`, `DeliveryOffer`, `Vehicle`, `Expense`), the
  `SyncEnvelope`/`SyncQueueItem` contract, and the calculation functions
  (`haversineDistanceMiles`, `analyzeDeliveryOffer`, `calculateCostPerMileUsd`,
  `getStandardMileageRate`). Mobile and web must never re-implement these —
  a mile calculated on-device and a mile calculated in a web report have to
  agree.
- **`@supabase/supabase-js`** — same `Database` type from
  `@drivewise/shared`, used only by the sync engine described below, never
  directly by UI screens.

## Data flow

```
GPS sample (expo-location, background task)
  -> append to local trip_points table (expo-sqlite), tagged with a
     client-generated trip_id + monotonic sequence
  -> on trip end: aggregate distance (sumRouteDistanceMiles) and duration
     locally, write a local trips row, mark is_pending_sync = true
  -> sync engine (foreground + periodic background fetch) picks up
     pending rows, wraps each in a SyncEnvelope { clientId, ... }, and
     upserts to Supabase on (user_id, client_id)
  -> on confirmed write, mark the local row synced; keep it locally for a
     retention window before pruning, in case the confirmation itself
     was lost to a dropped connection
```

The `client_id` (a UUID generated on-device at creation time, never
server-assigned) is what makes retries safe: Supabase upserts on
`(user_id, client_id)`, so replaying a sync after a dropped connection
updates the same row instead of duplicating it. See
`packages/shared/src/types/sync.ts` and the `unique (user_id, client_id)`
constraints in `supabase/migrations/`.

### Offline behavior (the default assumption, not an edge case)

- Losing connectivity mid-trip never stops GPS recording or local distance
  calculation — both only ever depend on the device, never the network.
  Nothing in the tracking loop should have a network call anywhere near it.
- Every trip is fully usable (visible, editable, exportable) from local
  storage alone before it has ever synced.
- The sync engine is the only part of this app allowed to know whether the
  device is online, and it degrades to "retry later" instead of surfacing
  errors to the driver.

## What stays local-only vs. what syncs to Supabase

- **Always local, only aggregated data syncs**: raw `trip_points` (the
  full-resolution GPS trail). Only a simplified polyline
  (`trips.route_simplified`) plus the aggregate distance/duration sync by
  default, to keep sync payloads small and limit how much precise location
  history leaves the device. Syncing full-resolution points is an opt-in
  setting for drivers who want it (e.g., for a detailed trip map), backed by
  the `trip_points` table that already exists in the schema.
- **Always syncs once online**: trips (aggregated), delivery offers,
  expenses, vehicles, user settings — the tables in
  `supabase/migrations/20260918021136_init_schema.sql`.

## What this increment deliberately does not include

- No Expo project has been generated yet (no `app.json`, no native config,
  no screens). Scaffolding it is real, non-trivial work — pnpm + Metro
  monorepo resolution in particular needs to be gotten right — and belongs
  in its own reviewable step, not bundled into the architecture pass.
- No UI screens (trip list, live tracking map, offer analyzer form, etc.) —
  those come after both apps share a stable `@drivewise/shared` contract.

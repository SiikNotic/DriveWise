# DriveWise Mobile

**Status: implemented (v1) — not yet built into an installable APK.** A real
Expo/React Native app with background GPS tracking, offline-first local
storage, and the same Supabase backend `apps/web` uses. See
[Getting the APK](#getting-the-apk) for the one thing this repo can't do on
its own: produce the compiled binary.

## Why this has to be a native app, not the web dashboard

A browser tab cannot be trusted to keep recording GPS once a driver locks
their phone, switches apps, or the OS decides to suspend the tab to save
battery — every mobile OS aggressively kills background browser work, and
there is no web API that overrides that. Nothing in `apps/web` implies
otherwise (see that app's own `RouteMap`/tracking docs). Reliable background
location requires a real mobile app using the platform's background-execution
APIs:

- **Android** (implemented here): a foreground service with a persistent
  notification (`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`), plus
  `ACCESS_BACKGROUND_LOCATION` — requested only *after* "while in use" is
  already granted, per Play Store policy. See `ExpoLocationProvider`.
- **iOS**: `UIBackgroundModes: location` plus "Always" location authorization
  — the `app.json` entitlements for this are already in place; iOS-specific
  testing hasn't been done yet (this increment was built and verified for
  Android, since that's what was asked for).

## What's actually here

```
apps/mobile/
  app.json            — Expo config: background-location permissions/plugins
  eas.json            — EAS Build profiles (preview → .apk, production → .aab)
  metro.config.js      — pnpm-workspace-aware Metro resolution
  App.tsx / index.ts   — entry point; registers the background task before
                          anything renders (see background-task.ts)
  src/
    theme.ts           — DriveWise's teal brand color, hand-kept in sync
                          with apps/web's globals.css (no shared CSS exists
                          between the two platforms)
    lib/
      supabase.ts               — Supabase client (AsyncStorage session persistence)
      trip-source.ts            — local+server trip merge, mirrors apps/web's trip-source.ts
      location/
        background-task.ts      — TaskManager.defineTask, module-scope registration
        expo-location-provider.ts — implements @drivewise/shared's LocationProvider
      storage/
        sqlite-trip-store.ts    — implements TripStore over expo-sqlite
      sync/
        supabase-sync-transport.ts — implements SyncTransport<StoredTrip>
    hooks/
      use-trip-recorder.ts — wires TripRecorder + SyncQueue to React, mirrors
                             apps/web's use-trip-recorder.ts
      use-session.ts       — Supabase auth session state
      use-online-status.ts — NetInfo-backed connectivity (hook + ref variant)
    navigation/
      RootNavigator.tsx    — session-gated: auth stack vs. app tabs
    screens/
      LoginScreen.tsx, SignUpScreen.tsx
      TrackingScreen.tsx   — vehicle/purpose pickers, start/pause/resume/stop,
                             live distance/duration/GPS status
      TripsScreen.tsx      — local+synced trip list with sync-status labels
      SettingsScreen.tsx   — sign out
```

`@drivewise/shared` — the same package `apps/web` imports — supplies every
piece of domain logic this app reuses unchanged: `TripRecorder` (the
start/pause/resume/stop state machine and GPS-fix filtering), `SyncQueue`
(retry/backoff/idempotency), and the `LocationProvider`/`TripStore`/
`SyncTransport` interfaces this app's three platform-specific classes
implement. None of that logic is duplicated or reimplemented here — see
`packages/shared/src/tracking/trip-recorder.ts` and `sync-queue.ts`.

## Data flow

```
GPS sample (expo-location, background task)
  -> ExpoLocationProvider delivers it to TripRecorder (packages/shared)
  -> TripRecorder filters it (gps-filter.ts), updates distance/duration,
     writes the point + updated trip row to SqliteTripStore — synchronously,
     before anything touches the network
  -> on trip end: trip flips to sync_status "pending"
  -> SyncQueue (polled every 30s, see use-trip-recorder.ts) picks up
     pending/failed rows whose backoff window has elapsed and pushes them
     through SupabaseSyncTransport, which upserts on (user_id, client_id) —
     safe to retry, never duplicates (same idempotency mechanism as
     apps/web; see packages/shared/src/types/sync.ts)
```

### Offline behavior (the default assumption, not an edge case)

- Losing connectivity mid-trip never stops GPS recording or local distance
  calculation — both only ever depend on the device, never the network.
- Every trip is fully usable (visible on the Trips screen) from local SQLite
  alone before it has ever synced.
- `SyncQueue` is the only part of this app that knows or cares whether the
  device is online; it degrades to "retry on the next backoff window"
  instead of surfacing errors to the driver.

## What stays local-only vs. what syncs to Supabase

Same tables and shape as `apps/web` writes to (`supabase/migrations/`):
trips (aggregated distance/duration + purpose/vehicle/earnings) and their
full-resolution `trip_points`, once synced. There is currently no opt-out
for syncing raw GPS points — an earlier draft of this document described a
"points stay local, only a simplified polyline syncs" design that was never
actually built that way in `apps/web`'s shipped `SupabaseSyncTransport`, and
this app mirrors that real behavior rather than the earlier plan. A
points-retention/opt-in setting is a reasonable future addition, not
something already implemented on either platform.

## Running it in development

```bash
pnpm install                       # from the repo root — resolves @drivewise/shared too
cp apps/mobile/.env.example apps/mobile/.env.local
# fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# with the same values apps/web/.env.local uses (same Supabase project)
cd apps/mobile
npx expo run:android               # builds and installs a native dev client
```

Use `expo run:android` (or an EAS development build), not plain
`expo start` opened in Expo Go — Expo Go doesn't reliably support the
custom foreground-service configuration `ExpoLocationProvider` depends on
for background tracking. A dev client gives you the same fast-refresh
workflow with the actual native background-location behavior.

## Getting the APK

Everything above is real, working code — what this repo cannot do on its
own is compile it into a binary. That needs one of:

- **EAS Build (recommended)**: `npx eas login` (free Expo account), then
  from `apps/mobile`: `eas build --platform android --profile preview`.
  `eas.json`'s `preview` profile is already configured to produce an
  installable `.apk` (rather than the Play-Store-only `.aab`).
- **A local Android build**: `npx expo prebuild --platform android` to
  generate the native `android/` project, then
  `cd android && ./gradlew assembleRelease` with the Android SDK installed.

Neither of these has been run against this code yet — doing so needs either
network access to Expo's build servers or a local Android SDK, and this
increment was built in an environment with neither available. The code has
been typechecked and is believed correct, but "produces a working APK" is
unverified until one of the two commands above actually runs.

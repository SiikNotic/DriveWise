# DriveWise Mobile

**Status: implemented (v1) and building successfully.** A real Expo/React
Native app with background GPS tracking, offline-first local storage, and
the same Supabase backend `apps/web` uses. The GitHub Actions pipeline in
[Getting the APK](#getting-the-apk) has produced a real, installable
`drivewise.apk`, published at
https://github.com/SiikNotic/DriveWise/releases — that page always has the
latest build.

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
own is compile it into a binary. Three ways to get one, in the order
you'll actually want them:

### 1. GitHub Actions → GitHub Releases (recommended: this is where drivers download/update from)

`.github/workflows/build-android-apk.yml` builds the app on Expo's EAS
Build cloud (not the GitHub runner — no Android SDK is installed there,
because none of the compiling happens on the runner) and attaches the
resulting `.apk` to a GitHub Release. Once it's set up, getting a new
build to drivers is just: push a `mobile-v*` tag (e.g. `mobile-v0.1.0`),
or click "Run workflow" on the Actions tab for an ad-hoc build — either
way, a new release shows up under this repo's **Releases** page with
`drivewise.apk` attached, and installing it over an existing install
updates it in place (`eas.json`'s `autoIncrement` keeps each build's
Android version code higher than the last, which is what lets Android
install-over-update instead of refusing it as a downgrade).

**One-time setup only a human can do** (no token this workflow needs can
be created from inside a workflow file):
1. Create a free account at [expo.dev](https://expo.dev) if you don't have one.
2. Generate an access token: **expo.dev → your account → Settings →
   Access Tokens → Create Token**.
3. In this GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `EXPO_TOKEN`, paste the token.
4. Push a tag or run the workflow manually. The very first run also
   creates the EAS project itself (linking `app.json`'s slug to your Expo
   account) — nothing else to configure beforehand.

### 2. EAS Build from your own machine

```bash
cd apps/mobile
npx eas login                 # same free Expo account as above
eas build --platform android --profile preview
```

Useful for testing a build without waiting on CI, or before the GitHub
Actions secret is set up.

### 3. A fully local Android build

```bash
npx expo prebuild --platform android   # generates the native android/ project
cd android && ./gradlew assembleRelease
```

Needs the Android SDK installed locally. No Expo account or network
dependency on Expo's servers — useful if you want a build pipeline that
doesn't depend on EAS at all.

Option 1 has been run for real and produces a working, installable APK —
see https://github.com/SiikNotic/DriveWise/releases for the latest one.
Getting there took a few real CI-only bugs, fixed in the workflow's commit
history: a `pnpm/action-setup` version conflict with this repo's
`packageManager` field, the EAS project needing `owner` in `app.json` and
`eas init --non-interactive --force` to link/create it under a robot
token (which can't answer interactive prompts), and a `metro.config.js`
bug (`disableHierarchicalLookup: true`) that broke resolution of pnpm's
nested transitive dependencies during the JS bundling phase. Options 2 and
3 haven't been run from this environment (no network to Expo's servers, no
local Android SDK) but use the same `eas.json`/`app.json` config that's
now confirmed working, so they should work the same way from a machine
that has what they need.

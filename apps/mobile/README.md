# DriveWise Mobile

**Status: rebuilt on Capacitor (v2) — replacing an Expo/React Native build
that shipped a persistent, unresolved native crash on Start Tracking.** A
Vite/React web app wrapped in a real, committed native Android project
(`android/`), with background GPS tracking, offline-first local storage,
and the same Supabase backend `apps/web` uses. See
[Why Capacitor, not Expo](#why-capacitor-not-expo) for what changed and why,
and [Getting the APK](#getting-the-apk) for the build pipeline.

## Why this has to be a native app, not the web dashboard

A browser tab cannot be trusted to keep recording GPS once a driver locks
their phone, switches apps, or the OS decides to suspend the tab to save
battery — every mobile OS aggressively kills background browser work, and
there is no web API that overrides that. Nothing in `apps/web` implies
otherwise (see that app's own `RouteMap`/tracking docs). Reliable background
location requires a real mobile app using the platform's background-execution
APIs — here, an Android foreground service with a persistent notification,
via `@capacitor-community/background-geolocation`. See
`CapacitorLocationProvider`.

## Why Capacitor, not Expo

The first version of this app (see git history before this rewrite) was
Expo/React Native. It built successfully and installed, but crashed
instantly — before any permission dialog — every time a driver tapped
"Start Tracking," on real devices. Diagnosis went through several real,
fixed bugs (a native-module SDK version mismatch, a Metro resolver bug) that
turned out not to be the root cause: the crash was confirmed to be below the
JS runtime (no `try/catch`, `ErrorBoundary`, or global `ErrorUtils` handler
ever caught anything) with no way to attach a debugger or read `adb logcat`
from the affected phone. Sentry crash reporting was wired up as the next
diagnostic step, but the underlying decision was made first: stop fighting
Expo's native module layer (Expo Modules API + JSI) for a class of
driver-facing crash with no way to debug it from this environment, and move
to an architecture with a fundamentally simpler, more inspectable native
surface.

Capacitor's plugins are plain Android library modules with a classic
JS-bridge call convention — no Expo Modules Core, no custom JSI bindings, no
SDK-aligned versioning scheme to get wrong. The tradeoff (documented, not
hidden): Expo's official `expo-location` + `expo-task-manager` are more
fully-featured than the free `@capacitor-community/background-geolocation`
plugin used here. If it proves unreliable in practice, the two commonly-cited
upgrades are the paid `capacitor-background-geolocation` (Transistorsoft) or
a small custom native Android plugin — neither has been needed yet.

## What's actually here

```
apps/mobile/
  capacitor.config.ts  — appId/webDir + android.useLegacyBridge (required by
                          the background-geolocation plugin — see its own
                          comment in this file for why)
  vite.config.ts, tailwind.config.js, tsconfig.json
  android/             — the real, committed native Android project (NOT
                          regenerated per build the way Expo's managed
                          workflow was — this repo owns it directly, same as
                          any native Android app)
  src/
    App.tsx            — Sentry.init, session-gated auth vs. app tabs
    lib/
      supabase.ts               — Supabase client (browser localStorage session persistence)
      trip-source.ts            — local+server trip merge, mirrors apps/web's trip-source.ts
      location/
        capacitor-location-provider.ts — implements @drivewise/shared's
                                          LocationProvider over
                                          @capacitor-community/background-geolocation
      storage/
        indexeddb-trip-store.ts — implements TripStore over IndexedDB — a
                                   straight copy of apps/web's
                                   IndexedDbTripStore: Capacitor's Android
                                   WebView is a real Chromium browser
                                   context, so no native SQLite plugin is
                                   needed the way React Native required one
      sync/
        supabase-sync-transport.ts — implements SyncTransport<StoredTrip>
    hooks/
      use-trip-recorder.ts — wires TripRecorder + SyncQueue to React, mirrors
                             apps/web's use-trip-recorder.ts
      use-session.ts       — Supabase auth session state (identical to apps/web's)
      use-online-status.ts — navigator.onLine + online/offline events (hook + ref variant)
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
GPS sample (@capacitor-community/background-geolocation, foreground service)
  -> CapacitorLocationProvider delivers it to TripRecorder (packages/shared)
  -> TripRecorder filters it (gps-filter.ts), updates distance/duration,
     writes the point + updated trip row to IndexedDbTripStore — synchronously,
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
- Every trip is fully usable (visible on the Trips screen) from local
  IndexedDB alone before it has ever synced.
- `SyncQueue` is the only part of this app that knows or cares whether the
  device is online; it degrades to "retry on the next backoff window"
  instead of surfacing errors to the driver.

## What stays local-only vs. what syncs to Supabase

Same tables and shape as `apps/web` writes to (`supabase/migrations/`):
trips (aggregated distance/duration + purpose/vehicle/earnings) and their
full-resolution `trip_points`, once synced. There is currently no opt-out
for syncing raw GPS points — a points-retention/opt-in setting is a
reasonable future addition, not something already implemented on either
platform.

## Running it in development

```bash
pnpm install                       # from the repo root — resolves @drivewise/shared too
cp apps/mobile/.env.example apps/mobile/.env.local
# fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
# with the same values apps/web/.env.local uses (same Supabase project)
cd apps/mobile
pnpm dev                           # plain web preview at localhost:5173 —
                                    # background GPS won't work here, it
                                    # needs the native Android shell
npx cap run android                # builds + installs on a connected
                                    # device/emulator with live location
```

Any time `src/` changes need to reach the native app without a full
`cap run`, use `pnpm cap:sync` (builds the web app, then `cap sync android`
copies the output + plugin registration into `android/`).

## Getting the APK

`.github/workflows/build-android-apk.yml` builds the app entirely on the
GitHub Actions runner — `pnpm build` (Vite) → `npx cap sync android` →
`./gradlew assembleDebug` — and attaches the resulting `.apk` to a GitHub
Release. No third-party build cloud, no opaque remote logs: GitHub's own
`ubuntu-latest` runners ship the Android SDK already, and a debug-signed APK
(Gradle's own auto-generated debug keystore) is exactly what "install this
on a driver's phone to test" needs — no signing secrets to manage.

Getting a new build to drivers is: push a `mobile-v*` tag (e.g.
`mobile-v0.2.0`), or click "Run workflow" on the Actions tab for an ad-hoc
build — either way, a new release shows up under this repo's **Releases**
page with `drivewise.apk` attached, and installing it over an existing
install updates it in place (`android/app/build.gradle`'s `versionCode` is
set from `ANDROID_VERSION_CODE=${{ github.run_number }}`, which only ever
increases — see that file's own comment).

**One-time setup only a human can do** (repo secrets, not something a
workflow file can create for itself):
1. In this GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` — the same values `apps/web`'s
   `.env.local` uses (safe to expose in a built client app; the
   publishable key replaces the legacy "anon" key).
2. Push a tag or run the workflow manually.

**Optional: crash reporting (Sentry).** There is no way to attach a
debugger — or even read `adb logcat` — to a driver's phone, so any crash is
otherwise reported as nothing more than "app has a bug, closed." `@sentry/capacitor`
is wired up in `App.tsx` already; it only activates once a DSN is
configured:
1. Create a free account at [sentry.io](https://sentry.io), create a
   project (platform: Capacitor or React).
2. Copy its DSN: **Settings → Projects → (your project) → Client Keys (DSN)**.
   This is a public identifier, not a secret — safe to expose in the built app.
3. In this GitHub repo: add it as a repository secret named `SENTRY_DSN`.
   The build step passes it through as `VITE_SENTRY_DSN` automatically.
   Without this secret set, `Sentry.init()` stays a harmless no-op.

### Building it yourself, without CI

```bash
cd apps/mobile
pnpm build && npx cap sync android
cd android && ./gradlew assembleDebug   # needs a local Android SDK
# APK lands at android/app/build/outputs/apk/debug/app-debug.apk
```

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { LocationProviderError, RawGpsSample } from "@drivewise/shared";

/**
 * Must stay a top-level, unconditional call — `TaskManager.defineTask` only
 * registers a task Android/iOS can find and invoke later, including after
 * the OS relaunches the app's JS solely to deliver a queued location update
 * while it was otherwise backgrounded/suspended. Defining it inside a
 * component or behind a permission check would mean it's sometimes not
 * registered yet when the OS needs it. This file must be imported once,
 * before `registerRootComponent` — see index.ts.
 */
export const TRIP_LOCATION_TASK_NAME = "drivewise-trip-location-task";

type SampleCallback = (sample: RawGpsSample) => void;
type ErrorCallback = (error: LocationProviderError) => void;

// Module-level, not component state: the task callback below runs
// independently of any React component's lifecycle (it can fire while the
// app is backgrounded with no screen mounted at all). As long as the JS
// runtime is alive — which `isAndroidForegroundServiceEnabled` in app.json
// is what keeps true even with the screen off — these are how a live
// ExpoLocationProvider.start() call receives samples from it.
//
// CAVEAT (documented, not hidden): if Android fully kills the JS process
// under extreme memory pressure despite the foreground service, a sample
// arriving before the app's next relaunch re-registers these callbacks is
// dropped. This is a real TaskManager limitation, not a bug here — the
// existing "resumedAfterInterruption" recovery path (recoverActiveTrip in
// TripRecorder) is what makes that gap survivable rather than corrupting
// the trip.
let activeOnSample: SampleCallback | null = null;
let activeOnError: ErrorCallback | null = null;

export function setActiveLocationCallbacks(onSample: SampleCallback | null, onError: ErrorCallback | null) {
  activeOnSample = onSample;
  activeOnError = onError;
}

function toRawGpsSample(location: Location.LocationObject): RawGpsSample {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: new Date(location.timestamp).toISOString(),
    accuracyMeters: location.coords.accuracy ?? null,
    speedMetersPerSecond: location.coords.speed ?? null,
    altitudeMeters: location.coords.altitude ?? null,
    headingDegrees: location.coords.heading ?? null,
  };
}

TaskManager.defineTask(TRIP_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    activeOnError?.({ reason: "position_unavailable", message: error.message });
    return;
  }
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  for (const location of locations ?? []) {
    activeOnSample?.(toRawGpsSample(location));
  }
});

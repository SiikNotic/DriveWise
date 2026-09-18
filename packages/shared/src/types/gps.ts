import type { GeoPoint } from "./trip";

/**
 * A single fix from whatever location API the platform provides. This is
 * the ONE shape every LocationProvider implementation must produce —
 * everything downstream (filtering, capture decisions, the trip recorder)
 * depends only on this, never on `navigator.geolocation` or a native SDK
 * directly. That's what lets the GPS source change (browser Geolocation
 * today; a native Android/iOS location API tomorrow) without touching any
 * of the tracking logic built on top of it.
 */
export interface RawGpsSample extends GeoPoint {
  /** ISO 8601 timestamp of the fix, from the location API's own clock. */
  timestamp: string;
  /** Radius of uncertainty in meters, per the platform's location API. Null if unreported. */
  accuracyMeters: number | null;
  /** Ground speed in meters/second, when the platform reports it. */
  speedMetersPerSecond: number | null;
  altitudeMeters?: number | null;
  headingDegrees?: number | null;
}

export interface LocationProviderOptions {
  /**
   * A hint, not a guarantee — see LocationProvider's own doc comment. Maps
   * to `enableHighAccuracy` on web; to accuracy/priority constants on a
   * native provider.
   */
  desiredAccuracy?: "high" | "balanced" | "low";
  /**
   * Ask the platform to space fixes at least this far apart in time, where
   * it supports the concept (native OS location APIs do; the browser
   * Geolocation API does not — see BrowserLocationProvider). Independent of
   * — and in addition to — the trip recorder's own capture-throttling in
   * calculations/gps-filter.ts, which is the layer actually responsible for
   * point-count/storage/battery reduction on every platform.
   */
  minIntervalMs?: number;
  minDistanceMeters?: number;
}

export type LocationErrorReason =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unsupported";

export interface LocationProviderError {
  reason: LocationErrorReason;
  message: string;
}

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

/**
 * Abstraction over "however this platform gets GPS fixes." A web build
 * implements this over `navigator.geolocation`; a native mobile client
 * (Android/iOS, with the location permissions — and, for background
 * tracking, the foreground-service / background-mode entitlements — that a
 * browser tab cannot obtain) implements the exact same interface with its
 * own SDK underneath.
 *
 * Nothing above this interface (TripRecorder, the GPS filter, local
 * storage) knows or cares which one is running. That's the whole point:
 * swapping the GPS source later means writing one new class here, not
 * touching the recording engine.
 *
 * IMPORTANT: no implementation of this interface may claim reliable
 * background execution unless the underlying platform actually provides
 * it. A browser tab's GPS watch is throttled or killed by the OS/browser
 * once the tab is backgrounded, the screen locks, or the device sleeps —
 * this is a real platform limitation, not a bug to route around. See
 * BrowserLocationProvider's doc comment.
 */
export interface LocationProvider {
  /** Whether this platform's location API is available at all in the current environment. */
  isSupported(): boolean;
  /** Checks (and where the platform allows, prompts for) permission without starting to watch. */
  requestPermission(): Promise<LocationPermissionState>;
  /** Begins delivering fixes to `onSample` until `stop()` is called. */
  start(
    options: LocationProviderOptions,
    onSample: (sample: RawGpsSample) => void,
    onError: (error: LocationProviderError) => void,
  ): void;
  stop(): void;
}

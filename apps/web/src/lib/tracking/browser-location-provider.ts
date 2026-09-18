import type {
  LocationPermissionState,
  LocationProvider,
  LocationProviderError,
  LocationProviderOptions,
  RawGpsSample,
} from "@drivewise/shared";

function mapErrorCode(code: number): LocationProviderError["reason"] {
  switch (code) {
    case GeolocationPositionError.PERMISSION_DENIED:
      return "permission_denied";
    case GeolocationPositionError.POSITION_UNAVAILABLE:
      return "position_unavailable";
    case GeolocationPositionError.TIMEOUT:
      return "timeout";
    default:
      return "position_unavailable";
  }
}

/**
 * LocationProvider backed by the browser's `navigator.geolocation`.
 *
 * IMPORTANT — this is a foreground-only provider. Browsers throttle or
 * fully suspend `watchPosition` callbacks once a tab is backgrounded, the
 * screen locks, or the OS decides to save power — there is no web API that
 * guarantees continued GPS delivery once the tab loses focus, on any
 * platform. That isn't a bug here; it's a real, unavoidable limitation of
 * running inside a browser tab. Reliable background tracking (recording a
 * trip while the driver's phone is locked in their pocket) requires a
 * native mobile app with the OS's actual background-location APIs — a
 * foreground service + `ACCESS_BACKGROUND_LOCATION` on Android, or the
 * "Always" location authorization + background modes entitlement on iOS —
 * which only a native client, not a web page, can request.
 *
 * TripRecorder and the rest of the tracking engine don't know or care
 * about any of this: they only see the LocationProvider interface. A
 * native client implements that same interface over its own SDK and gets
 * the identical recording/filtering/storage/sync logic for free.
 */
export class BrowserLocationProvider implements LocationProvider {
  private watchId: number | null = null;

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "geolocation" in navigator;
  }

  async requestPermission(): Promise<LocationPermissionState> {
    if (!this.isSupported()) return "unsupported";

    // The Permissions API lets us check status without triggering a
    // prompt; geolocation itself has no separate "just ask" call — the
    // permission prompt appears the first time start() actually calls
    // watchPosition. Not every browser supports querying 'geolocation'
    // this way (Safari doesn't), so this is a best-effort check.
    if (typeof navigator.permissions?.query === "function") {
      try {
        const status = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        if (status.state === "granted") return "granted";
        if (status.state === "denied") return "denied";
      } catch {
        // Fall through — treat as "prompt" and let start() surface any error.
      }
    }
    return "prompt";
  }

  start(
    options: LocationProviderOptions,
    onSample: (sample: RawGpsSample) => void,
    onError: (error: LocationProviderError) => void,
  ): void {
    if (!this.isSupported()) {
      onError({ reason: "unsupported", message: "Geolocation is not available in this browser." });
      return;
    }

    const positionOptions: PositionOptions = {
      enableHighAccuracy: options.desiredAccuracy !== "low",
      maximumAge: 0,
      timeout: 20_000,
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        onSample({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
          accuracyMeters: position.coords.accuracy ?? null,
          speedMetersPerSecond: position.coords.speed ?? null,
          altitudeMeters: position.coords.altitude ?? null,
          headingDegrees: position.coords.heading ?? null,
        });
      },
      (error) => {
        onError({ reason: mapErrorCode(error.code), message: error.message });
      },
      positionOptions,
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

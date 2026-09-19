import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type {
  LocationPermissionState,
  LocationProvider,
  LocationProviderError,
  LocationProviderOptions,
  RawGpsSample,
} from "@drivewise/shared";

interface WatcherOptions {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
}

interface PluginLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  simulated: boolean;
  bearing: number | null;
  speed: number | null;
  time: number | null;
}

interface CallbackError extends Error {
  code?: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: WatcherOptions,
    callback: (position?: PluginLocation, error?: CallbackError) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/** How long requestPermission() waits for the OS permission dialog before giving up and letting the driver retry. */
const PERMISSION_TIMEOUT_MS = 30_000;

function toRawGpsSample(location: PluginLocation): RawGpsSample {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp: new Date(location.time ?? Date.now()).toISOString(),
    accuracyMeters: location.accuracy ?? null,
    speedMetersPerSecond: location.speed ?? null,
    altitudeMeters: location.altitude ?? null,
    headingDegrees: location.bearing ?? null,
  };
}

/**
 * The one piece of this app a plain website could never provide: real
 * background location. @capacitor-community/background-geolocation starts
 * an Android foreground service (with the persistent notification Android
 * requires for it) whenever a watcher is added with `backgroundMessage`
 * set, and keeps delivering fixes even while the app is backgrounded, the
 * screen is locked, or another app is in the foreground.
 *
 * The plugin has no separate "request permission" call — only `addWatcher`
 * (which can request permissions as a side effect) and `removeWatcher`. So
 * requestPermission() below adds a short-lived, foreground-only watcher
 * purely to drive the OS permission prompt and read its outcome from the
 * first callback invocation, then removes it immediately — the real
 * tracking watcher is added separately in start().
 */
export class CapacitorLocationProvider implements LocationProvider {
  private watcherId: string | null = null;

  isSupported(): boolean {
    return true;
  }

  async requestPermission(): Promise<LocationPermissionState> {
    return new Promise<LocationPermissionState>((resolve) => {
      let settled = false;
      let idResolved: string | null = null;

      const cleanup = () => {
        if (idResolved) void BackgroundGeolocation.removeWatcher({ id: idResolved }).catch(() => {});
      };
      const finish = (state: LocationPermissionState) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(state);
        cleanup();
      };

      const timeout = setTimeout(() => finish("prompt"), PERMISSION_TIMEOUT_MS);

      BackgroundGeolocation.addWatcher({ requestPermissions: true, stale: true }, (_location, error) => {
        if (error) {
          finish(error.code === "NOT_AUTHORIZED" ? "denied" : "prompt");
          return;
        }
        finish("granted");
      })
        .then((id) => {
          idResolved = id;
          if (settled) cleanup();
        })
        .catch(() => finish("unsupported"));
    });
  }

  start(
    options: LocationProviderOptions,
    onSample: (sample: RawGpsSample) => void,
    onError: (error: LocationProviderError) => void,
  ): void {
    // Android 13+ requires this runtime permission to show the persistent
    // notification the foreground service depends on to keep running — see
    // the plugin's own README. Best-effort: if it's denied, the watcher
    // below still starts (Android just won't show the notification, which
    // risks the OS killing the service sooner), so this never blocks start.
    void LocalNotifications.requestPermissions().catch(() => {});

    BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: "DriveWise is tracking your trip",
        backgroundMessage: "Recording distance in the background — tap to return to the app.",
        requestPermissions: false,
        stale: false,
        distanceFilter: options.minDistanceMeters ?? 10,
      },
      (location, error) => {
        if (error) {
          onError({
            reason: error.code === "NOT_AUTHORIZED" ? "permission_denied" : "position_unavailable",
            message: error.message,
          });
          return;
        }
        if (location) onSample(toRawGpsSample(location));
      },
    )
      .then((id) => {
        this.watcherId = id;
      })
      .catch((error: Error) => {
        onError({ reason: "position_unavailable", message: error.message });
      });
  }

  stop(): void {
    if (!this.watcherId) return;
    const id = this.watcherId;
    this.watcherId = null;
    void BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
  }
}

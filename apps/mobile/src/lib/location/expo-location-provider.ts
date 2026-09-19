import * as Location from "expo-location";
import type {
  LocationPermissionState,
  LocationProvider,
  LocationProviderError,
  LocationProviderOptions,
  RawGpsSample,
} from "@drivewise/shared";

import { setActiveLocationCallbacks, TRIP_LOCATION_TASK_NAME } from "./background-task";

function toAccuracy(desired: LocationProviderOptions["desiredAccuracy"]): Location.Accuracy {
  switch (desired) {
    case "low":
      return Location.Accuracy.Low;
    case "balanced":
      return Location.Accuracy.Balanced;
    default:
      return Location.Accuracy.BestForNavigation;
  }
}

/**
 * The one piece of this app that a plain web build could never provide:
 * real background location. `Location.startLocationUpdatesAsync` starts an
 * Android foreground service (with the persistent notification Android
 * requires for it) and delivers fixes to the task defined in
 * background-task.ts even while the app is backgrounded, the screen is
 * locked, or another app is in the foreground — as long as the driver has
 * granted "Allow all the time" location access, requested below only after
 * "while using" is already granted, per Play Store policy.
 */
export class ExpoLocationProvider implements LocationProvider {
  private started = false;

  isSupported(): boolean {
    return true;
  }

  async requestPermission(): Promise<LocationPermissionState> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") {
      return foreground.canAskAgain ? "prompt" : "denied";
    }

    // Background permission must be requested as a second, separate step —
    // Android (and Play Store review) rejects apps that ask for it upfront
    // alongside foreground access.
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== "granted") {
      return background.canAskAgain ? "prompt" : "denied";
    }

    return "granted";
  }

  start(
    options: LocationProviderOptions,
    onSample: (sample: RawGpsSample) => void,
    onError: (error: LocationProviderError) => void,
  ): void {
    setActiveLocationCallbacks(onSample, onError);

    void Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK_NAME, {
      accuracy: toAccuracy(options.desiredAccuracy),
      timeInterval: options.minIntervalMs ?? 4_000,
      distanceInterval: options.minDistanceMeters ?? 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "DriveWise is tracking your trip",
        notificationBody: "Recording distance in the background — tap to return to the app.",
        notificationColor: "#0f766e",
      },
      pausesUpdatesAutomatically: false,
    })
      .then(() => {
        this.started = true;
      })
      .catch((error: Error) => {
        onError({ reason: "position_unavailable", message: error.message });
      });
  }

  stop(): void {
    setActiveLocationCallbacks(null, null);
    if (!this.started) return;
    this.started = false;
    void Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK_NAME).then((hasStarted) => {
      if (hasStarted) void Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK_NAME);
    });
  }
}

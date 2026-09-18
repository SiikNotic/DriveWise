import type { SyncStatus } from "./sync";

export type TripPurpose = "business" | "personal" | "commute";

const TRIP_PURPOSES: readonly TripPurpose[] = ["business", "personal", "commute"];

export function isTripPurpose(value: string): value is TripPurpose {
  return (TRIP_PURPOSES as readonly string[]).includes(value);
}

export type TripSource = "gps_auto" | "manual";

/** Whether a trip is actively being recorded on-device — see trip-recording.ts's StoredTrip for the full local-recording shape this feeds into. */
export type TripRecordingStatus = "tracking" | "paused" | "completed";

export type GigPlatform =
  | "doordash"
  | "uber_eats"
  | "grubhub"
  | "instacart"
  | "other";

/**
 * A single GPS sample captured by the mobile tracking layer. Points are
 * always written to the on-device store first; only a simplified polyline
 * (see Trip.routeSimplified) and aggregate stats are pushed to Supabase to
 * keep sync payloads small and protect driver privacy.
 */
export interface TripPoint {
  id: string;
  tripId: string;
  clientId: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  speedMetersPerSecond: number | null;
  horizontalAccuracyMeters: number | null;
  recordedAt: string;
  sequence: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: string;
  userId: string;
  clientId: string;
  vehicleId: string | null;
  platform: GigPlatform | null;
  purpose: TripPurpose;
  source: TripSource;
  startedAt: string;
  endedAt: string | null;
  startLocation: GeoPoint | null;
  endLocation: GeoPoint | null;
  /** Simplified route for map rendering; raw TripPoints stay local unless the user opts in. */
  routeSimplified: GeoPoint[] | null;
  distanceMiles: number;
  durationSeconds: number;
  earningsUsd: number | null;
  tipsUsd: number | null;
  notes: string | null;
  status: TripRecordingStatus;
  /** Whether this *completed* trip has reached Supabase — orthogonal to TripRecordingStatus, and only meaningful once status is "completed" (see TripRecorder). See SyncStatus's own doc comment for what each value means. */
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

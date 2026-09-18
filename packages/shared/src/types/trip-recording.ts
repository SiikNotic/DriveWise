import type { GigPlatform, TripPurpose, TripRecordingStatus, TripSyncStatus } from "./trip";
import type { RawGpsSample } from "./gps";

/**
 * The trip record as it lives in local storage — a superset of what gets
 * synced to `public.trips` (see packages/shared/src/types/database.ts).
 * Everything here is keyed by `clientId`, generated on-device at creation:
 * that's the idempotency key both locally and on the server (`unique
 * (user_id, client_id)`), so a retried sync after a dropped connection
 * upserts instead of duplicating.
 */
export interface StoredTrip {
  clientId: string;
  /** The server-assigned id, once known. Null until the first successful sync. */
  serverId: string | null;
  userId: string;
  vehicleId: string | null;
  platform: GigPlatform | null;
  purpose: TripPurpose;
  status: TripRecordingStatus;
  syncStatus: TripSyncStatus;
  syncError: string | null;
  syncRetryCount: number;
  /** Backoff: the sync queue skips this trip until this time has passed. */
  nextSyncAttemptAt: string | null;
  startedAt: string;
  endedAt: string | null;
  startLocation: { latitude: number; longitude: number } | null;
  endLocation: { latitude: number; longitude: number } | null;
  distanceMiles: number;
  /** Active recording time in seconds — excludes any paused intervals. */
  durationSeconds: number;
  /** Wall-clock time of the most recent pause/resume transition, for duration accounting. */
  lastResumedAt: string | null;
  /** The last GPS fix accepted by the filter (not necessarily captured/stored) — needed to judge the next fix's plausibility and capture-worthiness after a resume or app relaunch. */
  lastAcceptedSample: RawGpsSample | null;
  lastCapturedAt: string | null;
  /** How many consecutive heartbeat-only points were written while stationary — see gps-filter.ts. */
  consecutiveStationaryHeartbeats: number;
  createdAt: string;
  updatedAt: string;
}

export type StoredTripInit = Pick<
  StoredTrip,
  "clientId" | "userId" | "vehicleId" | "platform" | "purpose" | "startedAt"
>;

/** A GPS point actually written to storage (post-filter, post-capture-decision). */
export interface StoredTripPoint {
  clientId: string;
  tripClientId: string;
  userId: string;
  sequence: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  altitudeMeters: number | null;
}

/**
 * Abstraction over "however this platform persists trips and points
 * on-device." A web build implements this over IndexedDB; a native mobile
 * client would implement it over SQLite (or another embedded store) with
 * the same interface. TripRecorder and SyncQueue depend only on this —
 * never on IndexedDB, SQL, or any storage API directly — so the local
 * storage backend can change without touching either.
 *
 * The one invariant every implementation must uphold: a row written here
 * is never deleted (except by `deleteTrip`, used only for an explicit
 * driver-initiated discard) until `markSyncStatus` has recorded "synced".
 * That's what "local data survives until sync is confirmed" means in
 * practice.
 */
export interface TripStore {
  createTrip(trip: StoredTrip): Promise<void>;
  updateTrip(clientId: string, patch: Partial<StoredTrip>): Promise<void>;
  getTrip(clientId: string): Promise<StoredTrip | null>;
  /** At most one trip should ever be "tracking" or "paused" for a given user at a time. */
  getActiveTrip(userId: string): Promise<StoredTrip | null>;
  deleteTrip(clientId: string): Promise<void>;

  appendPoint(point: StoredTripPoint): Promise<void>;
  getPoints(tripClientId: string): Promise<StoredTripPoint[]>;
  countPoints(tripClientId: string): Promise<number>;

  /** Completed trips whose syncStatus is pending_sync or sync_error and whose backoff window has elapsed. */
  listSyncable(userId: string, now: string): Promise<StoredTrip[]>;
  markSyncStatus(
    clientId: string,
    update: {
      syncStatus: TripSyncStatus;
      serverId?: string | null;
      syncError?: string | null;
      syncRetryCount?: number;
      nextSyncAttemptAt?: string | null;
    },
  ): Promise<void>;
}

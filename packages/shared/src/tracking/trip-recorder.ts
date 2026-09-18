import type { GigPlatform, TripPurpose } from "../types/trip";
import type {
  LocationProvider,
  LocationPermissionState,
  RawGpsSample,
} from "../types/gps";
import type { StoredTrip, StoredTripPoint, TripStore } from "../types/trip-recording";
import { decideCapture, isSampleTrustworthy } from "../calculations/gps-filter";
import { haversineDistanceMiles } from "../calculations/distance";

const METERS_PER_MILE = 1609.344;
/** A trip is shown as "searching" rather than "active" once its last accepted fix is older than this. */
const STALE_FIX_MS = 15_000;
/** This many consecutive accuracy-rejections in a row surfaces "weak signal" instead of "searching". */
const WEAK_SIGNAL_REJECTION_STREAK = 3;

export type GpsStatus =
  | "active"
  | "searching"
  | "weak"
  | "idle"
  | "permission_denied"
  | "unsupported";

export interface TripRecorderSnapshot {
  status: StoredTrip["status"] | "idle";
  tripClientId: string | null;
  distanceMiles: number;
  durationSeconds: number;
  pointCount: number;
  gpsStatus: GpsStatus;
  lastError: string | null;
}

export interface StartTripInput {
  userId: string;
  vehicleId: string | null;
  purpose: TripPurpose;
  platform?: GigPlatform | null;
}

export interface TripRecorderDeps {
  locationProvider: LocationProvider;
  tripStore: TripStore;
  /**
   * Required rather than defaulted: this package targets ES2022 only (no
   * DOM or Node ambient types — see tsconfig.base.json), precisely so it
   * never assumes a particular platform's globals. The caller supplies
   * whatever its own environment provides — `() => crypto.randomUUID()` on
   * web, a native equivalent on mobile.
   */
  generateId: () => string;
  now?: () => Date;
}

/**
 * The tracking engine itself — platform-agnostic. It's built entirely
 * against the LocationProvider and TripStore interfaces (never against
 * `navigator.geolocation` or IndexedDB directly), so it's the one piece of
 * code a native mobile client reuses unchanged: only the two interfaces'
 * implementations differ per platform.
 *
 * Every state-changing call (start/pause/resume/stop/a captured point)
 * writes straight through to TripStore before this class considers the
 * change "done" — there is no in-memory-only state that a crash, a
 * suspended tab, or a killed process could lose. That's what makes
 * recoverActiveTrip() possible: on relaunch, whatever TripStore has on
 * disk *is* the trip, not a cache of it.
 */
export class TripRecorder {
  private readonly locationProvider: LocationProvider;
  private readonly tripStore: TripStore;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  private trip: StoredTrip | null = null;
  private pointCount = 0;
  private permissionState: LocationPermissionState = "prompt";
  private lastError: string | null = null;
  private lastAcceptedAtMs: number | null = null;
  private recentAccuracyRejections = 0;
  private listeners = new Set<(snapshot: TripRecorderSnapshot) => void>();

  constructor(deps: TripRecorderDeps) {
    this.locationProvider = deps.locationProvider;
    this.tripStore = deps.tripStore;
    this.generateId = deps.generateId;
    this.now = deps.now ?? (() => new Date());
  }

  subscribe(listener: (snapshot: TripRecorderSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): TripRecorderSnapshot {
    return {
      status: this.trip?.status ?? "idle",
      tripClientId: this.trip?.clientId ?? null,
      distanceMiles: this.trip?.distanceMiles ?? 0,
      durationSeconds: this.liveDurationSeconds(),
      pointCount: this.pointCount,
      gpsStatus: this.computeGpsStatus(),
      lastError: this.lastError,
    };
  }

  /**
   * On app start, reattach to a trip that was left "tracking" or "paused"
   * in storage — evidence of a suspend, a crash, or a plain closed tab.
   * A trip found still "tracking" is always demoted to "paused" here:
   * silently resuming raw GPS collection after an unknown gap (how long
   * was the app closed? did the user move?) would fabricate distance from
   * a gap we have no data for. The driver must explicitly hit Resume,
   * which re-opens the GPS watch cleanly from now.
   */
  async recoverActiveTrip(userId: string): Promise<TripRecorderSnapshot | null> {
    const existing = await this.tripStore.getActiveTrip(userId);
    if (!existing) return null;

    if (existing.status === "tracking") {
      const recovered: StoredTrip = {
        ...existing,
        status: "paused",
        durationSeconds: this.foldElapsedIntoDuration(existing),
        lastResumedAt: null,
      };
      await this.tripStore.updateTrip(recovered.clientId, recovered);
      this.trip = recovered;
    } else {
      this.trip = existing;
    }

    this.pointCount = await this.tripStore.countPoints(this.trip.clientId);
    this.lastAcceptedAtMs = this.trip.lastAcceptedSample
      ? new Date(this.trip.lastAcceptedSample.timestamp).getTime()
      : null;
    this.emit();
    return this.getSnapshot();
  }

  async start(input: StartTripInput): Promise<void> {
    if (this.trip) {
      throw new Error("A trip is already active — stop or discard it before starting a new one.");
    }

    this.permissionState = await this.locationProvider.requestPermission();
    if (this.permissionState === "denied") {
      this.lastError = "permission_denied";
      this.emit();
      return;
    }
    if (this.permissionState === "unsupported" || !this.locationProvider.isSupported()) {
      this.lastError = "unsupported";
      this.emit();
      return;
    }

    const nowIso = this.now().toISOString();
    const trip: StoredTrip = {
      clientId: this.generateId(),
      serverId: null,
      userId: input.userId,
      vehicleId: input.vehicleId,
      platform: input.platform ?? null,
      purpose: input.purpose,
      status: "tracking",
      syncStatus: "pending_sync",
      syncError: null,
      syncRetryCount: 0,
      nextSyncAttemptAt: null,
      startedAt: nowIso,
      endedAt: null,
      startLocation: null,
      endLocation: null,
      distanceMiles: 0,
      durationSeconds: 0,
      earningsUsd: null,
      tipsUsd: null,
      lastResumedAt: nowIso,
      lastAcceptedSample: null,
      lastCapturedAt: null,
      consecutiveStationaryHeartbeats: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await this.tripStore.createTrip(trip);
    this.trip = trip;
    this.pointCount = 0;
    this.lastError = null;
    this.lastAcceptedAtMs = null;
    this.recentAccuracyRejections = 0;

    this.watch();
    this.emit();
  }

  pause(): void {
    if (!this.trip || this.trip.status !== "tracking") return;

    this.locationProvider.stop();
    const durationSeconds = this.foldElapsedIntoDuration(this.trip);
    this.trip = { ...this.trip, status: "paused", durationSeconds, lastResumedAt: null };
    void this.tripStore.updateTrip(this.trip.clientId, this.trip);
    this.emit();
  }

  resume(): void {
    if (!this.trip || this.trip.status !== "paused") return;

    this.trip = { ...this.trip, status: "tracking", lastResumedAt: this.now().toISOString() };
    void this.tripStore.updateTrip(this.trip.clientId, this.trip);
    this.watch();
    this.emit();
  }

  /**
   * `earnings` is optional and driver-entered — nothing computes it. A
   * trip stopped without it simply has no earnings data yet; that's a
   * legitimate, common case (e.g. logging pay later), not an error.
   */
  async stop(earnings?: { earningsUsd?: number | null; tipsUsd?: number | null }): Promise<{ tripClientId: string }> {
    if (!this.trip) {
      throw new Error("No active trip to stop.");
    }

    if (this.trip.status === "tracking") {
      this.locationProvider.stop();
    }

    const durationSeconds =
      this.trip.status === "tracking" ? this.foldElapsedIntoDuration(this.trip) : this.trip.durationSeconds;

    const finished: StoredTrip = {
      ...this.trip,
      status: "completed",
      syncStatus: "pending_sync",
      durationSeconds,
      endedAt: this.now().toISOString(),
      lastResumedAt: null,
      earningsUsd: earnings?.earningsUsd ?? this.trip.earningsUsd,
      tipsUsd: earnings?.tipsUsd ?? this.trip.tipsUsd,
    };

    await this.tripStore.updateTrip(finished.clientId, finished);
    const tripClientId = finished.clientId;
    this.trip = null;
    this.emit();
    return { tripClientId };
  }

  async discard(): Promise<void> {
    if (!this.trip) return;
    if (this.trip.status === "tracking") {
      this.locationProvider.stop();
    }
    await this.tripStore.deleteTrip(this.trip.clientId);
    this.trip = null;
    this.pointCount = 0;
    this.emit();
  }

  private watch(): void {
    this.locationProvider.start(
      { desiredAccuracy: "high" },
      (sample) => void this.handleSample(sample),
      (error) => {
        // Transient GPS loss is expected and tolerated: keep tracking, just
        // surface the reason. The trip is never auto-stopped or auto-paused
        // because of a GPS error — only the driver's own pause/stop does that.
        this.lastError = error.reason;
        this.emit();
      },
    );
  }

  private async handleSample(candidate: RawGpsSample): Promise<void> {
    if (!this.trip || this.trip.status !== "tracking") return;

    const previous = this.trip.lastAcceptedSample;
    if (!isSampleTrustworthy(candidate, previous)) {
      if (previous) this.recentAccuracyRejections += 1;
      this.emit();
      return;
    }
    this.recentAccuracyRejections = 0;
    this.lastError = null;

    const distanceMiles = previous
      ? this.trip.distanceMiles + haversineDistanceMiles(previous, candidate)
      : this.trip.distanceMiles;

    const nowMs = new Date(candidate.timestamp).getTime();
    const decision = decideCapture({
      candidate,
      lastCaptured: this.trip.lastAcceptedSample,
      lastCapturedAtMs: this.trip.lastCapturedAt ? new Date(this.trip.lastCapturedAt).getTime() : null,
      consecutiveStationaryHeartbeats: this.trip.consecutiveStationaryHeartbeats,
      nowMs,
    });

    let consecutiveStationaryHeartbeats = this.trip.consecutiveStationaryHeartbeats;
    if (decision.shouldCapture) {
      const isRealMovement = decision.reason !== "time_heartbeat";
      consecutiveStationaryHeartbeats = isRealMovement ? 0 : consecutiveStationaryHeartbeats + 1;

      const point: StoredTripPoint = {
        clientId: this.generateId(),
        tripClientId: this.trip.clientId,
        userId: this.trip.userId,
        sequence: this.pointCount,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timestamp: candidate.timestamp,
        accuracyMeters: candidate.accuracyMeters,
        speedMetersPerSecond: candidate.speedMetersPerSecond,
        altitudeMeters: candidate.altitudeMeters ?? null,
      };
      await this.tripStore.appendPoint(point);
      this.pointCount += 1;
    }

    this.trip = {
      ...this.trip,
      distanceMiles: Number(distanceMiles.toFixed(4)),
      startLocation: this.trip.startLocation ?? {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      },
      lastAcceptedSample: candidate,
      lastCapturedAt: decision.shouldCapture ? candidate.timestamp : this.trip.lastCapturedAt,
      consecutiveStationaryHeartbeats,
      updatedAt: this.now().toISOString(),
    };
    this.lastAcceptedAtMs = nowMs;
    await this.tripStore.updateTrip(this.trip.clientId, this.trip);
    this.emit();
  }

  /** Adds the time since the trip was last resumed into its stored duration; returns the new total. */
  private foldElapsedIntoDuration(trip: StoredTrip): number {
    if (!trip.lastResumedAt) return trip.durationSeconds;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((this.now().getTime() - new Date(trip.lastResumedAt).getTime()) / 1000),
    );
    return trip.durationSeconds + elapsedSeconds;
  }

  /** Duration for display purposes — includes time elapsed since the last resume, without waiting for the next GPS fix to persist it. */
  private liveDurationSeconds(): number {
    if (!this.trip) return 0;
    if (this.trip.status !== "tracking") return this.trip.durationSeconds;
    return this.foldElapsedIntoDuration(this.trip);
  }

  private computeGpsStatus(): GpsStatus {
    if (this.lastError === "unsupported") return "unsupported";
    if (this.lastError === "permission_denied") return "permission_denied";
    if (!this.trip || this.trip.status !== "tracking") return "idle";
    if (this.lastAcceptedAtMs === null) return "searching";
    if (this.recentAccuracyRejections >= WEAK_SIGNAL_REJECTION_STREAK) return "weak";
    if (this.now().getTime() - this.lastAcceptedAtMs > STALE_FIX_MS) return "searching";
    return "active";
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

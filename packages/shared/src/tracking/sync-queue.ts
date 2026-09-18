import type { StoredTrip, StoredTripPoint, TripStore } from "../types/trip-recording";

export type SyncPushResult =
  | { ok: true; serverId: string }
  | { ok: false; error: string };

export type SyncPointsResult = { ok: true } | { ok: false; error: string };

/**
 * Abstraction over "however this platform talks to the backend." A web
 * build implements this with the Supabase browser client; a native mobile
 * client would implement it the same way with whatever Supabase client it
 * uses there. SyncQueue depends only on this and on TripStore — never on
 * `@supabase/supabase-js` directly — so the backend/transport can change
 * without touching the queue logic.
 *
 * Both methods MUST be idempotent: SyncQueue may call either one more than
 * once for the same trip/points after a retry, and expects that to be
 * harmless (an upsert keyed on the client-generated id), never a duplicate.
 */
export interface SyncTransport {
  pushTrip(trip: StoredTrip): Promise<SyncPushResult>;
  pushPoints(tripClientId: string, tripServerId: string, points: StoredTripPoint[]): Promise<SyncPointsResult>;
}

export interface SyncQueueDeps {
  tripStore: TripStore;
  transport: SyncTransport;
  isOnline: () => boolean;
  now?: () => Date;
  /** Backoff base for retry N: min(baseBackoffMs * 2^(N-1), maxBackoffMs). */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface SyncRunResult {
  synced: number;
  failed: number;
}

/**
 * Drains completed, not-yet-synced trips (and their points) to the backend.
 * Never touches a trip that's still "tracking"/"paused" — see TripRecorder:
 * a trip only becomes syncable once the driver stops it.
 *
 * Idempotency comes from `clientId`, generated on-device the moment a trip
 * or point is created (see trip-recorder.ts) and enforced server-side via
 * `unique (user_id, client_id)` — so re-pushing the same trip or point
 * after a dropped connection upserts instead of duplicating. This queue
 * only has to guarantee it eventually retries; it never has to guarantee
 * exactly-once delivery itself.
 */
export class SyncQueue {
  private readonly deps: Required<Omit<SyncQueueDeps, "now">> & { now: () => Date };

  constructor(deps: SyncQueueDeps) {
    this.deps = {
      tripStore: deps.tripStore,
      transport: deps.transport,
      isOnline: deps.isOnline,
      now: deps.now ?? (() => new Date()),
      baseBackoffMs: deps.baseBackoffMs ?? 15_000,
      maxBackoffMs: deps.maxBackoffMs ?? 15 * 60_000,
    };
  }

  async runOnce(userId: string): Promise<SyncRunResult> {
    if (!this.deps.isOnline()) {
      return { synced: 0, failed: 0 };
    }

    const nowIso = this.deps.now().toISOString();
    const syncable = await this.deps.tripStore.listSyncable(userId, nowIso);

    let synced = 0;
    let failed = 0;

    for (const trip of syncable) {
      const tripResult = await this.deps.transport.pushTrip(trip);
      if (!tripResult.ok) {
        await this.recordFailure(trip, tripResult.error);
        failed += 1;
        continue;
      }

      const points = await this.deps.tripStore.getPoints(trip.clientId);
      if (points.length > 0) {
        const pointsResult = await this.deps.transport.pushPoints(
          trip.clientId,
          tripResult.serverId,
          points,
        );
        if (!pointsResult.ok) {
          await this.recordFailure(trip, pointsResult.error, tripResult.serverId);
          failed += 1;
          continue;
        }
      }

      await this.deps.tripStore.markSyncStatus(trip.clientId, {
        syncStatus: "synced",
        serverId: tripResult.serverId,
        syncError: null,
        syncRetryCount: 0,
        nextSyncAttemptAt: null,
      });
      synced += 1;
    }

    return { synced, failed };
  }

  private async recordFailure(trip: StoredTrip, error: string, serverId?: string): Promise<void> {
    const retryCount = trip.syncRetryCount + 1;
    const backoffMs = Math.min(
      this.deps.baseBackoffMs * 2 ** (retryCount - 1),
      this.deps.maxBackoffMs,
    );
    await this.deps.tripStore.markSyncStatus(trip.clientId, {
      syncStatus: "sync_error",
      serverId: serverId ?? trip.serverId,
      syncError: error,
      syncRetryCount: retryCount,
      nextSyncAttemptAt: new Date(this.deps.now().getTime() + backoffMs).toISOString(),
    });
  }
}

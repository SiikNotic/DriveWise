/**
 * Offline-first sync primitives shared by every syncable domain (trips,
 * expenses, and anything added later) and, eventually, the mobile tracking
 * layer. One generic engine (see ../tracking/sync-queue.ts's SyncQueue)
 * implements retry/backoff/idempotency once; each domain only supplies its
 * own storage (SyncableStore) and transport (SyncTransport).
 */

/**
 * local: created on-device, not yet queued for a sync attempt.
 * pending: queued — eligible and waiting for connectivity or its backoff window.
 * syncing: a push attempt is in flight right now (prevents a second queue
 *   run from dispatching the same record again while one is outstanding).
 * synced: the server has confirmed this exact record (by clientId).
 * failed: the last attempt errored; the queue retries it automatically
 *   once its backoff window elapses (see SyncQueue's exponential backoff).
 */
export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "failed";

/**
 * The subset of fields any locally-stored, syncable record must carry.
 * `clientId` is the idempotency key: generated on-device at creation and
 * enforced server-side via `unique (user_id, client_id)`, so re-pushing
 * the same record after a dropped connection upserts instead of
 * duplicating.
 */
export interface SyncableRecord {
  clientId: string;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncRetryCount: number;
  nextSyncAttemptAt: string | null;
  updatedAt: string;
}

export interface SyncStatusUpdate {
  syncStatus: SyncStatus;
  serverId?: string | null;
  syncError?: string | null;
  syncRetryCount?: number;
  nextSyncAttemptAt?: string | null;
}

/**
 * Abstraction over "however this platform persists a syncable entity
 * on-device." Implemented once per entity (trips, expenses, ...) and once
 * per platform (IndexedDB on web; SQLite or similar on a native client) —
 * SyncQueue depends only on this, never on a concrete storage engine.
 *
 * The one invariant every implementation must uphold: a row written here
 * is never deleted (outside an explicit driver-initiated delete/discard)
 * until `markSyncStatus` has recorded "synced". That's what "local data
 * survives until sync is confirmed" means in practice.
 */
export interface SyncableStore<T extends SyncableRecord> {
  /**
   * Records still owed a sync attempt: `pending` or `failed` whose backoff
   * window has elapsed, or `syncing` for longer than STALE_SYNCING_MS
   * (almost certainly abandoned by a closed/crashed tab, and safe to retry
   * since every transport's push must be idempotent).
   */
  listSyncable(userId: string, now: string): Promise<T[]>;
  markSyncStatus(clientId: string, update: SyncStatusUpdate): Promise<void>;
}

export type SyncPushResult = { ok: true; serverId: string } | { ok: false; error: string };

/**
 * Abstraction over "however this platform talks to the backend" for one
 * entity type. A web build implements this with the Supabase browser
 * client. SyncQueue depends only on this and on SyncableStore — never on
 * `@supabase/supabase-js` directly.
 *
 * MUST be idempotent: SyncQueue may call this more than once for the same
 * record — after a network retry, or after reclaiming a stale "syncing"
 * state — and that must be harmless (an upsert keyed on the client-
 * generated id), never a duplicate.
 */
export interface SyncTransport<T> {
  push(item: T): Promise<SyncPushResult>;
}

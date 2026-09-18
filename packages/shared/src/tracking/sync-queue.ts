import type { SyncableRecord, SyncableStore, SyncTransport } from "../types/sync";

/**
 * How long a record is allowed to sit in "syncing" before the queue treats
 * it as abandoned (the tab that started the push closed or crashed mid-
 * flight) and retries it. Safe to retry because every transport's push is
 * required to be idempotent — see SyncTransport's doc comment.
 */
export const STALE_SYNCING_MS = 2 * 60_000;

/**
 * Shared eligibility check every SyncableStore.listSyncable implementation
 * should filter with — one definition of "still owed a sync attempt" for
 * every entity/platform, rather than each store reimplementing the same
 * backoff-window and stale-"syncing" logic slightly differently.
 */
export function isSyncEligible(
  record: Pick<SyncableRecord, "syncStatus" | "nextSyncAttemptAt" | "updatedAt">,
  now: string,
): boolean {
  if (record.syncStatus === "pending" || record.syncStatus === "failed") {
    return !record.nextSyncAttemptAt || record.nextSyncAttemptAt <= now;
  }
  if (record.syncStatus === "syncing") {
    return new Date(now).getTime() - new Date(record.updatedAt).getTime() > STALE_SYNCING_MS;
  }
  return false;
}

export interface SyncQueueDeps<T extends SyncableRecord> {
  store: SyncableStore<T>;
  transport: SyncTransport<T>;
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
 * Drains locally-created records to the backend for any entity type that
 * implements SyncableRecord/SyncableStore/SyncTransport — trips and
 * expenses share this one implementation of retry, backoff, and the
 * local -> pending -> syncing -> synced/failed state machine, rather than
 * each reimplementing it.
 */
export class SyncQueue<T extends SyncableRecord> {
  private readonly deps: Required<Omit<SyncQueueDeps<T>, "now">> & { now: () => Date };

  constructor(deps: SyncQueueDeps<T>) {
    this.deps = {
      store: deps.store,
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
    const syncable = await this.deps.store.listSyncable(userId, nowIso);

    let synced = 0;
    let failed = 0;

    for (const item of syncable) {
      // Marked "syncing" before the push starts so a second, overlapping
      // runOnce (two tabs, or a timer firing while a slow request is still
      // in flight) skips this record instead of dispatching it twice —
      // belt-and-suspenders on top of the transport's own idempotent
      // upsert, never the only thing preventing a duplicate.
      await this.deps.store.markSyncStatus(item.clientId, { syncStatus: "syncing" });

      const result = await this.deps.transport.push(item);
      if (!result.ok) {
        await this.recordFailure(item, result.error);
        failed += 1;
        continue;
      }

      await this.deps.store.markSyncStatus(item.clientId, {
        syncStatus: "synced",
        serverId: result.serverId,
        syncError: null,
        syncRetryCount: 0,
        nextSyncAttemptAt: null,
      });
      synced += 1;
    }

    return { synced, failed };
  }

  private async recordFailure(item: T, error: string): Promise<void> {
    const retryCount = item.syncRetryCount + 1;
    const backoffMs = Math.min(
      this.deps.baseBackoffMs * 2 ** (retryCount - 1),
      this.deps.maxBackoffMs,
    );
    await this.deps.store.markSyncStatus(item.clientId, {
      syncStatus: "failed",
      syncError: error,
      syncRetryCount: retryCount,
      nextSyncAttemptAt: new Date(this.deps.now().getTime() + backoffMs).toISOString(),
    });
  }
}

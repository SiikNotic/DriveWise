import { describe, expect, it, vi } from "vitest";

import { isSyncEligible, STALE_SYNCING_MS, SyncQueue } from "./sync-queue";
import type { SyncableRecord, SyncableStore, SyncStatusUpdate, SyncTransport } from "../types/sync";

interface FakeRecord extends SyncableRecord {
  serverId: string | null;
  value: string;
}

function makeRecord(overrides: Partial<FakeRecord> = {}): FakeRecord {
  return {
    clientId: "client-1",
    serverId: null,
    syncStatus: "pending",
    syncError: null,
    syncRetryCount: 0,
    nextSyncAttemptAt: null,
    updatedAt: "2024-01-01T00:00:00.000Z",
    value: "hello",
    ...overrides,
  };
}

/** A minimal in-memory SyncableStore, enough to exercise SyncQueue's real logic against. */
class FakeStore implements SyncableStore<FakeRecord> {
  records = new Map<string, FakeRecord>();

  constructor(records: FakeRecord[]) {
    for (const record of records) this.records.set(record.clientId, record);
  }

  async listSyncable(_userId: string, now: string): Promise<FakeRecord[]> {
    return [...this.records.values()].filter((record) => isSyncEligible(record, now));
  }

  async markSyncStatus(clientId: string, update: SyncStatusUpdate): Promise<void> {
    const existing = this.records.get(clientId);
    if (!existing) throw new Error("not found");
    this.records.set(clientId, {
      ...existing,
      syncStatus: update.syncStatus,
      serverId: update.serverId !== undefined ? update.serverId : existing.serverId,
      syncError: update.syncError !== undefined ? update.syncError : existing.syncError,
      syncRetryCount: update.syncRetryCount !== undefined ? update.syncRetryCount : existing.syncRetryCount,
      nextSyncAttemptAt:
        update.nextSyncAttemptAt !== undefined ? update.nextSyncAttemptAt : existing.nextSyncAttemptAt,
      updatedAt: "now",
    });
  }
}

describe("SyncQueue", () => {
  it("pushes a pending record and marks it synced with the returned serverId", async () => {
    const store = new FakeStore([makeRecord()]);
    const transport: SyncTransport<FakeRecord> = {
      push: vi.fn(async () => ({ ok: true as const, serverId: "server-1" })),
    };
    const queue = new SyncQueue({ store, transport, isOnline: () => true });

    const result = await queue.runOnce("user-1");

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(transport.push).toHaveBeenCalledTimes(1);
    const stored = store.records.get("client-1")!;
    expect(stored.syncStatus).toBe("synced");
    expect(stored.serverId).toBe("server-1");
  });

  it("never attempts a push while offline", async () => {
    const store = new FakeStore([makeRecord()]);
    const transport: SyncTransport<FakeRecord> = { push: vi.fn(async () => ({ ok: true as const, serverId: "x" })) };
    const queue = new SyncQueue({ store, transport, isOnline: () => false });

    const result = await queue.runOnce("user-1");

    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(transport.push).not.toHaveBeenCalled();
  });

  it("retries a failed push with exponential backoff and never marks it synced", async () => {
    const store = new FakeStore([makeRecord()]);
    const transport: SyncTransport<FakeRecord> = {
      push: vi.fn(async () => ({ ok: false as const, error: "network down" })),
    };
    const fixedNow = new Date("2024-01-01T00:00:00.000Z");
    const queue = new SyncQueue({
      store,
      transport,
      isOnline: () => true,
      now: () => fixedNow,
      baseBackoffMs: 1000,
      maxBackoffMs: 60_000,
    });

    const result = await queue.runOnce("user-1");

    expect(result).toEqual({ synced: 0, failed: 1 });
    const stored = store.records.get("client-1")!;
    expect(stored.syncStatus).toBe("failed");
    expect(stored.syncRetryCount).toBe(1);
    expect(stored.nextSyncAttemptAt).toBe(new Date(fixedNow.getTime() + 1000).toISOString());
  });

  it("does not retry a failed record before its backoff window elapses", async () => {
    const future = new Date("2024-01-01T01:00:00.000Z").toISOString();
    const store = new FakeStore([
      makeRecord({ syncStatus: "failed", syncRetryCount: 1, nextSyncAttemptAt: future }),
    ]);
    const transport: SyncTransport<FakeRecord> = { push: vi.fn(async () => ({ ok: true as const, serverId: "x" })) };
    const queue = new SyncQueue({
      store,
      transport,
      isOnline: () => true,
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });

    await queue.runOnce("user-1");

    expect(transport.push).not.toHaveBeenCalled();
  });

  it("is idempotent: re-running after a successful sync never pushes the record again", async () => {
    const store = new FakeStore([makeRecord()]);
    const transport: SyncTransport<FakeRecord> = {
      push: vi.fn(async () => ({ ok: true as const, serverId: "server-1" })),
    };
    const queue = new SyncQueue({ store, transport, isOnline: () => true });

    await queue.runOnce("user-1");
    await queue.runOnce("user-1");
    await queue.runOnce("user-1");

    expect(transport.push).toHaveBeenCalledTimes(1);
  });

  it("reclaims a record stuck in 'syncing' past STALE_SYNCING_MS (e.g. the tab closed mid-push) and retries it", async () => {
    const stuckAt = new Date("2024-01-01T00:00:00.000Z");
    const store = new FakeStore([makeRecord({ syncStatus: "syncing", updatedAt: stuckAt.toISOString() })]);
    const transport: SyncTransport<FakeRecord> = {
      push: vi.fn(async () => ({ ok: true as const, serverId: "server-1" })),
    };
    const later = new Date(stuckAt.getTime() + STALE_SYNCING_MS + 1000);
    const queue = new SyncQueue({ store, transport, isOnline: () => true, now: () => later });

    const result = await queue.runOnce("user-1");

    expect(transport.push).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ synced: 1, failed: 0 });
  });

  it("does not touch a record still 'syncing' within the stale window (avoids double-dispatch)", async () => {
    const recentlyStarted = new Date("2024-01-01T00:00:00.000Z");
    const store = new FakeStore([makeRecord({ syncStatus: "syncing", updatedAt: recentlyStarted.toISOString() })]);
    const transport: SyncTransport<FakeRecord> = { push: vi.fn(async () => ({ ok: true as const, serverId: "x" })) };
    const soonAfter = new Date(recentlyStarted.getTime() + 5000);
    const queue = new SyncQueue({ store, transport, isOnline: () => true, now: () => soonAfter });

    await queue.runOnce("user-1");

    expect(transport.push).not.toHaveBeenCalled();
  });

  it("ignores a 'local' record — it isn't queued for sync yet", async () => {
    const store = new FakeStore([makeRecord({ syncStatus: "local" })]);
    const transport: SyncTransport<FakeRecord> = { push: vi.fn(async () => ({ ok: true as const, serverId: "x" })) };
    const queue = new SyncQueue({ store, transport, isOnline: () => true });

    await queue.runOnce("user-1");

    expect(transport.push).not.toHaveBeenCalled();
  });
});

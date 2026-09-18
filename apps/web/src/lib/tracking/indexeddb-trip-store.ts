import { isSyncEligible, type StoredTrip, type StoredTripPoint, type SyncStatusUpdate, type TripStore } from "@drivewise/shared";

/**
 * Web implementation of TripStore, backed by IndexedDB. This is the one
 * place in the app that talks to IndexedDB directly — TripRecorder and
 * SyncQueue only ever see the TripStore interface, so a native mobile
 * client can back the exact same interface with SQLite (or anything else)
 * without either of them changing.
 *
 * Every write here goes straight to IndexedDB before the caller's promise
 * resolves — there is no in-memory buffer that a crash or a killed tab
 * could lose. That's what "local data survives until sync is confirmed"
 * requires in practice.
 */
const DB_NAME = "drivewise-tracking";
const DB_VERSION = 1;
const TRIPS_STORE = "trips";
const POINTS_STORE = "tripPoints";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        const trips = db.createObjectStore(TRIPS_STORE, { keyPath: "clientId" });
        trips.createIndex("byUserId", "userId");
      }
      if (!db.objectStoreNames.contains(POINTS_STORE)) {
        const points = db.createObjectStore(POINTS_STORE, { keyPath: "clientId" });
        points.createIndex("byTripClientId", "tripClientId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbTripStore implements TripStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  private async getTripsByUser(userId: string): Promise<StoredTrip[]> {
    const db = await this.db();
    const tx = db.transaction(TRIPS_STORE, "readonly");
    const index = tx.objectStore(TRIPS_STORE).index("byUserId");
    return promisify(index.getAll(IDBKeyRange.only(userId)));
  }

  async createTrip(trip: StoredTrip): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(TRIPS_STORE, "readwrite");
    tx.objectStore(TRIPS_STORE).put(trip);
    await promisifyTx(tx);
  }

  async updateTrip(clientId: string, patch: Partial<StoredTrip>): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(TRIPS_STORE, "readwrite");
    const store = tx.objectStore(TRIPS_STORE);
    const existing = await promisify<StoredTrip | undefined>(store.get(clientId));
    if (!existing) {
      throw new Error(`IndexedDbTripStore: no stored trip with clientId ${clientId}`);
    }
    store.put({ ...existing, ...patch });
    await promisifyTx(tx);
  }

  async getTrip(clientId: string): Promise<StoredTrip | null> {
    const db = await this.db();
    const tx = db.transaction(TRIPS_STORE, "readonly");
    const result = await promisify<StoredTrip | undefined>(tx.objectStore(TRIPS_STORE).get(clientId));
    return result ?? null;
  }

  async getActiveTrip(userId: string): Promise<StoredTrip | null> {
    const trips = await this.getTripsByUser(userId);
    return trips.find((trip) => trip.status === "tracking" || trip.status === "paused") ?? null;
  }

  async deleteTrip(clientId: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([TRIPS_STORE, POINTS_STORE], "readwrite");
    tx.objectStore(TRIPS_STORE).delete(clientId);

    const pointsIndex = tx.objectStore(POINTS_STORE).index("byTripClientId");
    const cursorRequest = pointsIndex.openCursor(IDBKeyRange.only(clientId));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });

    await promisifyTx(tx);
  }

  async appendPoint(point: StoredTripPoint): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(POINTS_STORE, "readwrite");
    tx.objectStore(POINTS_STORE).put(point);
    await promisifyTx(tx);
  }

  async getPoints(tripClientId: string): Promise<StoredTripPoint[]> {
    const db = await this.db();
    const tx = db.transaction(POINTS_STORE, "readonly");
    const index = tx.objectStore(POINTS_STORE).index("byTripClientId");
    const points = await promisify<StoredTripPoint[]>(index.getAll(IDBKeyRange.only(tripClientId)));
    return points.sort((a, b) => a.sequence - b.sequence);
  }

  async countPoints(tripClientId: string): Promise<number> {
    const db = await this.db();
    const tx = db.transaction(POINTS_STORE, "readonly");
    const index = tx.objectStore(POINTS_STORE).index("byTripClientId");
    return promisify(index.count(IDBKeyRange.only(tripClientId)));
  }

  async listSyncable(userId: string, now: string): Promise<StoredTrip[]> {
    const trips = await this.getTripsByUser(userId);
    return trips.filter((trip) => trip.status === "completed" && isSyncEligible(trip, now));
  }

  async listCompletedTrips(userId: string): Promise<StoredTrip[]> {
    const trips = await this.getTripsByUser(userId);
    return trips
      .filter((trip) => trip.status === "completed")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async markSyncStatus(clientId: string, update: SyncStatusUpdate): Promise<void> {
    const patch: Partial<StoredTrip> = {
      syncStatus: update.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    if (update.serverId !== undefined) patch.serverId = update.serverId;
    if (update.syncError !== undefined) patch.syncError = update.syncError;
    if (update.syncRetryCount !== undefined) patch.syncRetryCount = update.syncRetryCount;
    if (update.nextSyncAttemptAt !== undefined) patch.nextSyncAttemptAt = update.nextSyncAttemptAt;
    await this.updateTrip(clientId, patch);
  }
}

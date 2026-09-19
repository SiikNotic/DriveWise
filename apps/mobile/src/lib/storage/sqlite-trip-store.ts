import * as SQLite from "expo-sqlite";
import {
  isSyncEligible,
  type StoredTrip,
  type StoredTripPoint,
  type SyncStatusUpdate,
  type TripStore,
} from "@drivewise/shared";

/**
 * Mobile implementation of TripStore, backed by expo-sqlite. Mirrors
 * apps/web's IndexedDbTripStore field-for-field and behavior-for-behavior
 * (see that file's own doc comment) — TripRecorder and SyncQueue only ever
 * see the TripStore interface, so this is the only file that knows SQL is
 * involved. The full trip record is kept as a single JSON column rather
 * than mapped to individual SQL columns: it's a document store from every
 * caller's point of view (same shape IndexedDB gave it), and JSON avoids a
 * schema migration every time a new StoredTrip field is added — `userId`
 * and `status` are pulled out as their own indexed columns because they're
 * the only two fields ever filtered on directly in SQL.
 *
 * Every write commits before the caller's promise resolves — there is no
 * in-memory buffer a killed process could lose. That's what "local data
 * survives until sync is confirmed" requires in practice, same invariant
 * as the web store.
 */
const DB_NAME = "drivewise-tracking.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS trips (
          clientId TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          status TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(userId);
        CREATE TABLE IF NOT EXISTS trip_points (
          clientId TEXT PRIMARY KEY NOT NULL,
          tripClientId TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_points_trip ON trip_points(tripClientId);
      `);
      return database;
    });
  }
  return dbPromise;
}

export class SqliteTripStore implements TripStore {
  private async getTripsByUser(userId: string): Promise<StoredTrip[]> {
    const database = await db();
    const rows = await database.getAllAsync<{ data: string }>(
      "SELECT data FROM trips WHERE userId = ?",
      [userId],
    );
    return rows.map((row) => JSON.parse(row.data) as StoredTrip);
  }

  async createTrip(trip: StoredTrip): Promise<void> {
    const database = await db();
    await database.runAsync(
      "INSERT OR REPLACE INTO trips (clientId, userId, status, data) VALUES (?, ?, ?, ?)",
      [trip.clientId, trip.userId, trip.status, JSON.stringify(trip)],
    );
  }

  async updateTrip(clientId: string, patch: Partial<StoredTrip>): Promise<void> {
    const existing = await this.getTrip(clientId);
    if (!existing) {
      throw new Error(`SqliteTripStore: no stored trip with clientId ${clientId}`);
    }
    const updated: StoredTrip = { ...existing, ...patch };
    const database = await db();
    await database.runAsync(
      "UPDATE trips SET userId = ?, status = ?, data = ? WHERE clientId = ?",
      [updated.userId, updated.status, JSON.stringify(updated), clientId],
    );
  }

  async getTrip(clientId: string): Promise<StoredTrip | null> {
    const database = await db();
    const row = await database.getFirstAsync<{ data: string }>(
      "SELECT data FROM trips WHERE clientId = ?",
      [clientId],
    );
    return row ? (JSON.parse(row.data) as StoredTrip) : null;
  }

  async getActiveTrip(userId: string): Promise<StoredTrip | null> {
    const trips = await this.getTripsByUser(userId);
    return trips.find((trip) => trip.status === "tracking" || trip.status === "paused") ?? null;
  }

  async deleteTrip(clientId: string): Promise<void> {
    const database = await db();
    await database.runAsync("DELETE FROM trips WHERE clientId = ?", [clientId]);
    await database.runAsync("DELETE FROM trip_points WHERE tripClientId = ?", [clientId]);
  }

  async appendPoint(point: StoredTripPoint): Promise<void> {
    const database = await db();
    await database.runAsync(
      "INSERT OR REPLACE INTO trip_points (clientId, tripClientId, sequence, data) VALUES (?, ?, ?, ?)",
      [point.clientId, point.tripClientId, point.sequence, JSON.stringify(point)],
    );
  }

  async getPoints(tripClientId: string): Promise<StoredTripPoint[]> {
    const database = await db();
    const rows = await database.getAllAsync<{ data: string }>(
      "SELECT data FROM trip_points WHERE tripClientId = ? ORDER BY sequence ASC",
      [tripClientId],
    );
    return rows.map((row) => JSON.parse(row.data) as StoredTripPoint);
  }

  async countPoints(tripClientId: string): Promise<number> {
    const database = await db();
    const row = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM trip_points WHERE tripClientId = ?",
      [tripClientId],
    );
    return row?.count ?? 0;
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

import type { StoredTrip, SyncStatus, TripPurpose } from "@drivewise/shared";

import { supabase } from "./supabase";
import { IndexedDbTripStore } from "./storage/indexeddb-trip-store";

const MAX_SERVER_TRIPS = 500;

/** Mirrors apps/web's TripListRow/fetchTripRows (trip-source.ts) — same merge rule, same reasoning; see that file's doc comment. */
export interface TripListRow {
  clientId: string;
  serverId: string | null;
  vehicleId: string | null;
  purpose: TripPurpose;
  startedAt: string;
  endedAt: string | null;
  distanceMiles: number;
  durationSeconds: number;
  earningsUsd: number | null;
  tipsUsd: number | null;
  syncStatus: SyncStatus;
}

function storedTripToRow(trip: StoredTrip): TripListRow {
  return {
    clientId: trip.clientId,
    serverId: trip.serverId,
    vehicleId: trip.vehicleId,
    purpose: trip.purpose,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    distanceMiles: trip.distanceMiles,
    durationSeconds: trip.durationSeconds,
    earningsUsd: trip.earningsUsd,
    tipsUsd: trip.tipsUsd,
    syncStatus: trip.syncStatus,
  };
}

export async function fetchTripRows(userId: string): Promise<TripListRow[]> {
  const tripStore = new IndexedDbTripStore();

  const [localTrips, { data: serverTrips }] = await Promise.all([
    tripStore.listCompletedTrips(userId),
    supabase
      .from("trips")
      .select(
        "id, client_id, vehicle_id, purpose, started_at, ended_at, distance_miles, duration_seconds, earnings_usd, tips_usd, sync_status",
      )
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(MAX_SERVER_TRIPS),
  ]);

  const pendingLocal = localTrips.filter((trip) => trip.syncStatus !== "synced").map(storedTripToRow);

  const synced: TripListRow[] = (serverTrips ?? []).map((row) => ({
    clientId: row.client_id,
    serverId: row.id,
    vehicleId: row.vehicle_id,
    purpose: row.purpose,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceMiles: row.distance_miles,
    durationSeconds: row.duration_seconds,
    earningsUsd: row.earnings_usd,
    tipsUsd: row.tips_usd,
    syncStatus: row.sync_status,
  }));

  return [...pendingLocal, ...synced].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

import type { GeoPoint, StoredTrip, TripPurpose, TripSyncStatus } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";
import { IndexedDbTripStore } from "@/lib/tracking/indexeddb-trip-store";
import { updateTripPurposeAction, deleteTripAction } from "@/lib/trips/actions";
import { initialTripActionState } from "@/lib/trips/types";

const MAX_SERVER_TRIPS = 500;

/**
 * A trip as the Trips UI wants to see it, regardless of whether it has
 * synced to Supabase yet. `serverId` is null until sync succeeds — that's
 * the only signal the UI needs to know which backend an edit or delete has
 * to go through (see updateTripPurpose/deleteTripRecord below).
 */
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
  syncStatus: TripSyncStatus;
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

/**
 * The complete Trips list is the union of two sources that never overlap in
 * practice: trips still only in IndexedDB (not yet synced — status
 * pending_sync/sync_error) and trips already synced to Supabase. Once the
 * background SyncQueue (see useTripRecorder) marks a local trip "synced",
 * it drops out of the first list and shows up in the second on the next
 * fetch — no double-counting, no gap where a trip disappears.
 */
export async function fetchTripRows(userId: string): Promise<TripListRow[]> {
  const tripStore = new IndexedDbTripStore();
  const supabase = createClient();

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

  const pendingLocal = localTrips
    .filter((trip) => trip.syncStatus !== "synced")
    .map(storedTripToRow);

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

export interface TripDetail {
  row: TripListRow;
  points: GeoPoint[];
}

/** Looks a trip up by its client-generated id, the one identifier stable across both backends. */
export async function fetchTripDetail(clientId: string, userId: string): Promise<TripDetail | null> {
  const supabase = createClient();

  const { data: serverTrip } = await supabase
    .from("trips")
    .select(
      "id, client_id, vehicle_id, purpose, started_at, ended_at, distance_miles, duration_seconds, earnings_usd, tips_usd, sync_status",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (serverTrip) {
    const { data: points } = await supabase
      .from("trip_points")
      .select("latitude, longitude")
      .eq("trip_id", serverTrip.id)
      .order("sequence", { ascending: true });

    return {
      row: {
        clientId: serverTrip.client_id,
        serverId: serverTrip.id,
        vehicleId: serverTrip.vehicle_id,
        purpose: serverTrip.purpose,
        startedAt: serverTrip.started_at,
        endedAt: serverTrip.ended_at,
        distanceMiles: serverTrip.distance_miles,
        durationSeconds: serverTrip.duration_seconds,
        earningsUsd: serverTrip.earnings_usd,
        tipsUsd: serverTrip.tips_usd,
        syncStatus: serverTrip.sync_status,
      },
      points: points ?? [],
    };
  }

  const tripStore = new IndexedDbTripStore();
  const localTrip = await tripStore.getTrip(clientId);
  if (!localTrip || localTrip.userId !== userId || localTrip.status !== "completed") {
    return null;
  }

  const localPoints = await tripStore.getPoints(clientId);
  return {
    row: storedTripToRow(localTrip),
    points: localPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  };
}

/** Edits go straight to IndexedDB for a still-local trip (no server row exists yet to update) and through a Server Action once synced. */
export async function updateTripPurpose(row: TripListRow, purpose: TripPurpose): Promise<{ error?: string }> {
  if (row.syncStatus === "synced" && row.serverId) {
    const formData = new FormData();
    formData.set("id", row.serverId);
    formData.set("purpose", purpose);
    const result = await updateTripPurposeAction(initialTripActionState, formData);
    return { error: result.error };
  }

  const tripStore = new IndexedDbTripStore();
  await tripStore.updateTrip(row.clientId, { purpose });
  return {};
}

/** Same dual dispatch as updateTripPurpose — deleting a still-local trip just removes it (and its points) from IndexedDB directly. */
export async function deleteTripRecord(row: TripListRow): Promise<{ error?: string }> {
  if (row.syncStatus === "synced" && row.serverId) {
    const formData = new FormData();
    formData.set("id", row.serverId);
    const result = await deleteTripAction(initialTripActionState, formData);
    return { error: result.error };
  }

  const tripStore = new IndexedDbTripStore();
  await tripStore.deleteTrip(row.clientId);
  return {};
}

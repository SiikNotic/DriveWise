import type { StoredTrip, SyncPushResult, SyncTransport, TripStore } from "@drivewise/shared";

import { supabase } from "../supabase";

/**
 * Mobile implementation of SyncTransport<StoredTrip>, over the same
 * Supabase project apps/web uses. Field-for-field identical to
 * apps/web's SupabaseSyncTransport (see that file's own doc comment for
 * why push() is still one idempotent unit despite being two upserts) —
 * SyncQueue never imports `@supabase/supabase-js` itself, only this class
 * does, so the two platforms can diverge here without either's engine
 * changing.
 */
export class SupabaseSyncTransport implements SyncTransport<StoredTrip> {
  constructor(private readonly tripStore: TripStore) {}

  async push(trip: StoredTrip): Promise<SyncPushResult> {
    const { data, error } = await supabase
      .from("trips")
      .upsert(
        {
          user_id: trip.userId,
          client_id: trip.clientId,
          vehicle_id: trip.vehicleId,
          platform: trip.platform,
          purpose: trip.purpose,
          source: "gps_auto",
          started_at: trip.startedAt,
          ended_at: trip.endedAt,
          start_latitude: trip.startLocation?.latitude ?? null,
          start_longitude: trip.startLocation?.longitude ?? null,
          end_latitude: trip.endLocation?.latitude ?? null,
          end_longitude: trip.endLocation?.longitude ?? null,
          distance_miles: trip.distanceMiles,
          duration_seconds: trip.durationSeconds,
          route_simplified: null,
          earnings_usd: trip.earningsUsd,
          tips_usd: trip.tipsUsd,
          notes: null,
          status: "completed",
          sync_status: "synced",
        },
        { onConflict: "user_id,client_id" },
      )
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Unknown error syncing trip" };
    }
    const serverId = data.id;

    const points = await this.tripStore.getPoints(trip.clientId);
    if (points.length > 0) {
      const rows = points.map((point) => ({
        trip_id: serverId,
        user_id: point.userId,
        client_id: point.clientId,
        latitude: point.latitude,
        longitude: point.longitude,
        altitude_meters: point.altitudeMeters,
        speed_mps: point.speedMetersPerSecond,
        horizontal_accuracy_meters: point.accuracyMeters,
        recorded_at: point.timestamp,
        sequence: point.sequence,
      }));

      const { error: pointsError } = await supabase
        .from("trip_points")
        .upsert(rows, { onConflict: "user_id,client_id" });

      if (pointsError) {
        return { ok: false, error: pointsError.message };
      }
    }

    return { ok: true, serverId };
  }
}

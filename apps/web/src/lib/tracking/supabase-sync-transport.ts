import type { SyncPointsResult, SyncPushResult, SyncTransport } from "@drivewise/shared";
import type { StoredTrip, StoredTripPoint } from "@drivewise/shared";

import { createClient } from "@/lib/supabase/client";

/**
 * Web implementation of SyncTransport, over the Supabase browser client.
 * SyncQueue never imports `@supabase/supabase-js` itself — only this class
 * does — so a native mobile client can push to a different backend, or the
 * same backend through a different client, without SyncQueue changing.
 *
 * Both methods key their upsert on `client_id` (per user), which is the
 * idempotency guarantee: SyncQueue is allowed to call either one more than
 * once for the same trip after a retry, and it must be harmless.
 */
export class SupabaseSyncTransport implements SyncTransport {
  async pushTrip(trip: StoredTrip): Promise<SyncPushResult> {
    const supabase = createClient();

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
    return { ok: true, serverId: data.id };
  }

  async pushPoints(
    _tripClientId: string,
    tripServerId: string,
    points: StoredTripPoint[],
  ): Promise<SyncPointsResult> {
    if (points.length === 0) return { ok: true };
    const supabase = createClient();

    const rows = points.map((point) => ({
      trip_id: tripServerId,
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

    const { error } = await supabase
      .from("trip_points")
      .upsert(rows, { onConflict: "user_id,client_id" });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

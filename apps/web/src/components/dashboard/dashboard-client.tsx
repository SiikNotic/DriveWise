"use client";

import { useCallback, useState } from "react";

import { TrackingPanel } from "@/components/tracking/tracking-panel";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";

/**
 * Coordinates the two client pieces of the Dashboard: TrackingPanel owns
 * the one TripRecorder instance for this tab (it must stay singular — see
 * useTripRecorder's own doc comment), and DashboardMetrics reads completed,
 * synced trips from Supabase. This wrapper just bumps a counter whenever a
 * trip finishes, so today's/this week's numbers refetch without polling.
 */
export function DashboardClient({
  userId,
  vehicles,
  distanceUnitLabel,
  hourUnitLabel,
  activeVehicleCostPerMileUsd,
}: {
  userId: string;
  vehicles: { id: string; nickname: string }[];
  distanceUnitLabel: string;
  hourUnitLabel: string;
  activeVehicleCostPerMileUsd: number | null;
}) {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const handleTripCompleted = useCallback(() => setRefreshSignal((value) => value + 1), []);

  return (
    <div className="flex flex-col gap-6">
      <TrackingPanel
        userId={userId}
        vehicles={vehicles}
        distanceUnitLabel={distanceUnitLabel}
        hourUnitLabel={hourUnitLabel}
        onTripCompleted={handleTripCompleted}
      />
      <DashboardMetrics
        userId={userId}
        distanceUnitLabel={distanceUnitLabel}
        hourUnitLabel={hourUnitLabel}
        activeVehicleCostPerMileUsd={activeVehicleCostPerMileUsd}
        refreshSignal={refreshSignal}
      />
    </div>
  );
}
